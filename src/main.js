import { createApp, reactive, provide, h } from 'vue'
import App from './App.vue'
import './styles.css'

export const createStore = () => {
  const state = reactive({
    pendingSource: null,
    mappings: [],
    selectedNode: null,  // 선택된 노드 추가
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

    // 노드 선택 함수
    selectNode(path) {
      console.log('=== selectNode 호출 ===', path)
      state.selectedNode = path
      console.log('selectedNode 설정 완료:', state.selectedNode)
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
