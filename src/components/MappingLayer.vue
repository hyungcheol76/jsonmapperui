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
  console.log('=== jsPlumb 초기화 시작 ===')
  
  // 기존 인스턴스 정리
  if (jsPlumbInstance) {
    jsPlumbInstance.destroy()
  }
  
  // jsPlumb 설정을 최소한으로 단순화하고 안전하게
  jsPlumbInstance = jsPlumb.getInstance({
    container: document.body,
    // 기본 설정만 사용
    connector: ['Bezier', { curviness: 50 }],
    endpoint: ['Dot', { radius: 5 }],
    paintStyle: { 
      stroke: '#4a90e2', 
      strokeWidth: 2
    },
    hoverPaintStyle: { 
      stroke: '#357abd', 
      strokeWidth: 3 
    },
    endpointStyle: { 
      fill: '#4a90e2', 
      stroke: '#357abd' 
    },
    // 연결 제한
    maxConnections: 1,
    // 앵커 설정 단순화
    anchor: ['Left', 'Right'],
    // -Infinity 에러 방지를 위한 설정
    beforeConnect: function(params) {
      console.log('=== jsPlumb beforeConnect 시작 ===')
      try {
        // 기본 검증
        if (!params.source || !params.target) {
          console.log('❌ 소스 또는 타겟이 없음')
          return false
        }
        
        // 방향 검증 (src -> dst)
        const sourceSide = params.source.getAttribute('data-side')
        const targetSide = params.target.getAttribute('data-side')
        
        console.log('연결 방향:', { sourceSide, targetSide })
        
        if (sourceSide !== 'src' || targetSide !== 'dst') {
          console.log('❌ 잘못된 연결 방향:', sourceSide, '->', targetSide)
          return false
        }
        
        console.log('✅ 올바른 연결 방향: src -> dst')
        return true
        
      } catch (error) {
        console.error('beforeConnect 오류:', error)
        return false
      }
    }
  })
  
  // 전역 접근을 위한 설정
  window.jsPlumbInstance = jsPlumbInstance
  
  // 연결선 클릭 시 삭제
  jsPlumbInstance.bind('click', (conn) => {
    console.log('=== 연결선 클릭 시 삭제 ===')
    console.log('삭제할 연결:', conn)
    console.log('연결 ID:', conn.id)
    console.log('연결 소스:', conn.source)
    console.log('연결 타겟:', conn.target)
    store.actions.removeMapping(conn.id)
    jsPlumbInstance.deleteConnection(conn)
  })

  // 새로운 연결 생성 시
  jsPlumbInstance.bind('connection', (info) => {
    console.log('=== 새로운 연결 생성 ===')
    console.log('연결 정보:', info)
    
    const sourcePath = info.source.getAttribute('data-path')
    const targetPath = info.target.getAttribute('data-path')
    const sourceSide = info.source.getAttribute('data-side')
    const targetSide = info.target.getAttribute('data-side')
    
    console.log('연결 소스 경로:', sourcePath)
    console.log('연결 타겟 경로:', targetPath)
    console.log('연결 소스 사이드:', sourceSide)
    console.log('연결 타겟 사이드:', targetSide)
    
    if (!sourcePath || !targetPath) {
      console.log('❌ 경로 정보가 없어서 연결 실패')
      return
    }
    
    if (sourceSide === 'src' && targetSide === 'dst') {
      console.log('✅ 올바른 방향의 연결! addMapping 호출...')
      store.actions.addMapping(sourcePath, targetPath)
      console.log('addMapping 호출 완료')
    } else {
      console.log('❌ 잘못된 연결 방향:', sourceSide, '->', targetSide)
    }
  })
  
  console.log('=== jsPlumb 초기화 완료 ===')
  addEndpoints()
}

function addEndpoints() {
  console.log('=== 엔드포인트 추가 시작 ===')
  
  if (!jsPlumbInstance) {
    console.error('jsPlumb 인스턴스가 없음')
    return
  }
  
  try {
    // 기존 엔드포인트 정리
    jsPlumbInstance.reset()
    console.log('기존 엔드포인트 정리 완료')

    // DOM이 완전히 렌더링될 때까지 대기
    setTimeout(() => {
      try {
        const allNodes = document.querySelectorAll('[data-side]')
        console.log(`총 ${allNodes.length}개의 data-side 속성을 가진 노드 발견`)
        
        allNodes.forEach((node, index) => {
          try {
            const side = node.getAttribute('data-side')
            const path = node.getAttribute('data-path')
            const isLeaf = !!node.querySelector('.type')
            
            console.log(`노드 ${index + 1}:`, {
              side: side,
              path: path,
              isLeaf: isLeaf,
              className: node.className
            })
            
            if (!isLeaf) {
              console.log(`노드 ${index + 1}: 리프 노드가 아니므로 스킵`)
              return
            }

            // 간단한 엔드포인트 생성
            if (side === 'src') {
              console.log(`노드 ${index + 1}: 소스(src) 엔드포인트 추가`)
              const endpoint = jsPlumbInstance.addEndpoint(node, {
                anchor: 'Right',
                isSource: true,
                maxConnections: -1,
                endpoint: ['Dot', { radius: 5 }],
                paintStyle: { fill: '#4a90e2' },
                hoverPaintStyle: { fill: '#357abd' }
              })
              console.log(`노드 ${index + 1}: 소스 엔드포인트 생성 완료:`, endpoint)
            } else if (side === 'dst') {
              console.log(`노드 ${index + 1}: 타겟(dst) 엔드포인트 추가`)
              const endpoint = jsPlumbInstance.addEndpoint(node, {
                anchor: 'Left',
                isTarget: true,
                maxConnections: -1,
                endpoint: ['Dot', { radius: 5 }],
                paintStyle: { fill: '#4a90e2' },
                hoverPaintStyle: { fill: '#357abd' }
              })
              console.log(`노드 ${index + 1}: 타겟 엔드포인트 생성 완료:`, endpoint)
            }
          } catch (error) {
            console.error(`노드 ${index + 1} 엔드포인트 추가 중 오류:`, error)
          }
        })
        
        console.log('=== 엔드포인트 추가 완료 ===')
      } catch (error) {
        console.error('엔드포인트 추가 중 오류:', error)
      }
    }, 200) // 200ms로 증가
    
  } catch (error) {
    console.error('addEndpoints 함수 실행 중 오류:', error)
  }
}

function updateConnections() {
  console.log('=== SVG 연결선 업데이트 시작 ===')
  console.log('현재 매핑 정보:', store.state.mappings)
  console.log('매핑 개수:', store.state.mappings.length)
  
  try {
    const connectionsGroup = document.querySelector('.connections-group')
    if (!connectionsGroup) {
      console.error('connections-group 요소를 찾을 수 없음')
      return
    }
    
    console.log('기존 연결선 정리 시작')
    connectionsGroup.innerHTML = ''
    console.log('기존 연결선 정리 완료')
    
    store.state.mappings.forEach((mapping, index) => {
      try {
        console.log(`매핑 ${index + 1} 처리:`, mapping)
        
        const sourceEl = document.querySelector(`[data-path="${mapping.sourcePath}"]`)
        const targetEl = document.querySelector(`[data-path="${mapping.targetPath}"]`)
        
        console.log('소스 요소:', sourceEl)
        console.log('타겟 요소:', targetEl)
        
        if (sourceEl && targetEl) {
          console.log('소스와 타겟 요소 모두 발견, 연결선 생성 시작')
          
          try {
            const sourceRect = sourceEl.getBoundingClientRect()
            const targetRect = targetEl.getBoundingClientRect()
            const svgRect = document.querySelector('.connections-svg')?.getBoundingClientRect()
            
            if (!svgRect) {
              console.warn('SVG 요소를 찾을 수 없음')
              return
            }
            
            console.log('소스 요소 좌표:', sourceRect)
            console.log('타겟 요소 좌표:', targetRect)
            console.log('SVG 좌표:', svgRect)
            
            // 좌표 유효성 검사
            if (!isFinite(sourceRect.left) || !isFinite(sourceRect.top) ||
                !isFinite(targetRect.left) || !isFinite(targetRect.top) ||
                !isFinite(svgRect.left) || !isFinite(svgRect.top)) {
              console.warn('무한대 좌표 감지, 연결선 생성 스킵')
              return
            }
            
            const startX = sourceRect.right - svgRect.left
            const startY = sourceRect.top + sourceRect.height / 2 - svgRect.top
            const endX = targetRect.left - svgRect.left
            const endY = targetRect.top + targetRect.height / 2 - svgRect.top
            
            // 계산된 좌표 유효성 검사
            if (!isFinite(startX) || !isFinite(startY) || !isFinite(endX) || !isFinite(endY)) {
              console.warn('계산된 좌표가 무한대, 연결선 생성 스킵')
              return
            }
            
            console.log('연결선 시작점:', { x: startX, y: startY })
            console.log('연결선 끝점:', { x: endX, y: endY })
            
            const controlPoint1X = startX + (endX - startX) * 0.3
            const controlPoint1Y = startY
            const controlPoint2X = startX + (endX - startX) * 0.7
            const controlPoint2Y = endY
            
            console.log('제어점 1:', { x: controlPoint1X, y: controlPoint1Y })
            console.log('제어점 2:', { x: controlPoint2X, y: controlPoint2Y })
            
            const path = `M ${startX} ${startY} C ${controlPoint1X} ${controlPoint1Y} ${controlPoint2X} ${controlPoint2Y} ${endX} ${endY}`
            console.log('생성된 SVG 경로:', path)
            
            const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
            pathElement.setAttribute('d', path)
            pathElement.setAttribute('stroke', '#4a90e2')
            pathElement.setAttribute('stroke-width', '2')
            pathElement.setAttribute('fill', 'none')
            pathElement.setAttribute('marker-end', 'url(#arrowhead)')
            pathElement.classList.add('connection-line')
            pathElement.addEventListener('click', () => {
              console.log(`매핑 ${index + 1} 클릭으로 삭제:`, mapping.id)
              removeMapping(mapping.id)
            })
            
            connectionsGroup.appendChild(pathElement)
            console.log(`매핑 ${index + 1} 연결선 생성 완료`)
            
          } catch (coordinateError) {
            console.error(`매핑 ${index + 1} 좌표 계산 오류:`, coordinateError)
          }
        } else {
          console.warn(`매핑 ${index + 1}: 소스 또는 타겟 요소를 찾을 수 없음`)
          if (!sourceEl) console.warn('소스 요소 없음:', mapping.sourcePath)
          if (!targetEl) console.warn('타겟 요소 없음:', mapping.targetPath)
        }
      } catch (mappingError) {
        console.error(`매핑 ${index + 1} 처리 중 오류:`, mappingError)
      }
    })
    
    console.log('=== SVG 연결선 업데이트 완료 ===')
  } catch (error) {
    console.error('updateConnections 함수 실행 중 오류:', error)
  }
}

onMounted(() => {
  console.log('=== MappingLayer 컴포넌트 마운트 시작 ===')
  
  // DOM이 완전히 렌더링될 때까지 충분히 대기
  setTimeout(() => {
    try {
      // jsPlumb 초기화
      console.log('jsPlumb 초기화 시작...')
      initJsPlumb()
      console.log('jsPlumb 초기화 완료')
      
      // SVG 연결선 업데이트
      console.log('SVG 연결선 업데이트 시작...')
      updateConnections()
      console.log('SVG 연결선 업데이트 완료')
      
    } catch (error) {
      console.error('MappingLayer 초기화 중 오류:', error)
    }
  }, 300) // 300ms 지연으로 DOM 완전 렌더링 대기
  
  console.log('=== MappingLayer 컴포넌트 마운트 완료 ===')
})

watch(() => store.state.mappings, (newMappings, oldMappings) => {
  console.log('=== 매핑 배열 변경 감지 ===')
  console.log('이전 매핑:', oldMappings)
  console.log('새로운 매핑:', newMappings)
  console.log('변경된 매핑 개수:', newMappings.length - (oldMappings?.length || 0))
  
  if (newMappings.length > 0) {
    console.log('새로운 매핑 상세 정보:')
    newMappings.forEach((mapping, index) => {
      console.log(`  매핑 ${index + 1}:`, {
        id: mapping.id,
        sourcePath: mapping.sourcePath,
        targetPath: mapping.targetPath,
        sourceSide: document.querySelector(`[data-path="${mapping.sourcePath}"]`)?.getAttribute('data-side'),
        targetSide: document.querySelector(`[data-path="${mapping.targetPath}"]`)?.getAttribute('data-side')
      })
    })
  }
  
  console.log('SVG 연결선 업데이트 시작...')
  updateConnections()
  console.log('SVG 연결선 업데이트 완료')
}, { deep: true })

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
  pointer-events: none;
  z-index: 10;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* jsPlumb 기본 스타일 */
:deep(.jtk-connector) {
  z-index: 1000;
}

:deep(.jtk-endpoint) {
  z-index: 1001;
}

/* 앵커 포인트 스타일 */
:deep(.jtk-endpoint.jtk-endpoint-anchor) {
  background-color: #4a90e2;
  border: 2px solid #357abd;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

:deep(.jtk-endpoint.jtk-endpoint-anchor.connected) {
  background-color: #ff8c00;
  border-color: #e67e00;
  box-shadow: 0 2px 8px rgba(255, 140, 0, 0.4);
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
