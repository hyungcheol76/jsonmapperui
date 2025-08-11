<template>
  <div class="mapping-layer" ref="mappingLayer">
    <svg class="connections-svg">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#4a90e2" />
        </marker>
      </defs>
      <g class="connections-group">
        <path 
          v-for="mapping in store.state.mappings" 
          :key="mapping.id"
          :d="mapping.path"
          stroke="#4a90e2"
          stroke-width="2"
          fill="none"
          marker-end="url(#arrowhead)"
          @click="removeMapping(mapping.id)"
          class="connection-line"
        />
      </g>
    </svg>
  </div>
</template>

<script setup>
import { inject, onMounted, onBeforeUnmount, watch, ref } from 'vue'
import { jsPlumb } from 'jsplumb'

const store = inject('store')
const mappingLayer = ref(null)
let jsPlumbInstance = null

function removeMapping(id) {
  store.actions.removeMapping(id)
}

function initJsPlumb() {
  jsPlumbInstance = jsPlumb.getInstance({
    container: document.body,
    connector: ['Bezier', { curviness: 50 }],
    endpoint: ['Dot', { radius: 5 }],
    paintStyle: { 
      stroke: '#4a90e2', 
      strokeWidth: 2, 
      outlineStroke: 'transparent', 
      outlineWidth: 1 
    },
    hoverPaintStyle: { 
      stroke: '#357abd', 
      strokeWidth: 3 
    },
    endpointStyle: { 
      fill: '#4a90e2', 
      stroke: '#357abd' 
    },
    maxConnections: 1
  })

  // 연결선 클릭 시 삭제
  jsPlumbInstance.bind('click', (conn) => {
    store.actions.removeMapping(conn.id)
    jsPlumbInstance.deleteConnection(conn)
  })

  // 새로운 연결 생성 시
  jsPlumbInstance.bind('connection', (info) => {
    const sourcePath = info.source.getAttribute('data-path')
    const targetPath = info.target.getAttribute('data-path')
    if (!sourcePath || !targetPath) return
    
    const sourceSide = info.source.getAttribute('data-side')
    const targetSide = info.target.getAttribute('data-side')
    if (sourceSide === 'src' && targetSide === 'dst') {
      store.actions.completeToTarget(targetPath)
    }
  })

  addEndpoints()
}

function addEndpoints() {
  if (!jsPlumbInstance) return
  
  jsPlumbInstance.reset()

  const allNodes = document.querySelectorAll('[data-side]')
  
  allNodes.forEach((node) => {
    const side = node.getAttribute('data-side')
    const isLeaf = !!node.querySelector('.type')
    if (!isLeaf) return

    if (side === 'src') {
      jsPlumbInstance.addEndpoint(node, {
        anchor: 'Right',
        isSource: true,
        maxConnections: -1,
        endpoint: ['Dot', { radius: 5 }],
        paintStyle: { fill: '#4a90e2' },
        hoverPaintStyle: { fill: '#357abd' }
      })
    } else if (side === 'dst') {
      jsPlumbInstance.addEndpoint(node, {
        anchor: 'Left',
        isTarget: true,
        maxConnections: -1,
        endpoint: ['Dot', { radius: 5 }],
        paintStyle: { fill: '#4a90e2' },
        hoverPaintStyle: { fill: '#357abd' }
      })
    }
  })
}

function updateConnections() {
  const connectionsGroup = document.querySelector('.connections-group')
  if (!connectionsGroup) return
  
  connectionsGroup.innerHTML = ''
  
  store.state.mappings.forEach(mapping => {
    const sourceEl = document.querySelector(`[data-path="${mapping.sourcePath}"]`)
    const targetEl = document.querySelector(`[data-path="${mapping.targetPath}"]`)
    
    if (sourceEl && targetEl) {
      const sourceRect = sourceEl.getBoundingClientRect()
      const targetRect = targetEl.getBoundingClientRect()
      const svgRect = document.querySelector('.connections-svg').getBoundingClientRect()
      
      const startX = sourceRect.right - svgRect.left
      const startY = sourceRect.top + sourceRect.height / 2 - svgRect.top
      const endX = targetRect.left - svgRect.left
      const endY = targetRect.top + targetRect.height / 2 - svgRect.top
      
      const controlPoint1X = startX + (endX - startX) * 0.3
      const controlPoint1Y = startY
      const controlPoint2X = startX + (endX - startX) * 0.7
      const controlPoint2Y = endY
      
      const path = `M ${startX} ${startY} C ${controlPoint1X} ${controlPoint1Y} ${controlPoint2X} ${controlPoint2Y} ${endX} ${endY}`
      
      const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      pathElement.setAttribute('d', path)
      pathElement.setAttribute('stroke', '#4a90e2')
      pathElement.setAttribute('stroke-width', '2')
      pathElement.setAttribute('fill', 'none')
      pathElement.setAttribute('marker-end', 'url(#arrowhead)')
      pathElement.classList.add('connection-line')
      pathElement.addEventListener('click', () => removeMapping(mapping.id))
      
      connectionsGroup.appendChild(pathElement)
    }
  })
}

onMounted(() => {
  // jsPlumb 초기화
  initJsPlumb()
  
  // SVG 연결선 업데이트
  updateConnections()
})

watch(() => store.state.mappings, updateConnections, { deep: true })

onBeforeUnmount(() => {
  if (jsPlumbInstance) {
    jsPlumbInstance.destroy()
  }
})
</script>

<style scoped>
.mapping-layer {
  position: absolute;
  inset: 0;
  pointer-events: none; /* 드래그 필요하면 auto */
  z-index: 10;
}

/* 연결선 라벨 스타일 */
:deep(.connection-label) {
  background: rgba(74, 144, 226, 0.9);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
