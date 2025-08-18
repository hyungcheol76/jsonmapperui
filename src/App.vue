<template>
  <div class="layout plumb-root">
    <div class="pane">
      <h2>소스 JSON</h2>
      <JsonTree side="src" :data="source" path="" />
    </div>
    
    <div class="center-panel">
      <MappingPanel />
      <FunctionPanel />
    </div>

    <MappingLayer />
    
    <div class="pane">
      <h2>타겟 JSON</h2>
      <JsonTree side="dst" :data="target" path="" />
    </div>
  </div>
  
  <!-- 메인 페이지 하단 서버 연동 영역 -->
  <div class="bottom-controls">
    <div class="button-group">
      <button class="ghost" @click="actions.clearMappings">모든 매핑 삭제</button>
      <button class="export-btn json" @click="exportAsJSON">JSON 내보내기</button>
      <button class="export-btn csv" @click="exportAsCSV">CSV 내보내기</button>
      <button class="export-btn sql" @click="exportAsSQL">SQL 내보내기</button>
    </div>
    
    <div class="server-section">
      <h4>서버 연동</h4>
      <div class="server-controls">
        <button class="server-btn" @click="testConnection">서버 연결 테스트</button>
        <button class="server-btn" @click="uploadToServer">서버에 업로드</button>
        <button class="server-btn" @click="testTransform">변환 테스트</button>
      </div>
      <div class="server-status">
        <span :class="['status-indicator', serverStatus]">{{ serverStatusText }}</span>
      </div>
    </div>
    
    <div class="mapping-info">
      <p>현재 매핑 개수: {{ store.state.mappings.length }}</p>
    </div>
  </div>
</template>

<script setup>
import { inject, watch, ref, onMounted } from 'vue'
import JsonTree from './components/JsonTree.vue'
import MappingLayer from './components/MappingLayer.vue'
import MappingPanel from './components/MappingPanel.vue'
import FunctionPanel from './components/FunctionPanel.vue'
import { exportMappings, exportMappingsAsCSV, exportMappingsAsSQL } from './utils/mapping-exporter.js'
import { testServerConnection, uploadMappingFile, transformData } from './utils/server-api.js'

const store = inject('store')

// 서버 상태 관리
const serverStatus = ref('disconnected')
const serverStatusText = ref('서버 연결 안됨')



// store 상태 변경 감지
watch(() => store.state.mappings, (newMappings) => {
  console.log('=== App.vue에서 매핑 변경 감지 ===')
  console.log('새로운 매핑 배열:', newMappings)
  console.log('매핑 개수:', newMappings.length)
}, { deep: true })

// store 상태 로깅
console.log('=== App.vue 초기화 ===')
console.log('초기 store 상태:', store.state)
console.log('초기 mappings:', store.state.mappings)

// 내보내기 함수들
function exportAsJSON() {
  exportMappings('json-mapper', store.state.mappings)
}

function exportAsCSV() {
  exportMappingsAsCSV('json-mapper', store.state.mappings)
}

function exportAsSQL() {
  exportMappingsAsSQL('json-mapper', store.state.mappings)
}



// 서버 연동 함수들
async function testConnection() {
  console.log('testConnection 함수 호출됨')
  serverStatus.value = 'connecting'
  serverStatusText.value = '연결 중...'
  
  const isConnected = await testServerConnection()
  
  if (isConnected) {
    serverStatus.value = 'connected'
    serverStatusText.value = '서버 연결됨'
  } else {
    serverStatus.value = 'disconnected'
    serverStatusText.value = '서버 연결 안됨'
  }
}

async function uploadToServer() {
  console.log('uploadToServer 함수 호출됨')
  if (store.state.mappings.length === 0) {
    alert('업로드할 매핑 정보가 없습니다.')
    return
  }
  
  try {
    // 클라이언트 매핑 데이터를 서버 형식으로 정규화
    const normalizedMappings = store.state.mappings
      .filter(m => {
        console.log('필터링 검사:', m);
        
        // function-to-target 타입은 targetPath만 있으면 됨
        if (m.type === 'function-to-target') {
          const hasTarget = !!m?.targetPath;
          console.log('function-to-target 필터링:', hasTarget);
          return hasTarget;
        }
        // function 타입은 sourcePath와 functionId가 있어야 함
        if (m.type === 'function') {
          const hasSource = !!m?.sourcePath;
          const hasFunctionId = !!m?.functionId;
          console.log('function 필터링:', hasSource && hasFunctionId);
          return hasSource && hasFunctionId;
        }
        // function-input 타입은 sourcePath만 있으면 됨
        if (m.type === 'function-input') {
          const hasSource = !!m?.sourcePath;
          console.log('function-input 필터링:', hasSource);
          return hasSource;
        }
        // 다른 타입은 sourcePath와 targetPath가 모두 있어야 함
        const hasSource = !!m?.sourcePath;
        const hasTarget = !!m?.targetPath;
        console.log('기타 타입 필터링:', hasSource && hasTarget);
        return hasSource && hasTarget;
      })
      .map(m => {
        if (m.type === 'function') {
          // 소스 → 펑션 매핑 처리 (스크립트 없이 단순 연결만)
          return {
            from: m.sourcePath,
            to: `function:${m.functionId}`,
            op: 'copy', // 단순 복사로 변경
            type: 'function-input',
            functionId: m.functionId // functionId 추가
          };
        } else if (m.type === 'function-to-target') {
          // 펑션 → 타겟 매핑 처리 (실제 스크립트 실행)
          return {
            from: `function:${m.functionId}`,
            to: m.targetPath,
            op: 'function',
            type: 'function-output',
            functionId: m.functionId,
            script: m.script || ''
          };
        } else {
          // 일반 매핑 처리
          return {
            from: m.sourcePath,
            to: m.targetPath,
            op: 'copy',
            type: 'direct'
          };
        }
      });
    
    console.log('업로드할 정규화된 매핑:', normalizedMappings);
    console.log('원본 매핑 데이터:', store.state.mappings);
    console.log('매핑 타입별 개수:', {
      function: store.state.mappings.filter(m => m.type === 'function').length,
      'function-to-target': store.state.mappings.filter(m => m.type === 'function-to-target').length,
      direct: store.state.mappings.filter(m => !m.type || m.type === 'direct').length
    });
    console.log('필터링 전 매핑 개수:', store.state.mappings.length);
    console.log('필터링 후 매핑 개수:', normalizedMappings.length);
    
    // 각 매핑의 상세 정보 출력
    store.state.mappings.forEach((mapping, index) => {
      console.log(`매핑 ${index + 1}:`, {
        id: mapping.id,
        type: mapping.type,
        sourcePath: mapping.sourcePath,
        targetPath: mapping.targetPath,
        functionId: mapping.functionId,
        script: mapping.script
      });
    });
    
    const result = await uploadMappingFile('json-mapper', normalizedMappings)
    if (result.ok) {
      alert('매핑 파일이 서버에 성공적으로 업로드되었습니다!')
    } else {
      alert(`업로드 실패: ${result.error}`)
    }
  } catch (error) {
    alert(`업로드 중 오류 발생: ${error.message}`)
  }
}

async function testTransform() {
  console.log('testTransform 함수 호출됨')
  if (store.state.mappings.length === 0) {
    alert('테스트할 매핑 정보가 없습니다.')
    return
  }
  
  try {
    // 실제 소스 데이터 사용 (하드코딩된 source 대신)
    const testPayload = {
      employee: {
        age: '30',
        city: 'Seoul',
        name: 'John Doe'
      }
    }
    
    console.log('변환 테스트 시작:', testPayload)
    const result = await transformData('json-mapper', testPayload)
    
    if (result.ok) {
      console.log('변환 결과:', result.transformed)
      alert('변환 테스트 성공! 콘솔에서 결과를 확인하세요.')
    } else {
      alert(`변환 실패: ${result.error}`)
    }
  } catch (error) {
    console.error('변환 테스트 오류:', error)
    alert(`변환 테스트 중 오류 발생: ${error.message}`)
  }
}

// 컴포넌트 마운트 시 서버 연결 상태 확인
onMounted(async () => {
  await testConnection()
})

const source = {
  employee: {
    age: 'string',
    city: 'string',
    name: 'string',
  }
}

const target = {
  user: {
    info: {
      age: 'string',
      cityaddress: 'string',
    },
    name: 'string'
  }
}
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  gap: 20px;
  padding: 20px;
}

.pane {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background: white;
}

.center-panel {
  width: 500px;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background: white;
}

.bottom-controls {
  margin-top: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-top: 1px solid #dee2e6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  width: 100%;
}

.button-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.ghost {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 20px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.ghost:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.export-btn {
  border: none;
  padding: 8px 16px;
  border-radius: 18px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  color: white;
  font-size: 13px;
}

.export-btn.json {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
}

.export-btn.json:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(40, 167, 69, 0.6);
}

.export-btn.csv {
  background: linear-gradient(135deg, #fd7e14 0%, #ffc107 100%);
  box-shadow: 0 4px 15px rgba(253, 126, 20, 0.4);
}

.export-btn.csv:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(253, 126, 20, 0.6);
}

.export-btn.sql {
  background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);
  box-shadow: 0 4px 15px rgba(111, 66, 193, 0.4);
}

.export-btn.sql:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(111, 66, 193, 0.6);
}

.server-section {
  padding: 15px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background: white;
  width: 100%;
  max-width: 500px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.server-controls {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.server-btn {
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 20px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
  margin: 0 5px;
}

.server-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(79, 70, 229, 0.6);
}

.status-indicator {
  font-weight: bold;
  padding: 8px 15px;
  border-radius: 20px;
  color: white;
}

.status-indicator.connected {
  background-color: #28a745;
}

.status-indicator.connecting {
  background-color: #ffc107;
  color: #343a40;
}

.status-indicator.disconnected {
  background-color: #dc3545;
}

.mapping-info {
  background: #e9ecef;
  color: #495057;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  border: 1px solid #dee2e6;
}

.mapping-info p {
  margin: 0;
}
</style>
