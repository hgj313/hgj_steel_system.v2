@echo off
echo =================================
echo     端口清理工具（安全版）
echo =================================
echo.

echo 正在检查并清理 Node.js 进程...
echo.

REM 先检查有哪些 Node.js 进程
echo [当前 Node.js 进程]
tasklist | findstr "node.exe" 2>nul
if errorlevel 1 (
    echo   没有发现 Node.js 进程
    echo   无需清理 ✓
    goto :end
)

echo.
echo 正在安全清理 Node.js 进程...

REM 使用更安全的方式清理
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo table /nh 2^>nul') do (
    if "%%i" neq "信息:" (
        echo 正在终止进程 PID: %%i
        taskkill /pid %%i /f >nul 2>&1
        if errorlevel 1 (
            echo   PID %%i: 进程已退出或无法访问 ^(正常^)
        ) else (
            echo   PID %%i: 成功终止 ✓
        )
    )
)

echo.
echo 等待进程完全退出...
timeout /t 3 /nobreak >nul

echo.
echo [清理后端口状态检查]
netstat -ano | findstr ":3000 :5000" 2>nul
if errorlevel 1 (
    echo   端口 3000 和 5000: 已释放 ✓
) else (
    echo   部分端口仍被占用，可能需要手动处理
)

:end
echo.
echo =================================
echo 清理完成！现在可以运行 npm start
echo =================================
pause 