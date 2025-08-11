<template>
  <div class="mapping-layer" ref="mappingLayer">
    <svg class="connections-svg">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#4a90e2" />
        </marker>
      </defs>
      <g class="connections-group">
        <path
          v-for="m in store.state.mappings"
          :key="m.id"
          :d="m.path"
          stroke="#4a90e2"
          stroke-width="2"
          fill="none"
          marker-end="url(#arrowhead)"
          class="connection-line"
          @click="removeMapping(m.id)"
        />
      </g>
    </svg>
  </div>
</template>

<script setup>
import { inject, onMounted, onBeforeUnmount, watch, ref, nextTick } from 'vue'
import { jsPlumb } from 'jsplumb'

const store = inject('store')
const mappingLayer = ref(null)
let jsPlumbInstance = null

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
      // 선은 우리가 SVG로 그림
      nextTick(() => updateConnections())
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

// SVG 라인 다시 그리기
function updateConnections() {
  const group = document.querySelector('.connections-group')
  const svg = document.querySelector('.connections-svg')
  if (!group || !svg) return

  group.innerHTML = ''
  const svgRect = svg.getBoundingClientRect()

  store.state.mappings.forEach((m) => {
    const s = document.querySelector(`[data-path="${m.sourcePath}"]`)
    const t = document.querySelector(`[data-path="${m.targetPath}"]`)
    if (!s || !t) return

    const sr = s.getBoundingClientRect()
    const tr = t.getBoundingClientRect()

    const startX = sr.right - svgRect.left
    const startY = sr.top + sr.height / 2 - svgRect.top
    const endX   = tr.left - svgRect.left
    const endY   = tr.top + tr.height / 2 - svgRect.top

    const c1x = startX + (endX - startX) * 0.3
    const c1y = startY
    const c2x = startX + (endX - startX) * 0.7
    const c2y = endY

    const d = `M ${startX} ${startY} C ${c1x} ${c1y} ${c2x} ${c2y} ${endX} ${endY}`
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    p.setAttribute('d', d)
    p.setAttribute('stroke', '#4a90e2')
    p.setAttribute('stroke-width', '2')
    p.setAttribute('fill', 'none')
    p.setAttribute('marker-end', 'url(#arrowhead)')
    p.classList.add('connection-line')
    p.addEventListener('click', () => removeMapping(m.id))
    group.appendChild(p)

    // 필요하면 Store에 path 저장
    m.path = d
  })
}

onMounted(() => {
  // 초기 렌더 안정화 후 jsPlumb 구성
  setTimeout(() => {
    initJsPlumb()
    updateConnections()
  }, 250)

  window.addEventListener('resize', updateConnections, { passive: true })
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
