<template>
  <div class="layout">
    <div class="pane">
      <h2>소스 JSON</h2>
      <JsonTree side="src" :data="source" path="" />
    </div>
    
    <div class="center-panel">
      <MappingPanel />
    </div>

    <MappingLayer />
    
    <div class="pane">
      <h2>타겟 JSON</h2>
      <JsonTree side="dst" :data="target" path="" />
    </div>
  </div>
  <div class="footer">
    <button class="ghost" @click="actions.clearMappings">모든 매핑 삭제</button>
    <div class="debug-info">
      <p>현재 매핑 개수: {{ store.state.mappings.length }}</p>
      <p>매핑 정보: {{ JSON.stringify(store.state.mappings, null, 2) }}</p>
    </div>
  </div>
</template>

<script setup>
import { inject, watch } from 'vue'
import JsonTree from './components/JsonTree.vue'
import MappingLayer from './components/MappingLayer.vue'
import MappingPanel from './components/MappingPanel.vue'

const store = inject('store')

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
  width: 300px;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background: white;
}

.footer {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.debug-info {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
  max-width: 400px;
  word-break: break-all;
}

.debug-info p {
  margin: 5px 0;
}
</style>
