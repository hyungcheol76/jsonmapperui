<template>
  <div class="mapping-layer" ref="mappingLayer">
    <svg class="connections-svg" style="pointer-events: none;">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#4a90e2" />
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
  })

  // 드래그 디버그
  jsPlumbInstance.bind('connectionDrag', (info) => {
    console.log('[plumb] drag from:', info?.source?.getAttribute?.('data-path'))
  })
  jsPlumbInstance.bind('connectionAborted', (info) => {
    console.log('[plumb] drag aborted', info)
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

function wireNodes() {
  if (!jsPlumbInstance) return
  jsPlumbInstance.deleteEveryEndpoint()

  // DOM 안정화 후 바인딩
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
        jsPlumbInstance.makeSource(anchorEl, {
          anchor: [1, 0.5, -8, 0],
          maxConnections: -1,
          endpoint: ['Dot', { radius: 5 }],
          parameters: { path, side: 'src' },
          // 시각적 피드백
          dragOptions: { cursor: 'grab' },
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
  }, 120)
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

        // SVG 기준 상대좌표
        const startX = sourceRect.right - svgRect.left
        const startY = sourceRect.top + sourceRect.height / 2 - svgRect.top
        const endX = targetRect.left - svgRect.left
        const endY = targetRect.top + targetRect.height / 2 - svgRect.top

        // 베지어 곡선으로 연결선 경로 생성
        const midX = (startX + endX) / 2
        mapping.path = `M ${startX} ${startY} Q ${midX} ${startY} ${endX} ${endY}`
        
        console.log(`매핑 ${index + 1}: 연결선 경로 계산 완료`, mapping.path)
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
    } else {
      console.log('DOM 아직 준비되지 않음, 재시도...')
      setTimeout(waitForDOM, 100)
    }
  }
  
  // 초기 렌더 안정화 후 DOM 준비 확인
  setTimeout(waitForDOM, 250)

  window.addEventListener('resize', updateConnections, { passive: true })
  
  console.log('=== MappingLayer 컴포넌트 마운트 완료 ===')
})

watch(() => store.state.mappings, () => {
  updateConnections()
}, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateConnections)
  if (jsPlumbInstance) jsPlumbInstance.destroy()
})
</script>

<style scoped>
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

:deep(.jtk-connector) { z-index: 1000; }
:deep(.jtk-endpoint) { z-index: 1001; }

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
