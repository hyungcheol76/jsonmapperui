<template>
  <div class="mapping-panel" @contextmenu.prevent="showContextMenu">
    <h2>매핑 정보</h2>
    <!-- 매핑 목록은 숨김 - F 아이콘만 표시 -->
    
    <div v-if="state.pendingSource" class="pending-mapping">
      <div class="pending-info">
        <span class="label">드래그 중:</span>
        <span class="path">{{ state.pendingSource.path }}</span>
      </div>
      <p class="hint">타겟 필드로 드래그하여 매핑을 완료하세요</p>
    </div>
    
    <!-- 함수 아이콘들 표시 -->
    <div class="function-icons-container">
      <div v-for="func in functions" 
           :key="func.id" 
           :class="['function-icon-item', { 'dragging': isDragging && draggedFunction?.id === func.id }]"
           :style="{ left: func.x + 'px', top: func.y + 'px' }"
           @mousedown="startDrag($event, func)"
           draggable="false">
        <span class="function-icon">{{ func.label }}</span>
      </div>
    </div>
  </div>
  
  <!-- 컨텍스트 메뉴 -->
  <Teleport to="body">
    <div v-if="contextMenuVisible" 
         class="context-menu" 
         :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
         @click.stop>
      <div class="context-menu-item" @click="addFunction">
        <span class="function-icon">F</span>
        펑션추가
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { inject, ref } from 'vue'

const { state, actions } = inject('store')

// 컨텍스트 메뉴 관리
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

// 함수 아이콘 목록
const functions = ref([])

// 드래그 상태 관리
const isDragging = ref(false)
const draggedFunction = ref(null)
const dragOffset = ref({ x: 0, y: 0 })

// 컨텍스트 메뉴 표시
function showContextMenu(event) {
  console.log('=== 매핑 정보 영역에서 컨텍스트 메뉴 표시 ===')
  event.preventDefault()
  event.stopPropagation()
  
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
  
  console.log('컨텍스트 메뉴 위치:', contextMenuX.value, contextMenuY.value)
  
  // 다른 곳 클릭 시 메뉴 닫기
  document.addEventListener('click', hideContextMenu, { once: true })
}

// 컨텍스트 메뉴 숨김
function hideContextMenu() {
  contextMenuVisible.value = false
}

// 드래그 시작
function startDrag(event, func) {
  console.log('드래그 시작:', func.id)
  event.preventDefault()
  
  isDragging.value = true
  draggedFunction.value = func
  
  // 마우스와 아이콘 중심점의 차이 계산
  const rect = event.target.getBoundingClientRect()
  dragOffset.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
  
  // 마우스 이벤트 리스너 추가
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

// 드래그 중
function onDrag(event) {
  if (!isDragging.value || !draggedFunction.value) return
  
  // 컨테이너 내에서의 상대 위치 계산
  const container = document.querySelector('.function-icons-container')
  const containerRect = container.getBoundingClientRect()
  
  const newX = event.clientX - containerRect.left - dragOffset.value.x
  const newY = event.clientY - containerRect.top - dragOffset.value.y
  
  // 컨테이너 경계 내로 제한
  const maxX = containerRect.width - 32
  const maxY = containerRect.height - 32
  
  draggedFunction.value.x = Math.max(0, Math.min(newX, maxX))
  draggedFunction.value.y = Math.max(0, Math.min(newY, maxY))
}

// 드래그 종료
function stopDrag() {
  console.log('드래그 종료')
  isDragging.value = false
  draggedFunction.value = null
  
  // 이벤트 리스너 제거
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// 함수 추가
function addFunction() {
  console.log('펑션 추가됨!')
  functions.value.push({
    id: Date.now(),
    label: 'F',
    x: 50,  // 초기 X 위치
    y: 50   // 초기 Y 위치
  })
  hideContextMenu()
}
</script>

<style scoped>
.mapping-panel {
  background: rgba(0,0,0,.15);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 16px;
  padding: 16px;
  height: 100%;
  width: 100%;
  overflow-y: auto;
}

.mapping-panel h2 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
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

/* 함수 아이콘 컨테이너 */
.function-icons-container {
  position: relative;
  width: 100%;
  height: calc(100% - 100px);
  margin-top: 16px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px;
  overflow: hidden;
}

.function-icon-item {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  font-weight: bold;
  font-size: 16px;
  cursor: move;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
  user-select: none;
}

.function-icon-item:hover {
  transform: scale(1.1);
}

.function-icon-item.dragging {
  opacity: 0.8;
  transform: scale(1.2);
  z-index: 1000;
}

/* 컨텍스트 메뉴 스타일 */
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 8px 0;
  z-index: 999;
  min-width: 150px;
  pointer-events: auto;
}

.context-menu-item {
  padding: 10px 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: background-color 0.2s;
  color: #333;
}

.context-menu-item:hover {
  background-color: #f5f5f5;
}

.context-menu .function-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  font-weight: bold;
  font-size: 12px;
}
</style> 