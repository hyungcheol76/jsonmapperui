<template>
  <div class="function-panel">
    <!-- ✅ 선을 패널 전체를 덮는 오버레이에서 그립니다 -->
    <svg class="function-lines-overlay" aria-hidden="true">
      <defs>
        <marker id="func-arrow" markerWidth="10" markerHeight="7"
                refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <polygon points="0 0,10 3.5,0 7" fill="#4a90e2" />
        </marker>
      </defs>
      <g class="function-connections-group">
        <path
          v-for="m in functionMappings"
          :key="m.id"
          :d="m.path"
          class="function-connection-line"
          stroke="#4a90e2" stroke-width="2" fill="none"
          marker-end="url(#func-arrow)"
          @click="removeFunctionConnection(m.id)"
        />
      </g>
    </svg>

    <!-- 아이콘 컨테이너 (기존 그대로) -->
    <div class="function-icons-container" @contextmenu.prevent="showContextMenu">
      <div
        v-for="func in functions"
        :key="func.id"
        :class="['function-icon-item', { dragging: isDragging && draggedFunction?.id === func.id }]"
        :style="{ left: func.x + 'px', top: func.y + 'px' }"
        :data-function-id="func.id"
        @mousedown="startDrag($event, func)"
        @mouseup="onFunctionMouseUp($event, func)"
        draggable="false"
      >
        <span class="function-icon">{{ func.label }}</span>
        <!-- ✅ 실제 DOM 포트 -->
        <span class="func-port" :data-func-port="String(func.id)"></span>
      </div>
    </div>

    <!-- 컨텍스트 메뉴 -->
    <div
      v-if="contextMenuVisible"
      class="context-menu"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
      @click.stop
    >
      <div class="context-menu-item" @click="addFunction">
        <span class="function-icon">F</span>
        펑션추가
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'

/**
 * 외부 store 주입
 * - state.mappings: 전체 매핑 리스트
 * - actions.addFunctionConnection(sourcePath, functionId)
 * - actions.removeMapping(id)
 */
const { state, actions } = inject('store')

// ✅ 선택/좌표 계산 유틸 추가(속성값 안전 매핑)
function findByDataAttr(name, value) {
  const sel = `[data-${name}]`
  const nodes = document.querySelectorAll(sel)
  value = String(value)
  for (const el of nodes) {
    if (el.getAttribute(`data-${name}`) === value) return el
  }
  return null
}

function centerOf(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width/2, y: r.top + r.height/2 }
}

// 펑션 아이콘 목록 (로컬 상태)
const functions = ref([])

// 컨텍스트 메뉴
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

// 드래그 상태(아이콘 이동)
const isDragging = ref(false)
const draggedFunction = ref(null)
const dragOffset = ref({ x: 0, y: 0 })

// store에서 펑션 매핑만 필터링
const functionMappings = computed(() => {
  if (!state?.mappings) return []
  return state.mappings.filter(m => m.type === 'function')
})

/** 펑션 연결 제거 (필요 시 호출) */
function removeFunctionConnection(id) {
  if (actions?.removeMapping) actions.removeMapping(id)
}

/** 소스 → 펑션 드롭 */
function onFunctionDrop(event, func) {
  event.preventDefault()
  event.stopPropagation()

  // 커스텀 드래그 상태에서 소스 경로 가져오기
  const sourcePath = state.customDragState?.sourcePath

  if (sourcePath && actions?.addFunctionConnection) {
    console.log('✅ 커스텀 드래그로 펑션 연결 성공:', sourcePath, '->', func.id)
    actions.addFunctionConnection(sourcePath, func.id)
    nextTick(updateFunctionConnections)
  } else {
    // 보조 진단 로그
    console.log('드롭 실패 - sourcePath or action 없음', {
      sourcePath,
      hasAction: !!actions?.addFunctionConnection,
      customDragState: state.customDragState
    })
  }
}

/** 소스 → 펑션 마우스업 (커스텀 드래그용) */
async function onFunctionMouseUp(event, func) {
  console.log('=== 펑션에서 마우스업 발생 ===', func.id)
  
  // 커스텀 드래그 상태 확인
  const sourcePath = state.customDragState?.sourcePath
  
  if (sourcePath && sourcePath !== func.id) {
    console.log('✅ 커스텀 드래그로 펑션 연결 성공:', sourcePath, '->', func.id)
    
    // 펑션 연결 생성
    if (actions?.addFunctionConnection) {
      actions.addFunctionConnection(sourcePath, func.id)
      
      // 상태 갱신 먼저
      console.log('상태 갱신 완료, DOM 안정화 대기 중...')
      
      // DOM이 다시 안정된 다음 선을 계산/그리기
      await nextTick()
      requestAnimationFrame(() => {
        console.log('requestAnimationFrame에서 연결선 업데이트 실행')
        updateFunctionConnections()
      })
    }
    
    // 커스텀 드래그 상태 클리어
    actions.clearCustomDragState()
  } else {
    console.log('펑션 마우스업 - 연결 조건 불충족:', {
      sourcePath,
      functionId: func.id,
      hasCustomDrag: !!state.customDragState
    })
  }
}

/** 펑션 연결선 좌표 갱신 */
function updateFunctionConnections() {
  console.log('=== 펑션 연결선 업데이트 시작 ===')
  
  const mappings = functionMappings.value
  if (!mappings?.length) {
    console.log('펑션 매핑이 없어서 연결선 업데이트 생략')
    return
  }

  // ✅ 패널 전체를 기준으로 좌표 계산
  const panelEl = document.querySelector('.function-panel')
  if (!panelEl) {
    console.log('❌ 패널 엘리먼트를 찾을 수 없음')
    return
  }
  const panelRect = panelEl.getBoundingClientRect()

  console.log('처리할 펑션 매핑 개수:', mappings.length)

  try {
    mappings.forEach((mapping, index) => {
      if (!mapping.sourcePath || !mapping.functionId) {
        console.log(`매핑 ${index + 1}: 필수 속성 누락`, mapping)
        return
      }

      // ✅ 소스/펑션 포트 DOM을 우선 사용
      const srcPort = findByDataAttr('src-port', mapping.sourcePath)
      const fnPort  = findByDataAttr('func-port', mapping.functionId)

      if (!srcPort || !fnPort) {
        console.log(`매핑 ${index + 1}: 포트 엘리먼트를 찾을 수 없음`, {
          sourcePath: mapping.sourcePath,
          functionId: mapping.functionId,
          srcPort: !!srcPort,
          fnPort: !!fnPort,
          srcPortElement: srcPort?.outerHTML
        })
        return
      }

      try {
        const { x: sxAbs, y: syAbs } = centerOf(srcPort)
        const { x: exAbs, y: eyAbs } = centerOf(fnPort)

        // ✅ 패널 상대 좌표로 변환 (포트의 정확한 위치 사용 - 음수 허용)
        const sx = sxAbs - panelRect.left
        const sy = syAbs - panelRect.top
        const ex = exAbs - panelRect.left
        const ey = eyAbs - panelRect.top

        // Cubic Bézier로 자연스러운 곡률
        const c1x = sx + (ex - sx) * 0.35
        const c1y = sy
        const c2x = sx + (ex - sx) * 0.65
        const c2y = ey

        mapping.path = `M ${sx} ${sy} C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`
        
        console.log(`매핑 ${index + 1}: 연결선 경로 생성 완료`, {
          sourcePath: mapping.sourcePath,
          calculated: { sx, sy, ex, ey, c1x, c1y, c2x, c2y },
          path: mapping.path,
          srcPortCenter: { x: sxAbs, y: syAbs },
          panelRect: { left: panelRect.left, top: panelRect.top, width: panelRect.width, height: panelRect.height },
          sourceOutside: sxAbs < panelRect.left
        })
      } catch (e) {
        console.error(`매핑 ${index + 1}: 연결선 계산 오류`, e)
      }
    })
  } catch (error) {
    console.error('updateFunctionConnections 전체 오류:', error)
  }
  
  console.log('=== 펑션 연결선 업데이트 완료 ===')
}

/** 컨텍스트 메뉴 표시 */
function showContextMenu(event) {
  event.preventDefault()
  event.stopPropagation()
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
  document.addEventListener('click', hideContextMenu, { once: true })
}

/** 컨텍스트 메뉴 숨김 */
function hideContextMenu() {
  contextMenuVisible.value = false
}

/** 아이콘 드래그 시작(이동) */
function startDrag(event, func) {
  event.preventDefault()
  isDragging.value = true
  draggedFunction.value = func

  const rect = event.currentTarget.getBoundingClientRect()
  dragOffset.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

/** 아이콘 드래그 중(이동) */
function onDrag(event) {
  if (!isDragging.value || !draggedFunction.value) return
  const container = document.querySelector('.function-icons-container')
  if (!container) return
  const containerRect = container.getBoundingClientRect()

  const newX = event.clientX - containerRect.left - dragOffset.value.x
  const newY = event.clientY - containerRect.top - dragOffset.value.y

  const maxX = containerRect.width - 32
  const maxY = containerRect.height - 32

  draggedFunction.value.x = Math.max(0, Math.min(newX, maxX))
  draggedFunction.value.y = Math.max(0, Math.min(newY, maxY))

  // 이동 시 선도 즉시 갱신
  updateFunctionConnections()
}

/** 아이콘 드래그 종료(이동) */
function stopDrag() {
  isDragging.value = false
  draggedFunction.value = null
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

/** 펑션 아이콘 추가 */
async function addFunction() {
  const newFunction = {
    id: Date.now(),
    label: 'F',
    x: 50,
    y: 50
  }
  functions.value.push(newFunction)
  hideContextMenu()

  // DOM이 안정된 다음 연결선 업데이트
  await nextTick()
  requestAnimationFrame(() => {
    console.log('새 펑션 추가 후 연결선 업데이트 실행')
    updateFunctionConnections()
  })
}

/** 마운트/언마운트 */
function handleResize() {
  // 레이아웃 변동(윈도우 리사이즈/패널 스크롤 등) 시 재계산
  updateFunctionConnections()
}

onMounted(async () => {
  // DOM이 완전히 마운트된 후 연결선 초기화
  await nextTick()
  requestAnimationFrame(() => {
    console.log('컴포넌트 마운트 후 연결선 초기화 실행')
    updateFunctionConnections()
  })
  
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

/** 변경 감지: 매핑/아이콘 변동 시 선 갱신 */
watch(functionMappings, async () => {
  await nextTick()
  requestAnimationFrame(() => {
    console.log('펑션 매핑 변경 감지 후 연결선 업데이트 실행')
    updateFunctionConnections()
  })
}, { deep: true })

watch(functions, async () => {
  await nextTick()
  requestAnimationFrame(() => {
    console.log('펑션 아이콘 변경 감지 후 연결선 업데이트 실행')
    updateFunctionConnections()
  })
}, { deep: true })
</script>

<style scoped>
/* 상위 패널: 자체는 이벤트 안 받음 (아래 자식만) */
.function-panel {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

/* ✅ 선은 패널 전체를 덮게 */
.function-lines-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none !important;
  overflow: visible; /* 음수 좌표 허용 */
  z-index: 1;
}

/* 아이콘 컨테이너: 실제 드롭 타겟 */
.function-icons-container {
  position: absolute;
  top: 100px;
  left: 16px;
  right: 16px;
  bottom: 16px;
  background: transparent;
  border: none;
  overflow: visible;
  pointer-events: auto; /* ✅ 드롭/클릭 허용 */
}

.function-icon-item {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;

  width: 32px;
  height: 32px;

  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 50%;
  font-weight: bold;
  font-size: 16px;

  cursor: move;
  user-select: none;

  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
  z-index: 2;
  pointer-events: auto; /* ✅ 아이콘 자체도 타겟 가능 */
  
  /* 연결점 표시 */
  border: 2px solid rgba(255, 255, 255, 0.3);
}

/* 포트는 실제 DOM으로 둡니다 (pseudo는 좌표 못 잡음) */
.func-port {
  position: absolute;
  left: -3px;
  top: 50%;
  width: 8px;
  height: 8px;
  transform: translateY(-50%);
  background: #764ba2;
  border: 2px solid #fff;
  border-radius: 50%;
  pointer-events: none;
  z-index: 3;
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
  background: #fff;
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

/* 점선 + 화살표 함께 사용 가능 */
.function-connection-line {
  vector-effect: non-scaling-stroke;
  stroke-dasharray: 5 5;
  cursor: pointer;
  transition: stroke-width 0.2s ease;
}

.function-connection-line:hover {
  stroke-dasharray: none;
}
</style>
