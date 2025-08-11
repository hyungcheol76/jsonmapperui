// mapping-exporter.js (프론트 유틸)
// 사용처: 버튼 클릭 등에서 exportMappings('order') 호출
export function exportMappings(type = 'default', mappingsFromStore = []) {
  // store.state.mappings -> { from, to, op } 표준 스키마로 정규화
  const normalized = mappingsFromStore
    .filter(m => m?.sourcePath && m?.targetPath)
    .map(m => ({
      from: m.sourcePath,
      to:   m.targetPath,
      op:   m.op || 'copy',     // 선택적으로 UI에서 연산 지정 가능
      args: m.args || undefined // op 인자 (필요 시)
    }));

  const payload = {
    version: '1.0',
    type,
    mappings: normalized,
    exportDate: new Date().toISOString(),
    totalMappings: normalized.length
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mapping.${type}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

// 매핑 정보를 다양한 형식으로 내보내기
export function exportMappingsAsCSV(type = 'default', mappingsFromStore = []) {
  const normalized = mappingsFromStore
    .filter(m => m?.sourcePath && m?.targetPath)
    .map(m => ({
      from: m.sourcePath,
      to: m.targetPath,
      op: m.op || 'copy',
      args: m.args || ''
    }));

  if (normalized.length === 0) {
    alert('내보낼 매핑 정보가 없습니다.');
    return;
  }

  // CSV 헤더
  const headers = ['From', 'To', 'Operation', 'Arguments'];
  const csvContent = [
    headers.join(','),
    ...normalized.map(m => [
      `"${m.from}"`,
      `"${m.to}"`,
      `"${m.op}"`,
      `"${m.args}"`
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mapping.${type}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

// 매핑 정보를 SQL INSERT 문으로 내보내기
export function exportMappingsAsSQL(type = 'default', mappingsFromStore = [], tableName = 'mappings') {
  const normalized = mappingsFromStore
    .filter(m => m?.sourcePath && m?.targetPath)
    .map(m => ({
      from: m.sourcePath,
      to: m.targetPath,
      op: m.op || 'copy',
      args: m.args || null
    }));

  if (normalized.length === 0) {
    alert('내보낼 매핑 정보가 없습니다.');
    return;
  }

  const sqlStatements = [
    `-- Mapping Export for ${type}`,
    `-- Generated on ${new Date().toISOString()}`,
    `-- Total mappings: ${normalized.length}`,
    '',
    `CREATE TABLE IF NOT EXISTS ${tableName} (`,
    '  id INT AUTO_INCREMENT PRIMARY KEY,',
    '  source_path VARCHAR(500) NOT NULL,',
    '  target_path VARCHAR(500) NOT NULL,',
    '  operation VARCHAR(50) DEFAULT "copy",',
    '  arguments TEXT,',
    '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    ');',
    '',
    ...normalized.map(m => 
      `INSERT INTO ${tableName} (source_path, target_path, operation, arguments) VALUES ('${m.from}', '${m.to}', '${m.op}', ${m.args ? `'${m.args}'` : 'NULL'});`
    )
  ];

  const sqlContent = sqlStatements.join('\n');
  const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mapping.${type}.sql`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
} 