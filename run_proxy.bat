@echo off
chcp 65001 >nul
title 洛克王国家园实时代理
cd /d "D:\Game\PvPCalc-Mine"

set PY="C:\Users\23056\.workbuddy\binaries\python\versions\3.13.12\python.exe"
if not exist %PY% set PY="C:\Users\23056\AppData\Local\Microsoft\WindowsApps\python.exe"
if not exist %PY% set PY=python

echo 正在启动洛克王国家园实时代理...
echo 启动后会自动打开 http://127.0.0.1:8787/home.html
echo 请保持此窗口打开；关闭窗口即停止实时查询。
echo.
start "" "http://127.0.0.1:8787/home.html"
%PY% "D:\Game\PvPCalc-Mine\local_proxy.py"
echo.
echo 代理已退出。按任意键关闭窗口。
pause
