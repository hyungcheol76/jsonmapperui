<template>
  <div class="mapping-panel">
    <h2>매핑 정보</h2>
    <div class="mapping-container">
      <div v-if="state.mappings.length === 0" class="empty-state">
        <p>매핑이 없습니다. 소스 필드를 드래그하여 타겟 필드에 드롭해보세요.</p>
      </div>
      
      <div v-else class="mapping-list">
        <div 
          v-for="mapping in state.mappings" 
          :key="mapping.id" 
          class="mapping-item"
          @click="() => actions.removeMapping(mapping.id)"
        >
          <span class="mapping-path">{{ mapping.sourcePath }} → {{ mapping.targetPath }}</span>
          <span class="remove-btn">×</span>
        </div>
      </div>
    </div>
    
    <div v-if="state.pendingSource" class="pending-mapping">
      <div class="pending-info">
        <span class="label">드래그 중:</span>
        <span class="path">{{ state.pendingSource.path }}</span>
      </div>
      <p class="hint">타겟 필드로 드래그하여 매핑을 완료하세요</p>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const { state, actions } = inject('store')
</script>

<style scoped>
.mapping-panel {
  background: rgba(0,0,0,.15);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 16px;
  padding: 16px;
  height: 100%;
  overflow-y: auto;
}

.mapping-panel h2 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  color: var(--muted);
  padding: 32px 16px;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

.mapping-container {
  position: relative;
  height: calc(100% - 60px);
  overflow: hidden;
}

.mapping-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px;
  overflow-y: auto;
  height: 100%;
}

.mapping-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.mapping-item:hover {
  background: rgba(255,255,255,.1);
}

.mapping-path {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #60a5fa;
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-btn {
  font-size: 16px;
  color: var(--text);
  cursor: pointer;
  transition: color 0.2s ease;
}

.remove-btn:hover {
  color: var(--red);
}

.pending-mapping {
  margin-top: 16px;
  padding: 12px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
}

.pending-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.pending-info .label {
  font-size: 12px;
  color: #93c5fd;
  font-weight: 500;
}

.pending-info .path {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #60a5fa;
}

.hint {
  margin: 0;
  font-size: 12px;
  color: #93c5fd;
}
</style> 