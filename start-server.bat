@echo off
echo JSON Mapper Transform API Server 시작...
echo.

cd server

echo 의존성 설치 중...
npm install

echo.
echo 서버 시작 중...
echo 포트: 3000
echo URL: http://localhost:3000
echo.

npm start

pause 