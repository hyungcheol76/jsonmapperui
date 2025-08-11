# JSON Mapper Transform API Server

매핑 파일을 읽어서 클라이언트 요청시 자동으로 변환된 데이터를 응답해주는 서버입니다.

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 모드 실행 (파일 변경 감지)
npm run dev

# 프로덕션 모드 실행
npm start
```

## API 엔드포인트

### 1. 변환 API
**POST** `/transform`
- 소스 payload를 매핑 규칙에 따라 타겟 payload로 변환

**요청 예시:**
```json
{
  "type": "order",
  "payload": {
    "customer": {
      "name": "John Doe",
      "age": 30
    }
  }
}
```

**응답 예시:**
```json
{
  "ok": true,
  "transformed": {
    "user": {
      "info": {
        "name": "John Doe",
        "age": 30
      }
    }
  }
}
```

### 2. 매핑 파일 업로드
**POST** `/mappings/:type`
- 매핑 파일을 서버에 업로드하여 저장

**요청 예시:**
```json
{
  "mappings": [
    {
      "from": "customer.name",
      "to": "user.info.name",
      "op": "copy"
    }
  ]
}
```

### 3. 매핑 파일 조회
**GET** `/mappings/:type`
- 특정 타입의 매핑 파일 내용 조회

### 4. 매핑 타입 목록
**GET** `/mappings`
- 사용 가능한 매핑 타입 목록 조회

### 5. 헬스 체크
**GET** `/health`
- 서버 상태 확인

## 매핑 파일 형식

매핑 파일은 `server/data/mappings/` 디렉토리에 `mapping.{type}.json` 형식으로 저장됩니다.

**예시 (`mapping.order.json`):**
```json
{
  "version": "1.0",
  "type": "order",
  "mappings": [
    {
      "from": "customer.name",
      "to": "user.info.name",
      "op": "copy"
    },
    {
      "from": "customer.age",
      "to": "user.info.age",
      "op": "number"
    }
  ]
}
```

## 지원하는 연산 (op)

- **copy**: 값 그대로 복사 (기본값)
- **const**: 상수 값 설정
- **number**: 숫자로 변환
- **boolean**: 불린으로 변환
- **string**: 문자열로 변환
- **date**: 날짜로 변환

## 배열 와일드카드 지원

- **from**: `"items[*].id"` → 배열의 모든 요소의 id 값
- **to**: `"lines[*].sku"` → 배열의 모든 요소에 sku 값 설정

## 사용 예시

1. **매핑 파일 생성**: 클라이언트에서 JSON 내보내기 기능으로 매핑 파일 다운로드
2. **파일 업로드**: 다운로드한 파일을 `server/data/mappings/` 디렉토리에 복사
3. **API 호출**: `/transform` 엔드포인트로 소스 데이터 전송하여 변환된 결과 수신

## 포트 설정

기본 포트: 3000
환경변수 `PORT`로 변경 가능:

```bash
PORT=8080 npm start
``` 