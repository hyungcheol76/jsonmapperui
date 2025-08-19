<template>
  <div class="mapping-layer" ref="mappingLayer">
    <svg class="connections-svg" style="pointer-events: none;">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#4a90e2" />
        </marker>
      </defs>
      <g class="connections-group">
        <path
          v-for="mapping in directMappings"
          :key="mapping.id"
          :d="mapping.path"
          stroke="#4a90e2"
          stroke-width="2"
          fill="none"
          marker-end="url(#arrowhead)"
          class="connection-line"
          @click="removeMapping(mapping.id)"
        />
      </g>
    </svg>
  </div>
</template>

<script setup>
import { inject, onMounted, onBeforeUnmount, watch, ref, nextTick, computed } from 'vue'
import { jsPlumb } from 'jsplumb'

const store = inject('store')
const mappingLayer = ref(null)
let jsPlumbInstance = null

// 이벤트 리스너 함수들 (참조 저장용)
let resizeHandler = null
let sourceScrollHandler = null
let targetScrollHandler = null

// 직접 매핑만 필터링 (펑션 매핑 제외)
const directMappings = computed(() => {
  if (!store.state.mappings) return []
  return store.state.mappings.filter(m => !m.type || m.type === 'direct')
})

function removeMapping(id) {
  store.actions.removeMapping(id)
}

function getContainerEl() {
  return document.querySelector('.plumb-root') || document.body
}

function initJsPlumb() {
  if (jsPlumbInstance) {
    try { jsPlumbInstance.destroy() } catch {}
    jsPlumbInstance = null
  }

  const containerEl = getContainerEl()
  console.log('[plumb] use container:', containerEl)

  jsPlumbInstance = jsPlumb.getInstance({
    container: containerEl,
    connector: ['Bezier', { curviness: 50 }],
    endpoint: ['Dot', { radius: 5 }],
    paintStyle: { stroke: '#4a90e2', strokeWidth: 2 },
    hoverPaintStyle: { stroke: '#357abd', strokeWidth: 3 },
    endpointStyle: { fill: '#4a90e2', stroke: '#357abd' },
    anchor: ['Left', 'Right'],
    maxConnections: -1,
    // 드래그 미리보기 선 완전히 투명하게 설정
    dragOptions: { 
      cursor: 'grab',
      paintStyle: { stroke: 'transparent', strokeWidth: 0 },
      hoverPaintStyle: { stroke: 'transparent', strokeWidth: 0 },
      opacity: 0,
      zIndex: 0
    }
  })

  // jsPlumb 드래그 이벤트 완전 차단
  jsPlumbInstance.bind('connectionDrag', (info) => {
    // jsPlumb 드래그 미리보기 선 완전 차단
    if (info.connection) {
      info.connection.setVisible(false)
    }
    return false
  })

  jsPlumbInstance.bind('connectionAborted', (info) => {
    // 드래그 중단 시 jsPlumb 미리보기 선 완전 제거
    if (info.connection) {
      info.connection.setVisible(false)
    }
    return false
  })

  // ✅ 드랍 직전: 여기서 Store에 기록하고 기본 연결은 만들지 않음
  jsPlumbInstance.bind('beforeDrop', (info) => {
    // makeSource/makeTarget는 동적으로 endpoint를 만들기 때문에 dropEndpoint가 정확함
    const srcEp = info.sourceEndpoint || info.connection?.endpoints?.[0]
    const dstEp = info.targetEndpoint || info.dropEndpoint || info.connection?.endpoints?.[1]

    const sourcePath = srcEp?.getParameter?.('path') || info.source?.getAttribute?.('data-path')
    const targetPath = dstEp?.getParameter?.('path') || info.target?.getAttribute?.('data-path')
    const sourceSide = srcEp?.getParameter?.('side')  || info.source?.getAttribute?.('data-side')
    const targetSide = dstEp?.getParameter?.('side')  || info.target?.getAttribute?.('data-side')

    console.log('[plumb] beforeDrop:', { sourcePath, targetPath, sourceSide, targetSide })

    if (sourceSide !== 'src' || targetSide !== 'dst') return false
    if (!sourcePath || !targetPath) return false

    const exists = store.state.mappings?.some(
      m => m.sourcePath === sourcePath && m.targetPath === targetPath
    )
    if (!exists) {
      store.actions.addMapping(sourcePath, targetPath)
      // 좌표만 계산하고 Vue가 렌더링 처리
      nextTick(() => {
        console.log('새 매핑 추가 후 좌표 계산 실행')
        updateConnections()
      })
    }
    return false // 🔴 jsPlumb 기본 연결 생성 안 함(중복 방지)
  })

  wireNodes()
}

// 동적 영역 계산 함수
function calculateVisibleArea() {
  const sourceContainer = document.querySelector('.pane:first-child .tree-container')
  const targetContainer = document.querySelector('.pane:last-child .tree-container')
  const mappingLayer = document.querySelector('.mapping-layer')
  
  if (!sourceContainer || !targetContainer || !mappingLayer) {
    console.log('컨테이너 요소를 찾을 수 없음')
    return null
  }
  
  // 소스 트리 컨테이너의 전체 영역 (헤더 제외)
  const sourceRect = sourceContainer.getBoundingClientRect()
  const sourceLeft = sourceRect.left
  const sourceRight = sourceRect.left + sourceRect.width
  const sourceTop = sourceRect.top
  const sourceBottom = sourceRect.top + sourceRect.height
  
  // 타겟 트리 컨테이너의 전체 영역 (헤더 제외)
  const targetRect = targetContainer.getBoundingClientRect()
  const targetLeft = targetRect.left
  const targetRight = targetRect.left + targetRect.width
  const targetTop = targetRect.top
  const targetBottom = targetRect.top + targetRect.height
  
  // 매핑 레이어 기준으로 변환
  const mappingRect = mappingLayer.getBoundingClientRect()
  const sourceLeftRel = sourceLeft - mappingRect.left
  const sourceRightRel = sourceRight - mappingRect.left
  const sourceTopRel = sourceTop - mappingRect.top
  const sourceBottomRel = sourceBottom - mappingRect.top
  const targetLeftRel = targetLeft - mappingRect.left
  const targetRightRel = targetRight - mappingRect.left
  const targetTopRel = targetTop - mappingRect.top
  const targetBottomRel = targetBottom - mappingRect.top
  
  console.log('영역 계산:', {
    sourceLeft: sourceLeft,
    sourceRight: sourceRight,
    sourceTop: sourceTop,
    sourceBottom: sourceBottom,
    targetLeft: targetLeft,
    targetRight: targetRight,
    targetTop: targetTop,
    targetBottom: targetBottom,
    mappingLeft: mappingRect.left,
    mappingTop: mappingRect.top,
    sourceLeftRel: sourceLeftRel,
    sourceRightRel: sourceRightRel,
    sourceTopRel: sourceTopRel,
    sourceBottomRel: sourceBottomRel,
    targetLeftRel: targetLeftRel,
    targetRightRel: targetRightRel,
    targetTopRel: targetTopRel,
    targetBottomRel: targetBottomRel
  })
  
  return { 
    sourceLeftRel, sourceRightRel, sourceTopRel, sourceBottomRel,
    targetLeftRel, targetRightRel, targetTopRel, targetBottomRel
  }
}

// CSS clip-path 동적 적용
function updateClipPath() {
  const area = calculateVisibleArea()
  if (!area) return
  
  const { 
    sourceLeftRel, sourceRightRel, sourceTopRel, sourceBottomRel,
    targetLeftRel, targetRightRel, targetTopRel, targetBottomRel 
  } = area
  const mappingLayer = document.querySelector('.mapping-layer')
  
  if (mappingLayer) {
    // 트리 컨테이너 영역만 표시 (헤더 제외)
    const topBoundary = Math.min(sourceTopRel, targetTopRel)
    const bottomBoundary = Math.max(sourceBottomRel, targetBottomRel)
    
    mappingLayer.style.clipPath = `
      polygon(
        ${sourceLeftRel}px ${topBoundary}px,
        ${targetRightRel}px ${topBoundary}px,
        ${targetRightRel}px ${bottomBoundary}px,
        ${sourceLeftRel}px ${bottomBoundary}px
      )
    `
    console.log('clip-path 업데이트됨:', mappingLayer.style.clipPath)
  }
}

// 이벤트 핸들러 함수들 정의
resizeHandler = () => {
  updateConnections()
  updateClipPath()
}

sourceScrollHandler = () => {
  updateConnections()
  updateClipPath()
}

targetScrollHandler = () => {
  updateConnections()
  updateClipPath()
}

// 스크롤 이벤트 리스너 추가
function addScrollListeners() {
  const sourceContainer = document.querySelector('.pane:first-child .tree-container')
  const targetContainer = document.querySelector('.pane:last-child .tree-container')
  
  if (sourceContainer) {
    sourceContainer.addEventListener('scroll', sourceScrollHandler, { passive: true })
    console.log('소스 컨테이너 스크롤 리스너 추가됨')
  }
  
  if (targetContainer) {
    targetContainer.addEventListener('scroll', targetScrollHandler, { passive: true })
    console.log('타겟 컨테이너 스크롤 리스너 추가됨')
  }
}

// wireNodes 함수를 expose
defineExpose({
  wireNodes
})

function wireNodes() {
  if (!jsPlumbInstance) return
  jsPlumbInstance.deleteEveryEndpoint()

  // DOM 안정화 후 바인딩 (성능 최적화로 인해 지연 시간 단축)
  setTimeout(() => {
    const nodes = Array.from(document.querySelectorAll('[data-side]'))
    console.log('[plumb] wireNodes found:', nodes.length)

    nodes.forEach((node) => {
      const side = node.getAttribute('data-side')
      const path = node.getAttribute('data-path')
      const isLeaf = !!node.querySelector('.type')
      if (!isLeaf) return

      // 필요시 텍스트 엘리먼트로 교체
      const anchorEl = node

      if (side === 'src') {
        // 다이렉트 선 연결을 위해 makeSource 복원, 하지만 드래그 미리보기 선은 완전히 비활성화
        jsPlumbInstance.makeSource(anchorEl, {
          anchor: [1, 0.5, -8, 0],
          maxConnections: -1,
          endpoint: ['Dot', { radius: 5 }],
          parameters: { path, side: 'src' },
          // 드래그 미리보기 선 완전히 투명하게 설정
          dragOptions: { 
            cursor: 'grab',
            paintStyle: { stroke: 'transparent', strokeWidth: 0 },
            hoverPaintStyle: { stroke: 'transparent', strokeWidth: 0 },
            opacity: 0,
            zIndex: 0
          }
        })
      } else if (side === 'dst') {
        jsPlumbInstance.makeTarget(anchorEl, {
          anchor: [0, 0.5, -6, 0],     // 텍스트 바깥쪽(필요시 +ox로 안쪽)
          maxConnections: -1,
          endpoint: ['Dot', { radius: 5 }],
          allowLoopback: false,
          dropOptions: { hoverClass: 'drop-target' },
          parameters: { path, side: 'dst' },
        })
      }
    })

    // 위치 변화에 대비해서 한 번 리페인트
    jsPlumbInstance.recalculateOffsets()
    jsPlumbInstance.repaintEverything()
  }, 50) // 120ms → 50ms로 단축
}

// SVG 라인 좌표 계산 (DOM 조작 없음)
function updateConnections() {
  console.log('=== 직접 연결선 좌표 계산 시작 ===')
  
  const mappings = directMappings.value
  if (!mappings?.length) {
    console.log('직접 매핑이 없어서 좌표 계산 생략')
    return
  }

  const svg = document.querySelector('.connections-svg')
  if (!svg) {
    console.warn('SVG 요소를 찾을 수 없음')
    return
  }

  try {
    const svgRect = svg.getBoundingClientRect()
    console.log('처리할 직접 매핑 개수:', mappings.length)

    mappings.forEach((mapping, index) => {
      if (!mapping.sourcePath || !mapping.targetPath) {
        console.log(`매핑 ${index + 1}: 필수 속성 누락`, mapping)
        return
      }

      const sourceElement = document.querySelector(`[data-path="${mapping.sourcePath}"]`)
      const targetElement = document.querySelector(`[data-path="${mapping.targetPath}"]`)
      
      if (!sourceElement || !targetElement) {
        console.log(`매핑 ${index + 1}: 엘리먼트를 찾을 수 없음`, {
          sourcePath: mapping.sourcePath,
          targetPath: mapping.targetPath,
          sourceElement: !!sourceElement,
          targetElement: !!targetElement
        })
        return
      }

      try {
        const sourceRect = sourceElement.getBoundingClientRect()
        const targetRect = targetElement.getBoundingClientRect()
        
        // 소스/타겟 컨테이너 경계 확인
        const sourceContainer = document.querySelector('.pane:first-child .tree-container')
        const targetContainer = document.querySelector('.pane:last-child .tree-container')
        const sourceContainerRect = sourceContainer?.getBoundingClientRect()
        const targetContainerRect = targetContainer?.getBoundingClientRect()

        // 가시성 체크 및 경계 조정
        let startX, startY, endX, endY
        
        // 소스 엘리먼트가 컨테이너 밖에 있는지 확인
        if (sourceContainerRect && sourceRect.right > sourceContainerRect.right) {
          // 소스가 컨테이너 오른쪽 경계를 벗어남 - 컨테이너 경계에서 시작
          startX = sourceContainerRect.right - svgRect.left
          startY = sourceRect.top + sourceRect.height / 2 - svgRect.top
        } else {
          // 정상적인 경우
          startX = sourceRect.right - svgRect.left
          startY = sourceRect.top + sourceRect.height / 2 - svgRect.top
        }
        
        // 타겟 엘리먼트의 가시성 체크
        if (targetContainerRect) {
          // 타겟 엘리먼트가 컨테이너 상단을 벗어나는지 확인
          if (targetRect.top < targetContainerRect.top) {
            // 타겟이 컨테이너 상단을 벗어남 - 컨테이너 상단에서 끝남
            endX = targetRect.left - svgRect.left
            endY = targetContainerRect.top + targetRect.height / 2 - svgRect.top
          }
          // 타겟 엘리먼트가 컨테이너 하단을 벗어나는지 확인
          else if (targetRect.bottom > targetContainerRect.bottom) {
            // 타겟이 컨테이너 하단을 벗어남 - 컨테이너 하단에서 끝남
            endX = targetRect.left - svgRect.left
            endY = targetContainerRect.bottom - targetRect.height / 2 - svgRect.top
          }
          // 타겟 엘리먼트가 컨테이너 왼쪽을 벗어나는지 확인
          else if (targetRect.left < targetContainerRect.left) {
            // 타겟이 컨테이너 왼쪽 경계를 벗어남 - 컨테이너 경계에서 끝남
            endX = targetContainerRect.left - svgRect.left
            endY = targetRect.top + targetRect.height / 2 - svgRect.top
          }
          else {
            // 정상적인 경우
            endX = targetRect.left - svgRect.left
            endY = targetRect.top + targetRect.height / 2 - svgRect.top
          }
        } else {
          // 컨테이너를 찾을 수 없는 경우 기본값
          endX = targetRect.left - svgRect.left
          endY = targetRect.top + targetRect.height / 2 - svgRect.top
        }

        // 베지어 곡선으로 연결선 경로 생성
        const midX = (startX + endX) / 2
        mapping.path = `M ${startX} ${startY} Q ${midX} ${startY} ${endX} ${endY}`
        
        console.log(`매핑 ${index + 1}: 연결선 경로 계산 완료 (가시성 체크 적용)`, {
          originalSourceX: sourceRect.right - svgRect.left,
          adjustedSourceX: startX,
          originalTargetX: targetRect.left - svgRect.left,
          adjustedTargetX: endX,
          path: mapping.path
        })
      } catch (e) {
        console.error(`매핑 ${index + 1}: 좌표 계산 오류`, e)
      }
    })
  } catch (error) {
    console.error('updateConnections 전체 오류:', error)
  }
  
  console.log('=== 직접 연결선 좌표 계산 완료 ===')
}

onMounted(() => {
  console.log('=== MappingLayer 컴포넌트 마운트 시작 ===')
  
  // DOM 요소들이 준비되었는지 확인
  const checkDOMReady = () => {
    const mappingLayer = document.querySelector('.mapping-layer')
    const connectionsSvg = document.querySelector('.connections-svg')
    const connectionsGroup = document.querySelector('.connections-group')
    
    console.log('DOM 요소 상태:', {
      mappingLayer: !!mappingLayer,
      connectionsSvg: !!connectionsSvg,
      connectionsGroup: !!connectionsGroup
    })
    
    return mappingLayer && connectionsSvg && connectionsGroup
  }
  
  // DOM이 준비될 때까지 대기
  const waitForDOM = () => {
    if (checkDOMReady()) {
      console.log('DOM 준비 완료, 초기화 시작...')
      initJsPlumb()
      updateConnections()
      
      // 초기 clip-path 설정
      updateClipPath()
      
      // 스크롤 이벤트 리스너 추가
      addScrollListeners()
    } else {
      console.log('DOM 아직 준비되지 않음, 재시도...')
      setTimeout(waitForDOM, 100)
    }
  }
  
  // 초기 렌더 안정화 후 DOM 준비 확인
  setTimeout(waitForDOM, 250)

  window.addEventListener('resize', resizeHandler, { passive: true })
  
  console.log('=== MappingLayer 컴포넌트 마운트 완료 ===')
})

watch(() => store.state.mappings, () => {
  updateConnections()
}, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeHandler)
  
  // 스크롤 이벤트 리스너 제거
  const sourceContainer = document.querySelector('.pane:first-child .tree-container')
  const targetContainer = document.querySelector('.pane:last-child .tree-container')
  
  if (sourceContainer) {
    sourceContainer.removeEventListener('scroll', sourceScrollHandler)
  }
  
  if (targetContainer) {
    targetContainer.removeEventListener('scroll', targetScrollHandler)
  }
  
  if (jsPlumbInstance) jsPlumbInstance.destroy()
})
</script>

<style scoped>
/* ========================================
   선 연결 기능 관련 스타일 (핵심 기능)
   ⚠️ 이 섹션의 스타일은 선 연결 기능에 필수적이므로 수정 시 주의
   ======================================== */

/* 매핑 레이어 - 선 연결 기능의 핵심 */
.mapping-layer {
  position: absolute;
  inset: 0;
  pointer-events: none; /* 노드 클릭은 UI에서 처리, 여긴 선만 */
  z-index: 10;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* jsPlumb 엔드포인트가 꼭 포인터 이벤트를 받아야 함 */
:deep(.jtk-endpoint) { pointer-events: auto; }

/* jsPlumb 연결선 및 엔드포인트 z-index */
:deep(.jtk-connector) { z-index: 1000; }
:deep(.jtk-endpoint) { z-index: 1001; }

/* jsPlumb 드래그 미리보기 선 숨기기 */
:deep(.jtk-connector.jtk-dragging) { 
  display: none !important; 
  opacity: 0 !important; 
  visibility: hidden !important; 
}

/* jsPlumb 엔드포인트 스타일 */
:deep(.jtk-endpoint.jtk-endpoint-anchor) {
  background-color: #4a90e2;
  border: 2px solid #357abd;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,.2);
  transition: all .2s;
}

/* 드랍 후보 하이라이트 */
:deep(.drop-target) {
  outline: 2px solid #28a745;
}

/* SVG 라벨 */
:deep(.connection-label) {
  background: rgba(74,144,226,.9);
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
