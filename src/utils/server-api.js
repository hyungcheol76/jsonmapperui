// server-api.js - 서버와 연동하는 API 함수들

const SERVER_URL = 'http://localhost:3000';

// 서버 상태 확인
export async function checkServerHealth() {
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('서버 연결 실패:', error);
    return { ok: false, error: error.message };
  }
}

// 사용 가능한 매핑 타입 목록 조회
export async function getMappingTypes() {
  try {
    const response = await fetch(`${SERVER_URL}/mappings`);
    return await response.json();
  } catch (error) {
    console.error('매핑 타입 조회 실패:', error);
    return { types: [] };
  }
}

// 특정 타입의 매핑 파일 조회
export async function getMappingFile(type) {
  try {
    const response = await fetch(`${SERVER_URL}/mappings/${type}`);
    return await response.json();
  } catch (error) {
    console.error(`매핑 파일 조회 실패 (${type}):`, error);
    return null;
  }
}

// 매핑 파일을 서버에 업로드
export async function uploadMappingFile(type, mappings) {
  try {
    const response = await fetch(`${SERVER_URL}/mappings/${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mappings }),
    });
    return await response.json();
  } catch (error) {
    console.error(`매핑 파일 업로드 실패 (${type}):`, error);
    return { ok: false, error: error.message };
  }
}

// 데이터 변환 요청
export async function transformData(type, payload) {
  try {
    const response = await fetch(`${SERVER_URL}/transform`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, payload }),
    });
    return await response.json();
  } catch (error) {
    console.error(`데이터 변환 실패 (${type}):`, error);
    return { ok: false, error: error.message };
  }
}

// 서버 연결 테스트
export async function testServerConnection() {
  const health = await checkServerHealth();
  if (health.ok) {
    console.log('✅ 서버 연결 성공');
    return true;
  } else {
    console.log('❌ 서버 연결 실패');
    return false;
  }
} 