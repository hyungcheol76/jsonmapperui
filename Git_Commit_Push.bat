@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

:: 커밋 메시지를 매개변수로 받음
set "commit_message=%~1"

if "%commit_message%"=="" (
    echo 커밋 메시지를 입력하세요.
    echo 사용법: %~nx0 "커밋 메시지"
    exit /b 1
)

:: Git이 초기화되어 있는지 확인
if not exist ".git" (
    echo Initializing git repository...
    git init
    git branch -M main
)

:: 원격 저장소가 설정되어 있는지 확인
git remote -v | findstr "origin" > nul
if errorlevel 1 (
    echo Remote repository not found. Please set up remote repository first.
    echo Example: git remote add origin your-repository-url
    exit /b 1
)

echo.
echo Current git status:
git status

echo.
set /p "confirm=Do you want to continue with commit and push? (Y/N): "
if /i not "!confirm!"=="Y" (
    echo Operation cancelled.
    exit /b 0
)

echo.
echo Adding all changes to git...
git add .

echo.
echo Creating commit with message: "%commit_message%"
git commit -m "%commit_message%"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo Recent commit history:
git log -2 --oneline

echo.
echo Operation completed successfully.
timeout /t 3 