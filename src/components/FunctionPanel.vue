<template>
  <div class="function-panel">
    <!-- ✅ 선을 패널 전체를 덮는 오버레이에서 그립니다 -->
    <svg class="function-lines-overlay" aria-hidden="true">
      <defs>
        <marker id="func-arrow" markerWidth="10" markerHeight="7"
                refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <polygon points="0 0,10 3.5,0 7" fill="#4a90e2" />
        </marker>
        <!-- 소스 엘리먼트와 동일한 원형 점 마커 -->
        <marker id="dot-endpoint" markerWidth="10" markerHeight="10" refX="5" refY="5">
          <circle cx="5" cy="5" r="3" fill="#666666" stroke="#444444" stroke-width="1" />
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
      
      <!-- F → 타겟 연결선 그룹 -->
      <g class="function-to-target-group">
        <path
          v-for="m in functionToTargetMappings"
          :key="m.id"
          :d="m.path"
          class="function-to-target-line"
          stroke="#28a745" stroke-width="2" fill="none"
          marker-end="url(#func-arrow)"
          @click="removeFunctionConnection(m.id)"
        />
      </g>
      
      <!-- 드래그 미리보기 선 -->
      <g class="drag-preview-group" v-if="isDraggingPreview">
        <path
          :d="dragPreviewPath"
          class="drag-preview-line"
          stroke="#666666"
          stroke-width="2"
          fill="none"
          marker-start="url(#dot-endpoint)"
          marker-end="url(#dot-endpoint)"
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
        <!-- ✅ 실제 DOM 포트 (왼쪽: 소스->F, 오른쪽: F->타겟) -->
        <span class="func-port-left" :data-func-port-left="String(func.id)"></span>
        <span class="func-port-right" :data-func-port-right="String(func.id)"></span>
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

// 드래그 미리보기 선 상태
const isDraggingPreview = ref(false)
const dragPreviewPath = ref('')
const dragStartPoint = ref({ x: 0, y: 0 })

// store에서 펑션 매핑만 필터링
const functionMappings = computed(() => {
  if (!state?.mappings) return []
  return state.mappings.filter(m => m.type === 'function')
})

// store에서 F → 타겟 매핑만 필터링
const functionToTargetMappings = computed(() => {
  if (!state?.mappings) return []
  return state.mappings.filter(m => m.type === 'function-to-target')
})

/** 펑션 연결 제거 (필요 시 호출) */
function removeFunctionConnection(id) {
  if (actions?.removeMapping) actions.removeMapping(id)
}

/** 드래그 미리보기 선 시작 */
function startDragPreview(sourcePath, startX, startY) {
  console.log('=== 드래그 미리보기 선 시작 ===', sourcePath)
  
  const panelEl = document.querySelector('.function-panel')
  if (!panelEl) return
  
  const panelRect = panelEl.getBoundingClientRect()
  
  // 시작점을 패널 상대 좌표로 변환
  dragStartPoint.value = {
    x: startX - panelRect.left,
    y: startY - panelRect.top
  }
  
  isDraggingPreview.value = true
  dragPreviewPath.value = `M ${dragStartPoint.value.x} ${dragStartPoint.value.y} L ${dragStartPoint.value.x} ${dragStartPoint.value.y}`
  
  console.log('드래그 미리보기 시작점:', dragStartPoint.value)
}

/** 드래그 미리보기 선 업데이트 */
function updateDragPreview(currentX, currentY) {
  if (!isDraggingPreview.value) return
  
  const panelEl = document.querySelector('.function-panel')
  if (!panelEl) return
  
  const panelRect = panelEl.getBoundingClientRect()
  
  // 현재점을 패널 상대 좌표로 변환
  const currentPoint = {
    x: currentX - panelRect.left,
    y: currentY - panelRect.top
  }
  
  // 소스 엘리먼트와 동일한 베지어 곡선으로 자연스러운 연결선 생성
  const startX = dragStartPoint.value.x
  const startY = dragStartPoint.value.y
  const endX = currentPoint.x
  const endY = currentPoint.y
  
  // 소스 엘리먼트와 동일한 부드러운 곡선 (curviness 50과 유사)
  const distance = Math.abs(endX - startX)
  const curveOffset = distance * 0.25 // 곡률 조정
  
  const controlX = (startX + endX) / 2
  const controlY = startY + curveOffset
  
  dragPreviewPath.value = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`
}

/** 드래그 미리보기 선 종료 */
function stopDragPreview() {
  console.log('=== 드래그 미리보기 선 종료 ===')
  isDraggingPreview.value = false
  dragPreviewPath.value = ''
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
    nextTick(updateAllFunctionConnections)
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
  console.log('현재 커스텀 드래그 상태:', state.customDragState)
  
  // 커스텀 드래그 상태 확인
  const sourcePath = state.customDragState?.sourcePath
  
  if (sourcePath && sourcePath !== func.id) {
    // 소스 → F 연결 처리
    if (!sourcePath.startsWith('target:')) {
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
          updateAllFunctionConnections()
        })
      }
    }
    // 타겟 → F 연결 처리 (F → 타겟으로 저장)
    else {
      const targetPath = sourcePath.replace('target:', '')
      console.log('✅ 타겟 → F 연결 성공:', targetPath, '->', func.id)
      console.log('F → 타겟 매핑 생성 시도...')
      console.log('디버깅 - targetPath:', targetPath, 'functionId:', func.id)
      
      if (actions?.addFunctionToTargetConnection) {
        console.log('addFunctionToTargetConnection 액션 호출...')
        
        // 매핑 생성 전 상태 확인
        console.log('매핑 생성 전 전체 매핑 상태:', state.mappings)
        console.log('매핑 생성 전 F → 타겟 매핑 필터링 결과:', functionToTargetMappings.value)
        
        actions.addFunctionToTargetConnection(func.id, targetPath)
        
        // 매핑 생성 후 상태 확인
        console.log('매핑 생성 후 전체 매핑 상태:', state.mappings)
        console.log('매핑 생성 후 F → 타겟 매핑 필터링 결과:', functionToTargetMappings.value)
        
        // 연결선 업데이트 실행
        await nextTick()
        requestAnimationFrame(() => {
          console.log('requestAnimationFrame에서 F → 타겟 연결선 업데이트 실행')
          console.log('업데이트 실행 시 F → 타겟 매핑 개수:', functionToTargetMappings.value.length)
          updateAllFunctionConnections()
        })
      } else {
        console.log('❌ addFunctionToTargetConnection 액션이 없음')
      }
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

/** 모든 펑션 연결선 좌표 갱신 (소스→F + F→타겟) */
function updateAllFunctionConnections() {
  console.log('=== 모든 펑션 연결선 업데이트 시작 ===')
  
  // 1. 소스 → F 연결선 업데이트
  updateSourceToFunctionConnections()
  
  // 2. F → 타겟 연결선 업데이트
  updateFunctionToTargetConnections()
  
  console.log('=== 모든 펑션 연결선 업데이트 완료 ===')
}

/** 소스 → F 연결선 좌표 갱신 */
function updateSourceToFunctionConnections() {
  const mappings = functionMappings.value
  if (!mappings?.length) {
    console.log('소스 → F 매핑이 없어서 연결선 업데이트 생략')
    return
  }

  // ✅ 패널 전체를 기준으로 좌표 계산
  const panelEl = document.querySelector('.function-panel')
  if (!panelEl) {
    console.log('❌ 패널 엘리먼트를 찾을 수 없음')
    return
  }
  const panelRect = panelEl.getBoundingClientRect()

  console.log('처리할 소스 → F 매핑 개수:', mappings.length)

  try {
    mappings.forEach((mapping, index) => {
      if (!mapping.sourcePath || !mapping.functionId) {
        console.log(`매핑 ${index + 1}: 필수 속성 누락`, mapping)
        return
      }

      // ✅ 소스/펑션 포트 DOM을 우선 사용
      const srcPort = findByDataAttr('src-port', mapping.sourcePath)
      const fnPort  = findByDataAttr('func-port-left', mapping.functionId)

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
        
        console.log(`소스 → F 매핑 ${index + 1}: 연결선 경로 생성 완료`, {
          sourcePath: mapping.sourcePath,
          calculated: { sx, sy, ex, ey, c1x, c1y, c2x, c2y },
          path: mapping.path,
          srcPortCenter: { x: sxAbs, y: syAbs },
          panelRect: { left: panelRect.left, top: panelRect.top, width: panelRect.width, height: panelRect.height },
          sourceOutside: sxAbs < panelRect.left
        })
      } catch (e) {
        console.error(`소스 → F 매핑 ${index + 1}: 연결선 계산 오류`, e)
      }
    })
  } catch (error) {
    console.error('updateSourceToFunctionConnections 전체 오류:', error)
  }
}

/** F → 타겟 연결선 좌표 갱신 */
function updateFunctionToTargetConnections() {
  const mappings = functionToTargetMappings.value
  console.log('=== updateFunctionToTargetConnections 시작 ===')
  console.log('functionToTargetMappings.value:', functionToTargetMappings.value)
  console.log('전체 state.mappings:', state.mappings)
  
  if (!mappings?.length) {
    console.log('F → 타겟 매핑이 없어서 연결선 업데이트 생략')
    console.log('매핑이 비어있는 이유 확인:')
    console.log('- functionToTargetMappings.value:', functionToTargetMappings.value)
    console.log('- state.mappings:', state.mappings)
    console.log('- state.mappings.filter(type === "function-to-target"):', state.mappings?.filter(m => m.type === 'function-to-target'))
    return
  }

  // ✅ 패널 전체를 기준으로 좌표 계산
  const panelEl = document.querySelector('.function-panel')
  if (!panelEl) {
    console.log('❌ 패널 엘리먼트를 찾을 수 없음')
    return
  }
  const panelRect = panelEl.getBoundingClientRect()

  console.log('처리할 F → 타겟 매핑 개수:', mappings.length)
  console.log('F → 타겟 매핑 상세:', mappings)

  try {
    mappings.forEach((mapping, index) => {
      if (!mapping.functionId || !mapping.targetPath) {
        console.log(`F → 타겟 매핑 ${index + 1}: 필수 속성 누락`, mapping)
        return
      }

      console.log(`F → 타겟 매핑 ${index + 1} 처리 시작:`, mapping)

      // ✅ 펑션/타겟 포트 DOM을 우선 사용
      const fnPort = findByDataAttr('func-port-right', mapping.functionId)
      const targetPort = findByDataAttr('dst-port', mapping.targetPath)

      console.log(`F → 타겟 매핑 ${index + 1} 포트 검색 결과:`, {
        functionId: mapping.functionId,
        targetPath: mapping.targetPath,
        fnPort: !!fnPort,
        targetPort: !!targetPort,
        fnPortElement: fnPort?.outerHTML,
        targetPortElement: targetPort?.outerHTML
      })

      if (!fnPort || !targetPort) {
        console.log(`F → 타겟 매핑 ${index + 1}: 포트 엘리먼트를 찾을 수 없음`, {
          functionId: mapping.functionId,
          targetPath: mapping.targetPath,
          fnPort: !!fnPort,
          targetPort: !!targetPort
        })
        
        // 디버깅: 전체 포트 엘리먼트 확인
        console.log('전체 func-port-right 엘리먼트:', document.querySelectorAll('[data-func-port-right]'))
        console.log('전체 dst-port 엘리먼트:', document.querySelectorAll('[data-dst-port]'))
        
        // 더 자세한 검색 정보
        console.log('func-port-right 검색 쿼리:', `[data-func-port-right="${mapping.functionId}"]`)
        console.log('dst-port 검색 쿼리:', `[data-dst-port="${mapping.targetPath}"]`)
        console.log('직접 검색 결과:')
        console.log('- func-port-right:', document.querySelector(`[data-func-port-right="${mapping.functionId}"]`))
        console.log('- dst-port:', document.querySelector(`[data-dst-port="${mapping.targetPath}"]`))
        return
      }

      try {
        const { x: sxAbs, y: syAbs } = centerOf(fnPort)
        const { x: exAbs, y: eyAbs } = centerOf(targetPort)

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
        
        console.log(`F → 타겟 매핑 ${index + 1}: 연결선 경로 생성 완료`, {
          functionId: mapping.functionId,
          targetPath: mapping.targetPath,
          calculated: { sx, sy, ex, ey, c1x, c1y, c2x, c2y },
          path: mapping.path,
          fnPortCenter: { x: sxAbs, y: syAbs },
          targetPortCenter: { x: exAbs, y: eyAbs },
          panelRect: { left: panelRect.left, top: panelRect.top, width: panelRect.width, height: panelRect.height }
        })
      } catch (e) {
        console.error(`F → 타겟 매핑 ${index + 1}: 연결선 계산 오류`, e)
      }
    })
  } catch (error) {
    console.error('updateFunctionToTargetConnections 전체 오류:', error)
  }
  
  console.log('=== updateFunctionToTargetConnections 완료 ===')
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
  updateAllFunctionConnections()
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
    updateAllFunctionConnections()
  })
}

/** 전역 마우스 이벤트 핸들러 (드래그 미리보기 선용) */
function onGlobalMouseMove(event) {
  // 커스텀 드래그 상태가 있을 때만 미리보기 선 업데이트
  if (state.customDragState && isDraggingPreview.value) {
    updateDragPreview(event.clientX, event.clientY)
  }
}

function onGlobalMouseUp(event) {
  // 커스텀 드래그 상태가 있을 때만 미리보기 선 종료
  if (state.customDragState && isDraggingPreview.value) {
    stopDragPreview()
  }
}

/** 마운트/언마운트 */
function handleResize() {
  // 레이아웃 변동(윈도우 리사이즈/패널 스크롤 등) 시 재계산
  updateAllFunctionConnections()
}

onMounted(async () => {
  // DOM이 완전히 마운트된 후 연결선 초기화
  await nextTick()
  requestAnimationFrame(() => {
    console.log('컴포넌트 마운트 후 연결선 초기화 실행')
    updateAllFunctionConnections()
  })
  
  window.addEventListener('resize', handleResize)
  
  // 전역 마우스 이벤트 리스너 추가 (드래그 미리보기 선용)
  document.addEventListener('mousemove', onGlobalMouseMove)
  document.addEventListener('mouseup', onGlobalMouseUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('mousemove', onGlobalMouseMove)
  document.removeEventListener('mouseup', onGlobalMouseUp)
})

/** 변경 감지: 매핑/아이콘 변동 시 선 갱신 */
watch(functionMappings, async () => {
  await nextTick()
  requestAnimationFrame(() => {
    console.log('펑션 매핑 변경 감지 후 연결선 업데이트 실행')
    updateAllFunctionConnections()
  })
}, { deep: true })

watch(functions, async () => {
  await nextTick()
  requestAnimationFrame(() => {
    console.log('펑션 아이콘 변경 감지 후 연결선 업데이트 실행')
    updateAllFunctionConnections()
  })
}, { deep: true })

// 외부에서 호출할 수 있도록 함수들을 노출
defineExpose({
  startDragPreview,
  updateDragPreview,
  stopDragPreview
})
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
.func-port-left {
  position: absolute;
  left: -3px;
  top: 50%;
  width: 8px;
  height: 8px;
  transform: translateY(-50%);
  background: #4a90e2;
  border: 2px solid #fff;
  border-radius: 50%;
  pointer-events: none;
  z-index: 3;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.func-port-right {
  position: absolute;
  right: -3px;
  top: 50%;
  width: 8px;
  height: 8px;
  transform: translateY(-50%);
  background: #28a745;
  border: 2px solid #fff;
  border-radius: 50%;
  pointer-events: none;
  z-index: 3;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.function-icon-item:hover {
  transform: scale(1.1);
}

.function-icon-item.dragging {
  opacity: 0.8;
  transform: scale(1.2);
  z-index: 1000;
}

/* 드래그 미리보기 선 스타일 (소스 엘리먼트와 동일) */
.drag-preview-line {
  cursor: crosshair;
  pointer-events: none;
  transition: none; /* 드래그 중 부드러운 업데이트를 위해 transition 제거 */
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

/* F → 타겟 연결선 스타일 */
.function-to-target-line {
  vector-effect: non-scaling-stroke;
  stroke-dasharray: 3 3;
  cursor: pointer;
  transition: stroke-width 0.2s ease;
}

.function-to-target-line:hover {
  stroke-dasharray: none;
}
</style>
