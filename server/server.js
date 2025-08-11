/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────
// 설정
// ─────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const MAP_DIR  = path.join(DATA_DIR, 'mappings');
if (!fs.existsSync(MAP_DIR)) fs.mkdirSync(MAP_DIR, { recursive: true });

function loadMappingFile(type = 'default') {
  const p = path.join(MAP_DIR, `mapping.${type}.json`);
  console.log(`[server] 매핑 파일 로딩 시도: ${p}`);
  
  if (!fs.existsSync(p)) {
    console.error(`[server] 매핑 파일이 존재하지 않음: ${p}`);
    throw new Error(`Mapping file not found: ${p}`);
  }
  
  try {
    const content = fs.readFileSync(p, 'utf8');
    console.log(`[server] 매핑 파일 내용 읽기 성공: ${content.length} bytes`);
    const parsed = JSON.parse(content);
    console.log(`[server] 매핑 파일 파싱 성공:`, {
      version: parsed.version,
      type: parsed.type,
      mappingsCount: parsed.mappings?.length || 0,
      mappings: parsed.mappings?.map(m => ({ from: m.from, to: m.to, op: m.op }))
    });
    return parsed;
  } catch (error) {
    console.error(`[server] 매핑 파일 로딩/파싱 실패:`, error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// 경로 유틸 (a.b[0].c, arr[*].id 지원)
// ─────────────────────────────────────────────────────────────
const SEG_RE = /[^.[\]]+|\[(\d+|\*)\]/g;

function parsePath(p) {
  if (!p || typeof p !== 'string') return [];
  
  const out = [];
  try {
    const matches = p.matchAll(SEG_RE);
    for (const m of matches) {
      out.push(m[1] !== undefined ? m[1] : m[0]);
    }
  } catch (error) {
    console.warn('Path parsing error:', error);
    return [];
  }
  return out;
}

function deepGet(obj, pathStr) {
  if (!pathStr) return obj;
  const segs = parsePath(pathStr);
  let cur = obj;
  for (const s of segs) {
    if (s === '*') return undefined; // deepGet 단독에서는 '*' 의미 없음
    if (cur == null) return undefined;
    cur = Array.isArray(cur) ? cur[Number(s)] : cur[s];
  }
  return cur;
}

function deepSet(target, pathStr, value) {
  const segs = parsePath(pathStr);
  let cur = target;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const last = i === segs.length - 1;
    const isIndex = /^\d+$/.test(s);
    const key = isIndex ? Number(s) : s;

    if (last) {
      if (isIndex) {
        if (!Array.isArray(cur)) throw new Error(`Trying to set array index on non-array at "${segs.slice(0, i).join('.')}"`);
        cur[key] = value;
      } else {
        if (cur == null || typeof cur !== 'object') throw new Error(`Trying to set key on non-object at "${segs.slice(0, i).join('.')}"`);
        cur[key] = value;
      }
      break;
    }

    const nextIsIndex = /^\d+$/.test(segs[i + 1]);

    if (isIndex) {
      if (!Array.isArray(cur)) {
        // 부모가 배열이 아니면 배열로 바꿀 수 없으므로 에러 대신 강제 초기화
        // 필요 시 스펙에 맞춰 로직 조정
        throw new Error(`Invalid path: parent not array at "${segs.slice(0, i).join('.')}"`);
      }
      if (!cur[key]) cur[key] = nextIsIndex ? [] : {};
      cur = cur[key];
    } else {
      if (!cur[key] || typeof cur[key] !== 'object') cur[key] = nextIsIndex ? [] : {};
      cur = cur[key];
    }
  }
  return target;
}

// ─────────────────────────────────────────────────────────────
// 변환 연산
// ─────────────────────────────────────────────────────────────
function passWhen(src, rule) {
  if (!rule) return true;
  const val = rule.from ? deepGet(src, rule.from) : undefined;
  const exists = val !== undefined && val !== null;
  let ok = true;
  if ('exists' in rule) ok = rule.exists ? exists : !exists;
  if ('equals' in rule) ok = ok && val === rule.equals;
  if (rule.not) ok = !ok;
  return ok;
}

function applyOp(op, args, sourceValue) {
  switch (op || 'copy') {
    case 'copy':    return sourceValue;
    case 'const':   return args;
    case 'number':  {
      const n = Number(sourceValue);
      return Number.isNaN(n) ? null : n;
    }
    case 'boolean': return Boolean(sourceValue);
    case 'string':  return sourceValue == null ? '' : String(sourceValue);
    case 'date': {
      const d = sourceValue instanceof Date ? sourceValue : new Date(sourceValue);
      if (args && args.format === 'timestamp') return d.getTime();
      return d.toISOString();
    }
    default:        return sourceValue;
  }
}

// 배열 와일드카드: from: "items[*].id" → to: "lines[*].sku"
function applyEntry(out, entry, src) {
  if (!passWhen(src, entry.when)) return;

  const hasFromWild = entry.from?.includes('[*]');
  const hasToWild   = entry.to?.includes('[*]');

  if (hasFromWild || hasToWild) {
    const fromPrefix = entry.from ? entry.from.split('[*]')[0].replace(/\.$/, '') : null; // "items"
    const toPrefix   = entry.to.split('[*]')[0].replace(/\.$/, '');                        // "lines"
    const fromRest   = entry.from ? entry.from.split('[*]')[1]?.replace(/^\./, '') : null; // "id"
    const toRest     = entry.to.split('[*]')[1]?.replace(/^\./, '') || '';                 // "sku" | ""

    const arr = fromPrefix ? deepGet(src, fromPrefix) : [];
    const len = Array.isArray(arr) ? arr.length : 0;

    for (let i = 0; i < len; i++) {
      const fromPath = fromRest ? `${fromPrefix}[${i}].${fromRest}` : `${fromPrefix}[${i}]`;
      const raw = entry.from ? deepGet(src, fromPath) : undefined;
      const val = applyOp(entry.op, entry.args, raw);

      const toPath = toRest ? `${toPrefix}[${i}].${toRest}` : `${toPrefix}[${i}]`;
      deepSet(out, toPath, val);
    }
    return;
  }

  const raw = entry.from ? deepGet(src, entry.from) : undefined;
  const val = applyOp(entry.op, entry.args, raw);
  deepSet(out, entry.to, val);
}

function transform(type, payload) {
  console.log(`[server] 변환 시작: type=${type}, payload=`, payload);
  
  const spec = loadMappingFile(type);
  if (!spec?.mappings || !Array.isArray(spec.mappings)) {
    console.error(`[server] 유효하지 않은 매핑 스펙:`, spec);
    throw new Error(`Invalid mapping spec for type "${type}"`);
  }
  
  console.log(`[server] 매핑 스펙 로드 완료: ${spec.mappings.length}개 매핑`);
  
  const out = {};
  for (const entry of spec.mappings) {
    console.log(`[server] 매핑 엔트리 처리:`, entry);
    applyEntry(out, entry, payload);
  }
  
  console.log(`[server] 변환 완료, 결과:`, out);
  return out;
}

// ─────────────────────────────────────────────────────────────
// 서버
// ─────────────────────────────────────────────────────────────
const app = express();
app.use(bodyParser.json({ limit: '2mb' }));

// CORS 설정 (프론트엔드에서 접근 가능하도록)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 매핑 파일 업로드(선택): 클라이언트가 서버에 업로드해서 저장하고 싶을 때 사용
app.post('/mappings/:type', (req, res) => {
  const type = req.params.type || 'default';
  const body = req.body;
  if (!body?.mappings || !Array.isArray(body.mappings)) {
    return res.status(400).json({ error: '`mappings` array required' });
  }
  const filePath = path.join(MAP_DIR, `mapping.${type}.json`);
  fs.writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf8');
  return res.json({ ok: true, path: filePath });
});

// 매핑 파일 조회(디버그용)
app.get('/mappings/:type', (req, res) => {
  try {
    const type = req.params.type || 'default';
    const spec = loadMappingFile(type);
    return res.json(spec);
  } catch (e) {
    return res.status(404).json({ error: e.message });
  }
});

// 변환 API: 소스 payload → 타겟 payload 반환
app.post('/transform', (req, res) => {
  try {
    const { type = 'default', payload } = req.body || {};
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: '`payload` must be object' });
    }
    const result = transform(type, payload);
    return res.json({ ok: true, transformed: result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 사용 가능한 매핑 타입 목록 조회
app.get('/mappings', (req, res) => {
  try {
    const files = fs.readdirSync(MAP_DIR);
    const types = files
      .filter(f => f.startsWith('mapping.') && f.endsWith('.json'))
      .map(f => f.replace('mapping.', '').replace('.json', ''));
    return res.json({ types });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mapping Transform API listening on :${PORT}`)); 