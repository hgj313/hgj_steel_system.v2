@echo off
echo =================================
echo     端口占用检查工具
echo =================================
echo.

echo 检查端口 3000 和 5000 的占用情况...
echo.

echo [端口 3000 占用情况]
netstat -ano | findstr ":3000" 2>nul
if errorlevel 1 (
    echo   端口 3000: 未被占用 ✓
) else (
    echo   端口 3000: 已被占用
)

echo.
echo [端口 5000 占用情况]
netstat -ano | findstr ":5000" 2>nul
if errorlevel 1 (
    echo   端口 5000: 未被占用 ✓
) else (
    echo   端口 5000: 已被占用
)

echo.
echo [所有 Node.js 进程]
tasklist | findstr "node.exe" 2>nul
if errorlevel 1 (
    echo   没有运行的 Node.js 进程 ✓
) else (
    echo   发现 Node.js 进程（如上所示）
)

echo.
echo =================================
echo 如需清理所有 Node.js 进程，请运行: clean-ports.bat
echo =================================
pause 