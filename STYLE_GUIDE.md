# 스타일 수정 가이드

## 선 연결 및 펑션 관련 스타일 (핵심 기능)

### ⚠️ 주의사항
이 섹션의 스타일은 선 연결 기능에 필수적이므로 수정 시 주의가 필요합니다.

### 1. 전역 스타일 (src/styles.css)

#### 선 연결 기능 관련 스타일
```css
/* ========================================
   선 연결 및 펑션 관련 스타일 (핵심 기능)
   ⚠️ 이 섹션의 스타일은 선 연결 기능에 필수적이므로 수정 시 주의
   ======================================== */

/* ✅ plumb-root: 텔레포트 타겟 및 좌표 기준점 */
.plumb-root {
  position: relative;
}

/* 매핑 레이어 - 선 연결 기능의 핵심 */
.mapping-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

/* 연결선 SVG 컨테이너 */
.connections-svg {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

/* 연결선 스타일 */
.connection-line {
  cursor: pointer;
  pointer-events: auto;
  transition: stroke-width 0.2s ease;
}

.connection-line:hover {
  stroke-width: 3;
}
```

### 2. MappingLayer 컴포넌트 (src/components/MappingLayer.vue)

#### 핵심 스타일
```css
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
```

### 3. FunctionPanel 컴포넌트 (src/components/FunctionPanel.vue)

#### 핵심 스타일
```css
/* 상위 패널: 자체는 이벤트 안 받음 (아래 자식만) */
.function-panel {
  position: absolute;
  inset: 0;
  pointer-events: none !important; /* 강제로 이벤트 비활성화 */
  z-index: 50; /* 서버 섹션보다 낮게 설정 */
}

/* 펑션 아이콘 스타일 */
.function-icon-item {
  z-index: 1000; /* 마커보다 위에 표시 */
  pointer-events: auto; /* ✅ 아이콘 자체도 타겟 가능 */
}

.function-icon-item.dragging {
  z-index: 1001; /* 드래그 중일 때는 더 위에 표시 */
}
```

## Z-Index 레이어 구조

### 레이어 순서 (위에서 아래로)
1. **z-index: 10000000** - 스크립트 모달
2. **z-index: 9999999** - 스크립트 모달 오버레이
3. **z-index: 1001** - 드래그 중인 펑션 아이콘, jsPlumb 엔드포인트
4. **z-index: 1000** - 펑션 아이콘, jsPlumb 연결선
5. **z-index: 50** - 펑션 패널
6. **z-index: 10** - 매핑 레이어
7. **z-index: 3** - 펑션 포트
8. **z-index: 1** - 펑션 라인 오버레이

## 스타일 수정 시 체크리스트

### ✅ 수정 전 확인사항
- [ ] 선 연결 기능이 정상 작동하는지 확인
- [ ] 펑션 드래그 앤 드롭이 정상 작동하는지 확인
- [ ] z-index 충돌이 없는지 확인
- [ ] pointer-events 설정이 올바른지 확인

### ✅ 수정 후 확인사항
- [ ] 소스에서 타겟으로 선 연결이 가능한지 확인
- [ ] 소스에서 펑션으로 연결이 가능한지 확인
- [ ] 펑션에서 타겟으로 연결이 가능한지 확인
- [ ] 드래그 미리보기 선이 정상 표시되는지 확인
- [ ] 기존 연결선이 정상 표시되는지 확인

## 안전한 스타일 수정 방법

### 1. 새로운 기능 추가 시
```css
/* 새로운 기능은 별도 클래스로 분리 */
.new-feature {
  /* 새로운 스타일 */
}

/* 기존 기능과 충돌하지 않도록 z-index 조정 */
.new-feature {
  z-index: 999; /* 기존 z-index와 겹치지 않도록 */
}
```

### 2. 기존 스타일 수정 시
```css
/* 기존 스타일을 복사하여 테스트 */
.original-style-backup {
  /* 기존 스타일 복사 */
}

/* 수정된 스타일 적용 */
.original-style {
  /* 수정된 스타일 */
}
```

### 3. CSS 변수 활용
```css
:root {
  --mapping-layer-z-index: 10;
  --function-panel-z-index: 50;
  --function-icon-z-index: 1000;
}

.mapping-layer {
  z-index: var(--mapping-layer-z-index);
}
```

## 문제 해결 가이드

### 선 연결이 안 되는 경우
1. `pointer-events` 설정 확인
2. `z-index` 충돌 확인
3. `position` 속성 확인

### 드래그 미리보기 선이 안 보이는 경우
1. `z-index`가 너무 낮은지 확인
2. `overflow: hidden` 설정 확인
3. 부모 요소의 `position` 확인

### 펑션 연결이 안 되는 경우
1. 펑션 포트의 `pointer-events` 확인
2. 펑션 아이콘의 `z-index` 확인
3. 드래그 이벤트 핸들러 확인 