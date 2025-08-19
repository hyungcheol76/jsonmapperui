<template>
  <div class="function-panel">
    <!-- ✅ 선을 패널 전체를 덮는 오버레이에서 그립니다 -->
    <svg class="function-lines-overlay" aria-hidden="true">
      <defs>
        <!-- 소스->F 연결선용 파란색 화살표 -->
        <marker id="func-arrow" markerWidth="8" markerHeight="6"
                refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
          <polygon points="0 0,8 3,0 6" fill="#4a90e2" />
        </marker>
        <!-- F->타겟 연결선용 붉은색 화살표 -->
        <marker id="func-arrow-red" markerWidth="8" markerHeight="6"
                refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
          <polygon points="0 0,8 3,0 6" fill="#dc3545" />
        </marker>
        <!-- 소스 엘리먼트와 동일한 원형 점 마커 -->
        <marker id="dot-endpoint" markerWidth="10" markerHeight="10" refX="5" refY="5">
          <circle cx="5" cy="5" r="3" fill="#666666" stroke="#444444" stroke-width="1" />
        </marker>
      </defs>
      <!-- F → 타겟 연결선 그룹 (먼저 렌더링) -->
      <g class="function-to-target-group">
        <path
          v-for="m in functionToTargetMappings"
          :key="m.id"
          :d="m.path"
          class="function-to-target-line"
          stroke="#dc3545" stroke-width="2" fill="none"
          marker-end="url(#func-arrow-red)"
          @click="removeFunctionConnection(m.id)"
        />
      </g>
      
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
      
      <!-- 드래그 미리보기 선 (마지막에 렌더링하여 최상위에 표시) -->
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
    <div v-if="selectedFunction" class="context-menu-item" @click="openScriptEditor">
      <span class="script-icon">📝</span>
      스크립트 편집
    </div>
  </div>
  

    
    <!-- 스크립트 편집 모달 -->
    <div v-if="scriptModalVisible" class="script-modal-overlay" @click="closeScriptModal">
      <div class="script-modal" @click.stop>
        <!-- 디버깅: 모달 상태 표시 -->
        <div style="position: absolute; top: 5px; right: 40px; color: #666; font-size: 12px;">
          모달 열림: {{ selectedFunction?.id }}
        </div>
        <div class="script-modal-header">
          <h3>펑션 스크립트 편집</h3>
          <div class="connection-type-badge" v-if="connectionType">
            {{ connectionType }} 매핑
          </div>
          <button class="close-btn" @click="closeScriptModal">×</button>
        </div>
        <div class="script-modal-body">
          <!-- 연결 정보 표시 -->
          <div class="connection-info">
            <div class="source-params">
              <label>연결된 소스 파라미터:</label>
              <div class="param-list">
                <span v-for="param in sourceParams" :key="param" class="param-tag">
                  {{ param }}
                </span>
                <span v-if="!sourceParams.length" class="no-params">연결된 소스가 없음</span>
              </div>
            </div>
            <div class="target-params">
              <label>연결된 타겟 파라미터:</label>
              <div class="param-list">
                <span v-for="param in targetParams" :key="param" class="param-tag">
                  {{ param }}
                </span>
                <span v-if="!targetParams.length" class="no-params">연결된 타겟이 없음</span>
              </div>
            </div>
          </div>
          
          <div class="script-section">
            <label>JavaScript 코드:</label>
            <textarea 
              v-model="scriptCode" 
              class="script-editor"
              placeholder="// 파라미터:&#10;// - sourceValue: 소스에서 받은 값&#10;// - sourceParams: 연결된 소스 파라미터 객체 {employee.name: '값', ...}&#10;// - targetParams: 연결된 타겟 파라미터 객체 {user.name: '값', ...}&#10;//&#10;// ⚠️ 모든 함수는 객체를 반환해야 합니다!&#10;//&#10;// 예시 (1:1 매핑):&#10;return { result: sourceValue.toUpperCase() };&#10;&#10;// 예시 (N:1 매핑 - 여러 소스 → 하나):&#10;return { result: sourceParams['employee.name'] + ' ' + sourceParams['employee.age'] };&#10;&#10;// 예시 (1:N 매핑 - 하나 → 여러):&#10;const parts = sourceValue.split(',');&#10;return {&#10;  firstName: parts[0]?.trim(),&#10;  lastName: parts[1]?.trim(),&#10;  userAge: parts[2]?.trim(),&#10;  userCity: parts[3]?.trim()&#10;};&#10;&#10;// 🆕 예시 (계층 구조 매핑 - path 지정):&#10;const parts = sourceValue.split(',');&#10;return {&#10;  firstName: { value: parts[0]?.trim(), path: 'user.firstName' },&#10;  lastName: { value: parts[1]?.trim(), path: 'user.lastName' },&#10;  age: { value: parts[2]?.trim(), path: 'user.info.age' },&#10;  city: { value: parts[3]?.trim(), path: 'user.info.city' }&#10;};&#10;&#10;// 예시 (조건부 처리):&#10;if (sourceValue.length > 10) {&#10;  return { result: sourceValue.substring(0, 10) + '...' };&#10;} else {&#10;  return { result: sourceValue };&#10;}"
            ></textarea>
          </div>
          
          <div class="preview-section">
            <label>미리보기:</label>
            <div class="preview-input">
              <input v-model="previewInput" placeholder="테스트 입력값" />
              <button @click="testScript">테스트</button>
            </div>
            <div class="preview-output">
              <strong>결과:</strong> <span>{{ previewOutput }}</span>
            </div>
          </div>
        </div>
        <div class="script-modal-footer">
          <button @click="saveScript" class="save-btn">저장</button>
          <button @click="closeScriptModal" class="cancel-btn">취소</button>
        </div>
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
const selectedFunction = ref(null)

// 스크립트 편집 모달
const scriptModalVisible = ref(false)
const scriptCode = ref('')
const previewInput = ref('')
const previewOutput = ref('')
const connectionType = ref('')

// 드래그 상태(아이콘 이동)
const isDragging = ref(false)
const draggedFunction = ref(null)
const dragOffset = ref({ x: 0, y: 0 })

// 드래그 미리보기 선 상태
const isDraggingPreview = ref(false)
const dragPreviewPath = ref('')
const dragStartPoint = ref({ x: 0, y: 0 })

// store에서 펑션 매핑만 필터링 (매핑 정보 보존)
const functionMappings = computed(() => {
  if (!state?.mappings) return []
  const mappings = state.mappings.filter(m => m.type === 'function')
  console.log('functionMappings computed - 필터링된 매핑:', mappings)
  return mappings
})

// store에서 F → 타겟 매핑만 필터링 (매핑 정보 보존)
const functionToTargetMappings = computed(() => {
  if (!state?.mappings) return []
  const mappings = state.mappings.filter(m => m.type === 'function-to-target')
  console.log('functionToTargetMappings computed - 필터링된 매핑:', mappings)
  return mappings
})

// 선택된 펑션의 연결 정보
const sourceParams = computed(() => {
  if (!selectedFunction.value) return []
  return functionMappings.value
    .filter(m => m.functionId == selectedFunction.value.id)
    .map(m => m.sourcePath)
})

const targetParams = computed(() => {
  if (!selectedFunction.value) return []
  return functionToTargetMappings.value
    .filter(m => m.functionId == selectedFunction.value.id)
    .map(m => m.targetPath)
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
let isUpdating = false // 무한 루프 방지 플래그

function updateAllFunctionConnections() {
  // 이미 업데이트 중이면 중복 실행 방지
  if (isUpdating) {
    console.log('업데이트 중 - 중복 실행 방지')
    return
  }
  
  isUpdating = true
  console.log('=== 모든 펑션 연결선 업데이트 시작 ===')
  console.log('현재 매핑 상태:', state.mappings)
  
  try {
    // 1. 소스 → F 연결선 업데이트
    updateSourceToFunctionConnections()
    
    // 2. F → 타겟 연결선 업데이트
    updateFunctionToTargetConnections()
    
    console.log('=== 모든 펑션 연결선 업데이트 완료 ===')
    console.log('업데이트 후 매핑 상태:', state.mappings)
  } finally {
    // 업데이트 완료 후 플래그 해제
    setTimeout(() => {
      isUpdating = false
    }, 100) // 100ms 지연으로 연속 실행 방지
  }
}

/** 소스 → F 연결선 좌표 갱신 */
function updateSourceToFunctionConnections() {
  const mappings = functionMappings.value
  console.log('updateSourceToFunctionConnections - 매핑 개수:', mappings?.length)
  console.log('updateSourceToFunctionConnections - 매핑 내용:', mappings)
  
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

        // 매핑 정보를 직접 수정하지 않고 복사본 사용
        const updatedMapping = { ...mapping, path: `M ${sx} ${sy} C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}` }
        
        // store에서 해당 매핑을 업데이트
        const mappingIndex = state.mappings.findIndex(m => m.id === mapping.id)
        if (mappingIndex !== -1) {
          state.mappings[mappingIndex] = updatedMapping
        }
        
        console.log(`소스 → F 매핑 ${index + 1}: 연결선 경로 생성 완료`, {
          sourcePath: mapping.sourcePath,
          calculated: { sx, sy, ex, ey, c1x, c1y, c2x, c2y },
          path: updatedMapping.path,
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

        // 매핑 정보를 직접 수정하지 않고 복사본 사용
        const updatedMapping = { ...mapping, path: `M ${sx} ${sy} C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}` }
        
        // store에서 해당 매핑을 업데이트
        const mappingIndex = state.mappings.findIndex(m => m.id === mapping.id)
        if (mappingIndex !== -1) {
          state.mappings[mappingIndex] = updatedMapping
        }
        
        console.log(`F → 타겟 매핑 ${index + 1}: 연결선 경로 생성 완료`, {
          functionId: mapping.functionId,
          targetPath: mapping.targetPath,
          calculated: { sx, sy, ex, ey, c1x, c1y, c2x, c2y },
          path: updatedMapping.path,
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
  
  // 펑션 아이콘에서 우클릭한 경우 해당 펑션 선택
  const functionItem = event.target.closest('.function-icon-item')
  if (functionItem) {
    const functionId = functionItem.getAttribute('data-function-id')
    selectedFunction.value = functions.value.find(f => f.id == functionId)
  } else {
    selectedFunction.value = null
  }
  
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
  document.addEventListener('click', hideContextMenu, { once: true })
}

/** 컨텍스트 메뉴 숨김 */
function hideContextMenu() {
  contextMenuVisible.value = false
  selectedFunction.value = null // 선택된 펑션도 클리어
}

/** 연결 종류 분석 */
function analyzeConnectionType(functionId) {
  const functionMappings = state.mappings?.filter(m => m.functionId == functionId) || []
  
  // function-input 매핑 수 (소스 개수)
  const inputCount = functionMappings.filter(m => m.type === 'function').length
  
  // function-to-target 매핑 수 (타겟 개수)  
  const outputCount = functionMappings.filter(m => m.type === 'function-to-target').length
  
  console.log('연결 종류 분석:', { functionId, inputCount, outputCount, mappings: functionMappings })
  
  if (inputCount > 1 && outputCount === 1) {
    return 'N:1' // 여러 소스 → 하나 타겟
  } else if (inputCount === 1 && outputCount > 1) {
    return '1:N' // 하나 소스 → 여러 타겟
  } else if (inputCount === 1 && outputCount === 1) {
    return '1:1' // 하나 소스 → 하나 타겟
  } else {
    return 'N:N' // 여러 소스 → 여러 타겟
  }
}

/** 템플릿 코드 생성 */
function generateTemplateCode(connectionType, sourceParams, targetParams) {
  switch (connectionType) {
    case '1:1':
      return `// 1:1 매핑 (단일 소스 → 단일 타겟)
return { result: sourceValue.toUpperCase() };`
      
    case 'N:1':
      // 모든 소스 파라미터를 사용하여 동적으로 코드 생성
      const sourceParamExpressions = sourceParams.map(param => `sourceParams['${param}']`).join(" + ' ' + ")
      return `// N:1 매핑 (여러 소스 → 단일 타겟)
return { result: ${sourceParamExpressions} };`
      
    case '1:N':
      // 모든 타겟 파라미터를 사용하여 동적으로 코드 생성
      const targetParamExpressions = targetParams.map((param, index) => {
        const fieldName = param.split('.').pop()
        return `${fieldName}: { value: parts[${index}]?.trim(), path: '${param}' }`
      }).join(',\n  ')
      return `// 1:N 매핑 (단일 소스 → 여러 타겟)
const parts = sourceValue.split(',');
return {
  ${targetParamExpressions}
};`
      
    default:
      return `// 기본 템플릿
return { result: sourceValue };`
  }
}

/** 스크립트 편집기 열기 */
function openScriptEditor() {
  if (!selectedFunction.value) return
  
  // 연결 종류 분석
  connectionType.value = analyzeConnectionType(selectedFunction.value.id)
  console.log('연결 종류:', connectionType.value)
  
  // 매핑에서 기존 스크립트 로드
  const functionMappings = state.mappings?.filter(m => 
    m.functionId == selectedFunction.value.id && m.type === 'function'
  ) || []
  
  let scriptToLoad = ''
  
  // 기존 스크립트가 있으면 사용, 없으면 템플릿 생성
  if (functionMappings[0]?.script) {
    scriptToLoad = functionMappings[0].script
    console.log('기존 스크립트 로드:', scriptToLoad)
  } else {
    // 템플릿 코드 생성
    scriptToLoad = generateTemplateCode(connectionType.value, sourceParams.value, targetParams.value)
    console.log('템플릿 코드 생성:', scriptToLoad)
  }
  
  scriptCode.value = scriptToLoad
  previewInput.value = ''
  previewOutput.value = ''
  
  // 모달 열기 전에 전역 이벤트 리스너 일시 중단
  document.removeEventListener('mousemove', onGlobalMouseMove)
  document.removeEventListener('mouseup', onGlobalMouseUp)
  
  scriptModalVisible.value = true
  contextMenuVisible.value = false
  
  console.log('스크립트 편집기 열림:', selectedFunction.value.id, '연결 종류:', connectionType)
}

/** 스크립트 테스트 */
function testScript() {
  if (!scriptCode.value.trim()) {
    previewOutput.value = '스크립트를 입력해주세요.'
    return
  }
  
  try {
    // 개선된 함수 실행 - 여러 파라미터 지원
    const testFunction = new Function('sourceValue', 'sourceParams', 'targetParams', scriptCode.value)
    
    // 테스트용 파라미터 객체 생성 (더 현실적인 데이터)
const testSourceParams = sourceParams.value.reduce((obj, param) => {
  const fieldName = param.split('.').pop();
  // 필드 타입에 따른 테스트 데이터 생성
  if (fieldName.includes('name') || fieldName.includes('Name')) {
    obj[param] = 'John Doe';
  } else if (fieldName.includes('age')) {
    obj[param] = '30';
  } else if (fieldName.includes('email')) {
    obj[param] = 'john@example.com';
  } else if (fieldName.includes('department')) {
    obj[param] = 'IT';
  } else {
    obj[param] = `테스트_${fieldName}`;
  }
  return obj
}, {})

const testTargetParams = targetParams.value.reduce((obj, param) => {
  const fieldName = param.split('.').pop();
  obj[param] = `타겟_${fieldName}`;
  return obj
}, {})
    
    const result = testFunction(previewInput.value, testSourceParams, testTargetParams)
    
    // 객체 반환 처리
    if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
      previewOutput.value = JSON.stringify(result, null, 2)
    } else {
      previewOutput.value = String(result)
    }
  } catch (error) {
    previewOutput.value = `오류: ${error.message}`
  }
}

/** 스크립트 저장 */
function saveScript() {
  if (!selectedFunction.value) return
  
  // store의 액션을 사용하여 스크립트 저장
  if (actions?.updateFunctionScript) {
    actions.updateFunctionScript(selectedFunction.value.id, scriptCode.value)
    console.log('스크립트 저장됨 (store):', selectedFunction.value.id, scriptCode.value)
  } else {
    console.log('❌ updateFunctionScript 액션이 없음')
  }
  
  scriptModalVisible.value = false
}

/** 스크립트 모달 닫기 */
function closeScriptModal() {
  scriptModalVisible.value = false
  selectedFunction.value = null
  
  // 모달 닫힐 때 전역 클릭 이벤트 리스너 정리
  document.removeEventListener('click', hideContextMenu)
  
  // 컨텍스트 메뉴도 함께 숨김
  contextMenuVisible.value = false
  
  // 전역 이벤트 리스너 복원
  document.addEventListener('mousemove', onGlobalMouseMove)
  document.addEventListener('mouseup', onGlobalMouseUp)
  
  console.log('스크립트 편집기 닫힘')
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

/** 자동 업데이트 제거 - 무한 루프 방지 */
// watch 함수들을 제거하여 무한 루프 방지
// 필요한 경우 수동으로 updateAllFunctionConnections() 호출

// 외부에서 호출할 수 있도록 함수들을 노출
defineExpose({
  startDragPreview,
  updateDragPreview,
  stopDragPreview
})
</script>

<style scoped>
/* ========================================
   펑션 패널 관련 스타일 (핵심 기능)
   ⚠️ 이 섹션의 스타일은 펑션 연결 기능에 필수적이므로 수정 시 주의
   ======================================== */

/* 상위 패널: 자체는 이벤트 안 받음 (아래 자식만) */
.function-panel {
  position: absolute;
  inset: 0;
  pointer-events: none !important; /* 강제로 이벤트 비활성화 */
  z-index: 50; /* 서버 섹션보다 낮게 설정 */
}

/* ✅ 선은 패널 전체를 덮게 */
.function-lines-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* 기본적으로 이벤트 비활성화 */
  overflow: visible; /* 음수 좌표 허용 */
  z-index: 99999; /* 더 높은 z-index로 설정 */
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

/* 펑션 아이콘 스타일 */
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
  z-index: 1000; /* 마커보다 위에 표시 */
  pointer-events: auto; /* ✅ 아이콘 자체도 타겟 가능 */
  
  /* 연결점 표시 */
  border: 2px solid rgba(255, 255, 255, 0.3);
}

/* 펑션 포트 스타일 (실제 DOM으로 둡니다 - pseudo는 좌표 못 잡음) */
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
  background: #dc3545;
  border: 2px solid #fff;
  border-radius: 50%;
  pointer-events: none;
  z-index: 3;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* 펑션 아이콘 호버 및 드래그 상태 */
.function-icon-item:hover {
  transform: scale(1.1);
}

.function-icon-item.dragging {
  opacity: 0.8;
  transform: scale(1.2);
  z-index: 1001; /* 드래그 중일 때는 더 위에 표시 */
}

/* 드래그 미리보기 선 스타일 (소스 엘리먼트와 동일) */
.drag-preview-line {
  cursor: crosshair;
  pointer-events: none;
  transition: none; /* 드래그 중 부드러운 업데이트를 위해 transition 제거 */
}

/* 스크립트 편집 모달 스타일 */
.script-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999999; /* 연결선보다 위에 표시 */
  pointer-events: auto;
}

.script-modal {
  background: #2d2d2d;
  border-radius: 12px;
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
  position: relative;
  z-index: 10000000; /* 연결선보다 위에 표시 */
}

.script-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #444;
  background: #333;
}

.script-modal-header h3 {
  margin: 0;
  color: #e0e0e0;
  font-size: 1.2rem;
}

.connection-type-badge {
  background: #8b5cf6;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  margin-left: 10px;
}

.close-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #444;
  color: #e0e0e0;
}

.script-modal-body {
  padding: 1.5rem;
  max-height: 60vh;
  overflow-y: auto;
}

.script-section {
  margin-bottom: 1.5rem;
}

.script-section label {
  display: block;
  margin-bottom: 0.5rem;
  color: #e0e0e0;
  font-weight: 500;
}

.script-editor {
  width: 100%;
  height: 200px;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 1rem;
  color: #e0e0e0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  line-height: 1.4;
  resize: vertical;
}

.script-editor:focus {
  outline: none;
  border-color: #8b5cf6;
}

.preview-section {
  margin-bottom: 1rem;
}

.preview-section label {
  display: block;
  margin-bottom: 0.5rem;
  color: #e0e0e0;
  font-weight: 500;
}

.preview-input {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.preview-input input {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 0.5rem;
  color: #e0e0e0;
}

.preview-input button {
  background: #8b5cf6;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  color: white;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.preview-input button:hover {
  background: #7c3aed;
}

.preview-output {
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 0.75rem;
  color: #e0e0e0;
}

.script-modal-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 1rem 1.5rem;
  border-top: 1px solid #444;
  background: #333;
}

.save-btn {
  background: #28a745;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  color: white;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.save-btn:hover {
  background: #218838;
}

.cancel-btn {
  background: #6c757d;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  color: white;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.cancel-btn:hover {
  background: #5a6268;
}

/* 연결 정보 스타일 */
.connection-info {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #1a1a1a;
  border-radius: 8px;
  border: 1px solid #444;
}

.source-params, .target-params {
  margin-bottom: 1rem;
}

.source-params:last-child, .target-params:last-child {
  margin-bottom: 0;
}

.source-params label, .target-params label {
  display: block;
  margin-bottom: 0.5rem;
  color: #e0e0e0;
  font-weight: 500;
  font-size: 0.9rem;
}

.param-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.param-tag {
  background: #8b5cf6;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: monospace;
}

.no-params {
  color: #666;
  font-style: italic;
  font-size: 0.8rem;
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
  pointer-events: auto !important; /* 클릭 이벤트 허용 */
}

.function-connection-line:hover {
  stroke-dasharray: none;
  stroke-width: 3; /* 호버 시 선 굵어짐 */
}

/* F → 타겟 연결선 스타일 */
.function-to-target-line {
  vector-effect: non-scaling-stroke;
  stroke-dasharray: 3 3;
  cursor: pointer;
  transition: stroke-width 0.2s ease, stroke 0.2s ease;
  pointer-events: auto !important; /* 클릭 이벤트 허용 */
}

.function-to-target-line:hover {
  stroke-dasharray: none;
  stroke: #ff6b6b; /* 호버 시 더 밝은 붉은색 */
  stroke-width: 3; /* 호버 시 선 굵어짐 */
}
</style>
