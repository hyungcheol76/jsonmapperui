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

// 연결된 소스 파라미터 수집
function collectSourceParams(src, entry, allMappings) {
  const params = {};
  if (entry.functionId) {
    console.log('[server] collectSourceParams - functionId:', entry.functionId);
    console.log('[server] collectSourceParams - allMappings:', allMappings);
    
    // 같은 functionId를 가진 function-input 타입 매핑에서 소스 파라미터 수집
    allMappings.forEach(mapping => {
      console.log('[server] 매핑 검사:', mapping);
      
      // functionId가 같고, type이 'function-input'인 매핑에서 실제 소스 경로 수집
      if (mapping.functionId === entry.functionId && 
          mapping.type === 'function-input' &&
          mapping.from && 
          !mapping.from.startsWith('function:')) {
        
        console.log('[server] 소스 파라미터 발견:', mapping.from);
        params[mapping.from] = deepGet(src, mapping.from);
        console.log('[server] 소스 값:', deepGet(src, mapping.from));
      } else {
        console.log('[server] 매핑 조건 불일치:', {
          functionIdMatch: mapping.functionId === entry.functionId,
          typeMatch: mapping.type === 'function-input',
          hasFrom: !!mapping.from,
          notFunctionFrom: !mapping.from?.startsWith('function:')
        });
      }
    });
  } else {
    console.log('[server] entry에 functionId가 없음:', entry);
  }
  console.log('[server] 최종 sourceParams:', params);
  return params;
}

// 연결된 타겟 파라미터 수집
function collectTargetParams(out, entry) {
  const params = {};
  if (entry.functionId) {
    // 같은 functionId를 가진 다른 매핑에서 타겟 파라미터 수집
    // 실제 구현에서는 매핑 스펙에서 관련 매핑들을 찾아야 함
    // 여기서는 간단히 현재 entry의 to 값만 사용
    if (entry.to) {
      params[entry.to] = deepGet(out, entry.to);
    }
  }
  return params;
}

function applyOp(op, args, sourceValue, sourceParams = {}, targetParams = {}) {
  console.log('[server] applyOp 호출:', { op, args, sourceValue, sourceParams, targetParams });
  
  switch (op || 'copy') {
    case 'copy':    return sourceValue;
    case 'const':   return args;
    case 'function': {
      // 함수 실행 (스크립트 기반)
      console.log('[server] function case 진입, args:', args);
      if (args && args.script) {
        try {
          console.log('[server] 펑션 스크립트 실행:', args.script);
          console.log('[server] 펑션 입력값:', { sourceValue, sourceParams, targetParams });
          
          const scriptFunction = new Function('sourceValue', 'sourceParams', 'targetParams', args.script);
          const result = scriptFunction(sourceValue, sourceParams, targetParams);
          
          console.log('[server] 펑션 실행 결과:', result);
          return result;
        } catch (error) {
          console.error('[server] 함수 실행 오류:', error);
          return sourceValue; // 오류 시 원본 값 반환
        }
      } else {
        console.log('[server] 스크립트가 없거나 args가 없음:', { hasArgs: !!args, hasScript: !!(args && args.script) });
      }
      return sourceValue;
    }
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
function applyEntry(out, entry, src, allMappings) {
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
  
  // 함수 실행 시 파라미터 객체 생성
  let sourceParams = {};
  let targetParams = {};
  
  if (entry.op === 'function') {
    // 연결된 소스/타겟 파라미터 수집 (전체 매핑 정보 전달)
    sourceParams = collectSourceParams(src, entry, allMappings);
    targetParams = collectTargetParams(out, entry);
    
    console.log('[server] 펑션 실행 - sourceParams:', sourceParams);
    console.log('[server] 펑션 실행 - targetParams:', targetParams);
    
    // function-input 타입 매핑의 경우 실제 값을 sourceParams에 추가
    if (entry.type === 'function-input' && entry.from && !entry.from.startsWith('function:')) {
      sourceParams[entry.from] = raw;
      console.log('[server] function-input 타입 매핑에서 소스 값 추가:', entry.from, raw);
    }
    
    // function-output 타입의 경우, 모든 function-input 매핑에서 소스 파라미터 수집
    if (entry.type === 'function-output' && entry.functionId) {
      console.log('[server] function-output에서 소스 파라미터 수집 시작');
      allMappings.forEach(mapping => {
        if (mapping.type === 'function-input' && 
            mapping.functionId === entry.functionId &&
            mapping.from && 
            !mapping.from.startsWith('function:')) {
          
          const value = deepGet(src, mapping.from);
          sourceParams[mapping.from] = value;
          console.log('[server] function-output에서 소스 파라미터 추가:', mapping.from, value);
        }
      });
    }
  }
  
  // function 타입의 경우 script를 args에 포함
  let args = entry.args || {};
  if (entry.op === 'function' && entry.script) {
    args = { ...args, script: entry.script };
  }
  
  const val = applyOp(entry.op, args, raw, sourceParams, targetParams);
  
  // function-output 타입의 경우, 함수 실행 결과를 targetPath에만 매핑
  if (entry.type === 'function-output' && entry.to) {
    console.log('[server] function-output 결과를 targetPath에 매핑:', entry.to, val);
    deepSet(out, entry.to, val);
  } else if (entry.type === 'function-input') {
    // function-input 타입은 중간 단계이므로 결과에 포함하지 않음
    console.log('[server] function-input 타입 무시 (중간 단계):', entry.from, '->', entry.to);
  } else if (entry.to) {
    // 일반 매핑의 경우
    deepSet(out, entry.to, val);
  } else if (entry.op === 'function' && entry.from && entry.from.startsWith('function:')) {
    // function 타입이지만 targetPath가 없는 경우 (디버그용) - 아무것도 하지 않음
    console.log('[server] function 타입 디버그 매핑 무시:', entry.from);
  }
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
    applyEntry(out, entry, payload, spec.mappings);
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