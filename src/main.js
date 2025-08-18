import { createApp, reactive, provide, h } from 'vue'
import App from './App.vue'
import './styles.css'

export const createStore = () => {
  const state = reactive({
    pendingSource: null,
    mappings: [],
    selectedNode: null,  // 선택된 노드 추가
    customDragState: null, // 커스텀 드래그 상태 추가
  })

  const actions = {
    beginFromSource(path) { 
      console.log('=== beginFromSource 호출 ===', path)
      state.pendingSource = { path } 
    },

    // TreeNode에서 사용하는 setPendingSource 함수
    setPendingSource(path) {
      console.log('=== setPendingSource 호출 ===', path)
      state.pendingSource = { path }
      console.log('pendingSource 설정 완료:', state.pendingSource)
    },

    completeToTarget(targetPath) {
      console.log('=== completeToTarget 호출 ===', targetPath)
      console.log('현재 pendingSource:', state.pendingSource)
      
      if (!state.pendingSource) {
        console.log('❌ pendingSource가 없어서 매핑 추가 실패')
        return
      }
      
      const sourcePath = state.pendingSource.path
      console.log('소스 경로:', sourcePath, '타겟 경로:', targetPath)
      
      const exists = state.mappings.some(m => m.sourcePath === sourcePath && m.targetPath === targetPath)
      if (!exists) {
        const newMapping = { id: `${sourcePath}__${targetPath}`, sourcePath, targetPath }
        console.log('새로운 매핑 추가:', newMapping)
        state.mappings.push(newMapping)
        console.log('매핑 추가 후 mappings 배열:', state.mappings)
      } else {
        console.log('이미 존재하는 매핑:', sourcePath, '->', targetPath)
      }
      state.pendingSource = null
    },

    // jsPlumb 연결 시 직접 매핑 추가하는 함수
    addMapping(sourcePath, targetPath) {
      console.log('=== addMapping 호출 ===')
      console.log('소스 경로:', sourcePath, '타겟 경로:', targetPath)
      
      if (!sourcePath || !targetPath) {
        console.log('❌ 경로 정보가 없어서 매핑 추가 실패')
        return
      }
      
      const exists = state.mappings.some(m => m.sourcePath === sourcePath && m.targetPath === targetPath)
      if (!exists) {
        const newMapping = { id: `${sourcePath}__${targetPath}`, sourcePath, targetPath }
        console.log('새로운 매핑 추가:', newMapping)
        state.mappings.push(newMapping)
        console.log('매핑 추가 후 mappings 배열:', state.mappings)
        console.log('매핑 개수:', state.mappings.length)
      } else {
        console.log('이미 존재하는 매핑:', sourcePath, '->', targetPath)
      }
    },

    removeMapping(id) {
      console.log('=== removeMapping 호출 ===', id)
      const beforeCount = state.mappings.length
      state.mappings = state.mappings.filter(m => m.id !== id)
      const afterCount = state.mappings.length
      console.log(`매핑 제거: ${beforeCount} -> ${afterCount}`)
      console.log('제거 후 mappings 배열:', state.mappings)
    },

    // 모든 매핑 삭제
    clearMappings() {
      console.log('=== clearMappings 호출 ===')
      const beforeCount = state.mappings.length
      state.mappings = []
      console.log(`모든 매핑 삭제: ${beforeCount} -> 0`)
      console.log('매핑 배열 초기화 완료')
    },

    // 소스 → 펑션 연결 생성
    addFunctionConnection(sourcePath, functionId) {
      console.log('=== addFunctionConnection 호출 ===')
      console.log('소스 경로:', sourcePath, '펑션 ID:', functionId)
      
      if (!sourcePath || !functionId) {
        console.log('❌ 경로 정보가 없어서 펑션 연결 생성 실패')
        return
      }
      
      const exists = state.mappings.some(m => 
        m.sourcePath === sourcePath && 
        m.functionId === functionId
      )
      
      if (!exists) {
        const newMapping = { 
          id: `func_${sourcePath}__${functionId}`, 
          type: 'function',
          sourcePath, 
          functionId,
          script: '' // 기본 스크립트 초기화
        }
        console.log('새로운 펑션 연결 생성:', newMapping)
        state.mappings.push(newMapping)
        console.log('펑션 연결 추가 후 mappings 배열:', state.mappings)
      } else {
        console.log('이미 존재하는 펑션 연결:', sourcePath, '->', functionId)
      }
    },

    // F → 타겟 연결 생성
    addFunctionToTargetConnection(functionId, targetPath) {
      console.log('=== addFunctionToTargetConnection 호출 ===')
      console.log('펑션 ID:', functionId, '타겟 경로:', targetPath)
      
      if (!functionId || !targetPath) {
        console.log('❌ 경로 정보가 없어서 F → 타겟 연결 생성 실패')
        return
      }
      
      const exists = state.mappings.some(m => 
        m.functionId === functionId && 
        m.targetPath === targetPath &&
        m.type === 'function-to-target'
      )
      
      if (!exists) {
        const newMapping = { 
          id: `func2target_${functionId}__${targetPath}`, 
          type: 'function-to-target',
          functionId, 
          targetPath 
        }
        console.log('새로운 F → 타겟 연결 생성:', newMapping)
        state.mappings.push(newMapping)
        console.log('F → 타겟 연결 추가 후 mappings 배열:', state.mappings)
      } else {
        console.log('이미 존재하는 F → 타겟 연결:', functionId, '->', targetPath)
      }
    },

    // 커스텀 드래그 시작 시 소스 경로 설정
    setCustomDragSource(sourcePath) {
      console.log('=== setCustomDragSource 호출 ===', sourcePath)
      state.customDragState = { sourcePath }
    },

    // 커스텀 드래그 종료 시 상태 클리어
    clearCustomDragState() {
      console.log('=== clearCustomDragState 호출 ===')
      state.customDragState = null
    },

    // 노드 선택 함수
    selectNode(path) {
      console.log('=== selectNode 호출 ===', path)
      state.selectedNode = path
      console.log('selectedNode 설정 완료:', state.selectedNode)
    },

    // 펑션 스크립트 업데이트
    updateFunctionScript(functionId, script) {
      console.log('=== updateFunctionScript 호출 ===')
      console.log('펑션 ID:', functionId, '스크립트:', script)
      
      // 해당 펑션의 모든 매핑에서 스크립트 업데이트
      state.mappings.forEach(mapping => {
        if (mapping.functionId == functionId) {
          mapping.script = script
          console.log('스크립트 업데이트됨:', mapping.id, script)
        }
      })
    }
  }

  return { state, actions }
}

const app = createApp({
  setup() {
    const store = createStore()
    provide('store', store)
    return () => h(App)
  }
})

app.mount('#app')
