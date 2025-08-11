<template>
  <li>
    <div 
      class="node" 
      :class="{ clickable: isLeaf, selected: isSelected, dragging: isDragging }"
      :data-path="path"
      :data-side="side"
      @click="onClick"
      @mousedown="onMouseDown"
      @mouseup="onMouseUp"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <span class="key">{{ label }}</span>
      <span class="type" v-if="isLeaf">{{ value }}</span>
    </div>
    <ul v-if="!isLeaf">
      <TreeNode
        v-for="(v, k) in value"
        :key="k"
        :label="k"
        :value="v"
        :side="side"
        :path="compose(path, k)"
        :isRoot="false"
      />
    </ul>
  </li>
</template>

<script setup>
import { ref, computed, inject } from 'vue'

const props = defineProps({
  label: String,
  value: [String, Object],
  side: String,
  path: String,
  isRoot: {
    type: Boolean,
    default: true
  }
})

const store = inject('store')

const isSelected = computed(() => store.state.selectedNode === props.path)
const isDragging = ref(false)
const isLeaf = computed(() => typeof props.value === 'string')

// 드래그 상태 관리
const dragState = ref({
  isDragging: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  sourcePath: null
})

function compose(path, key) {
  return path ? `${path}.${key}` : key
}

function onMouseDown(e) {
  console.log('=== onMouseDown 시작 ===')
  console.log('마우스 다운 이벤트:', e)
  console.log('노드 정보:', {
    label: props.label,
    side: props.side,
    path: props.path,
    isLeaf: isLeaf.value
  })
  
  if (!isLeaf.value) {
    console.log('❌ 리프 노드가 아니므로 드래그 불가')
    return
  }
  
  if (props.side !== 'src') {
    console.log('❌ 소스 노드가 아니므로 드래그 불가')
    return
  }
  
  console.log('✅ 드래그 가능한 노드, 드래그 시작')
  
  // 드래그 상태 설정
  dragState.value = {
    isDragging: true,
    startX: e.clientX,
    startY: e.clientY,
    currentX: e.clientX,
    currentY: e.clientY,
    sourcePath: props.path
  }
  
  isDragging.value = true
  
  // store에 pendingSource 설정
  console.log('store.actions.setPendingSource 호출')
  store.actions.setPendingSource(props.path)
  
  // 전역 드래그 상태 설정
  window.currentDragState = {
    sourcePath: props.path,
    sourceSide: props.side,
    isActive: true
  }
  
  console.log('드래그 상태 설정 완료:', dragState.value)
  console.log('전역 드래그 상태:', window.currentDragState)
  
  // 마우스 이벤트 리스너 추가
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  
  console.log('=== onMouseDown 완료 ===')
}

function onMouseMove(e) {
  if (!dragState.value.isDragging) return
  
  dragState.value.currentX = e.clientX
  dragState.value.currentY = e.clientY
  
  // 드래그 중 시각적 피드백 (선택사항)
  console.log('드래그 중:', {
    startX: dragState.value.startX,
    startY: dragState.value.startY,
    currentX: dragState.value.currentX,
    currentY: dragState.value.currentY
  })
}

function onMouseUp(e) {
  console.log('=== onMouseUp 시작 ===')
  console.log('마우스 업 이벤트:', e)
  
  if (!dragState.value.isDragging) {
    console.log('드래그 중이 아니므로 무시')
    return
  }
  
  console.log('드래그 종료')
  
  // 드래그 상태 초기화
  dragState.value.isDragging = false
  isDragging.value = false
  
  // 전역 드래그 상태 초기화
  window.currentDragState = null
  
  // 마우스 이벤트 리스너 제거
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  
  console.log('=== onMouseUp 완료 ===')
}

function onMouseEnter(e) {
  console.log('=== onMouseEnter 시작 ===')
  console.log('마우스 진입 이벤트:', e)
  console.log('노드 정보:', {
    label: props.label,
    side: props.side,
    path: props.path,
    isLeaf: isLeaf.value
  })
  
  // 드래그 중이고 타겟 노드라면 드롭 가능 표시
  if (window.currentDragState && window.currentDragState.isActive && 
      props.side === 'dst' && isLeaf.value) {
    console.log('✅ 드롭 가능한 타겟 노드')
    console.log('현재 드래그 상태:', window.currentDragState)
    
    // 드롭 처리
    const sourcePath = window.currentDragState.sourcePath
    console.log('드롭 처리 시작:', sourcePath, '->', props.path)
    
    // store에 매핑 추가
    store.actions.addMapping(sourcePath, props.path)
    
    // 드래그 상태 초기화
    window.currentDragState = null
    dragState.value.isDragging = false
    isDragging.value = false
    
    console.log('드롭 처리 완료')
  }
  
  console.log('=== onMouseEnter 완료 ===')
}

function onMouseLeave(e) {
  console.log('=== onMouseLeave 시작 ===')
  console.log('마우스 이탈 이벤트:', e)
  console.log('=== onMouseLeave 완료 ===')
}

function onClick() {
  console.log('=== onClick 시작 ===')
  console.log('클릭된 노드 정보:', {
    label: props.label,
    side: props.side,
    path: props.path,
    isLeaf: isLeaf.value
  })
  
  if (isLeaf.value) {
    console.log('✅ 리프 노드 클릭, selectNode 호출')
    console.log('호출 전 store 상태:', store.state)
    
    store.actions.selectNode(props.path)
    
    console.log('selectNode 호출 완료')
    console.log('호출 후 store 상태:', store.state)
  } else {
    console.log('❌ 리프 노드가 아니므로 selectNode 호출 안함')
  }
  
  console.log('=== onClick 완료 ===')
}
</script>

<style scoped>
.node {
  padding: 8px 12px;
  margin: 4px 0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.node.clickable {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
}

.node.clickable:hover {
  background-color: #e9ecef;
  border-color: #dee2e6;
}

.node.selected {
  background-color: #007bff;
  color: white;
  border-color: #0056b3;
}

.node.dragging {
  background-color: #ffc107;
  color: #212529;
  border-color: #ffb300;
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.key {
  font-weight: 600;
  margin-right: 8px;
}

.type {
  color: #6c757d;
  font-size: 0.9em;
  font-style: italic;
}

.node.dragging .type {
  color: #212529;
}

ul {
  list-style: none;
  padding-left: 20px;
  margin: 0;
}

li {
  margin: 0;
  padding: 0;
}
</style>
