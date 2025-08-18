<template>
  <li>
    <div
      class="node"
      :class="{ clickable: isLeaf, selected: isSelected, dragging: isDragging }"
      :data-path="path"
      :data-side="side"
      @click="onClick"
      @mousedown="onMouseDown"
    >
      <span class="key">{{ label }}</span>
      <span class="type" v-if="isLeaf">{{ value }}</span>
      
      <!-- ✅ 측정 가능한 실제 DOM 포트 (리프 노드에만) -->
      <span 
        v-if="isLeaf && side === 'src'"
        class="src-port"
        :data-src-port="path"
      ></span>
      
      <!-- ✅ 타겟 엘리먼트용 파란색 도커 (리프 노드에만) -->
      <span 
        v-if="isLeaf && side === 'dst'"
        class="dst-port"
        :data-dst-port="path"
      ></span>
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
import { computed, inject, onMounted, ref } from 'vue'

const props = defineProps({
  label: String,
  value: [String, Object],
  side: String,
  path: String,
  isRoot: { type: Boolean, default: true }
})

const store = inject('store')
const isLeaf = computed(() => typeof props.value === 'string')
const isSelected = computed(() => store.state.selectedNode === props.path)

// 커스텀 드래그 상태
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

onMounted(() => {
  // 디버그: DOM에 잘 붙었는지
  const el = document.querySelector(`[data-path="${props.path}"]`)
  console.log('[node] mounted:', { path: props.path, side: props.side, isLeaf: isLeaf.value, el })
})

function compose(path, key) {
  return path ? `${path}.${key}` : key
}

function onClick() {
  if (isLeaf.value) store.actions.selectNode(props.path)
}

function onMouseDown(event) {
  if (!isLeaf.value) return
  
  console.log('=== TreeNode 커스텀 드래그 시작 ===', props.path)
  
  // 커스텀 드래그 상태 설정
  store.actions.setCustomDragSource(props.path)
  
  isDragging.value = true
  dragOffset.value = {
    x: event.clientX,
    y: event.clientY
  }
  
  // 전역 마우스 이벤트 리스너 추가
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  
  console.log('커스텀 드래그 상태 설정됨:', props.path)
}

function onMouseMove(event) {
  if (!isDragging.value) return
  
  // 드래그 중일 때 시각적 피드백 (선택사항)
  const deltaX = event.clientX - dragOffset.value.x
  const deltaY = event.clientY - dragOffset.value.y
  
  // 드래그 거리가 일정 이상일 때만 드래그로 인식
  if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
    console.log('커스텀 드래그 중:', props.path, 'delta:', deltaX, deltaY)
  }
}

function onMouseUp(event) {
  if (!isDragging.value) return
  
  console.log('=== TreeNode 커스텀 드래그 종료 ===', props.path)
  
  // 커스텀 드래그 상태는 즉시 클리어하지 않고 약간 지연
  // FunctionPanel에서 mouseup 이벤트로 접근할 수 있도록
  setTimeout(() => {
    store.actions.clearCustomDragState()
    console.log('커스텀 드래그 상태 클리어됨 (지연)')
  }, 100)
  
  isDragging.value = false
  
  // 전역 마우스 이벤트 리스너 제거
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  
  console.log('커스텀 드래그 종료 처리 완료')
}
</script>

<style scoped>
.node {
  padding: 8px 12px;
  margin: 4px 0;
  border-radius: 6px;
  cursor: pointer;
  transition: all .2s ease;
  user-select: none;
  position: relative; /* 포트 위치 기준점 */
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
  color: #fff;
  border-color: #0056b3;
}

/* ✅ 연결 포트 스타일 (체크리스트 기준) */
.src-port {
  position: absolute;
  right: -2px;
  top: 50%;
  width: 8px;
  height: 8px;
  background: #4a90e2;
  border: 2px solid #fff;
  border-radius: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 10;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.dst-port {
  position: absolute;
  left: -2px;
  top: 50%;
  width: 8px;
  height: 8px;
  background: #4a90e2;
  border: 2px solid #fff;
  border-radius: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 10;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.key { font-weight: 600; margin-right: 8px; }
.type { color: #6c757d; font-size: .9em; font-style: italic; }

ul { list-style: none; padding-left: 20px; margin: 0; }
li { margin: 0; padding: 0; }
</style>
