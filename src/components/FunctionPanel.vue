<template>
  <div class="function-panel">
    <!-- 펑션 아이콘 컨테이너 -->
    <div class="function-icons-container" @contextmenu.prevent="showContextMenu">
      <!-- 펑션 아이콘들 -->
      <div v-for="func in functions" 
           :key="func.id" 
           :class="['function-icon-item', { 'dragging': isDragging && draggedFunction?.id === func.id }]"
           :style="{ left: func.x + 'px', top: func.y + 'px' }"
           @mousedown="startDrag($event, func)"
           draggable="false">
        <span class="function-icon">{{ func.label }}</span>
      </div>
    </div>
    
    <!-- 컨텍스트 메뉴 -->
    <div v-if="contextMenuVisible" 
         class="context-menu" 
         :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
         @click.stop>
      <div class="context-menu-item" @click="addFunction">
        <span class="function-icon">F</span>
        펑션추가
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// 펑션 아이콘 목록
const functions = ref([])

// 컨텍스트 메뉴 관리
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

// 드래그 상태 관리
const isDragging = ref(false)
const draggedFunction = ref(null)
const dragOffset = ref({ x: 0, y: 0 })

// 컨텍스트 메뉴 표시
function showContextMenu(event) {
  event.preventDefault()
  event.stopPropagation()
  
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
  
  // 다른 곳 클릭 시 메뉴 닫기
  document.addEventListener('click', hideContextMenu, { once: true })
}

// 컨텍스트 메뉴 숨김
function hideContextMenu() {
  contextMenuVisible.value = false
}

// 드래그 시작
function startDrag(event, func) {
  event.preventDefault()
  
  isDragging.value = true
  draggedFunction.value = func
  
  const rect = event.target.getBoundingClientRect()
  dragOffset.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

// 드래그 중
function onDrag(event) {
  if (!isDragging.value || !draggedFunction.value) return
  
  const container = document.querySelector('.function-icons-container')
  const containerRect = container.getBoundingClientRect()
  
  const newX = event.clientX - containerRect.left - dragOffset.value.x
  const newY = event.clientY - containerRect.top - dragOffset.value.y
  
  const maxX = containerRect.width - 32
  const maxY = containerRect.height - 32
  
  draggedFunction.value.x = Math.max(0, Math.min(newX, maxX))
  draggedFunction.value.y = Math.max(0, Math.min(newY, maxY))
}

// 드래그 종료
function stopDrag() {
  isDragging.value = false
  draggedFunction.value = null
  
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// 펑션 추가
function addFunction() {
  const newFunction = {
    id: Date.now(),
    label: 'F',
    x: 50,
    y: 50
  }
  functions.value.push(newFunction)
  hideContextMenu()
}
</script>

<style scoped>
.function-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 2;
}

.function-icons-container {
  position: absolute;
  top: 100px;
  left: 16px;
  right: 16px;
  bottom: 16px;
  background: transparent;
  border: none;
  overflow: visible;
  pointer-events: auto;
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
  z-index: 2;
}

.function-icon-item:hover {
  transform: scale(1.1);
}

.function-icon-item.dragging {
  opacity: 0.8;
  transform: scale(1.2);
  z-index: 1000;
}

.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 8px 0;
  z-index: 9999;
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