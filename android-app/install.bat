@echo off
chcp 65001 >nul
REM 有数 · 一键构建并安装到已连接的安卓设备
REM 用法：双击或在 Git Bash 执行  bash install.bat
REM 前提：手机 USB 连接 + 已开启 USB 调试

setlocal
set "ROOT=%~dp0"
set "ADB=C:\Android\Sdk\platform-tools\adb.exe"
set "GRADLE=C:\Android\gradle-8.2.1\bin\gradle.bat"
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
set "ANDROID_HOME=C:\Android\Sdk"
set "APK=%ROOT%android\app\build\outputs\apk\debug\app-debug.apk"

echo ========================================
echo   有数 · 构建 + 安装到安卓设备
echo ========================================

REM 1. 检查设备连接
echo [1/3] 检查已连接设备...
"%ADB%" devices | findstr "device$" >nul
if errorlevel 1 (
  echo   [错误] 未检测到已连接的设备。
  echo   请确认：手机已 USB 连接 + 已开启「USB 调试」+ 已信任此电脑。
  pause
  exit /b 1
)
echo   设备已连接。

REM 2. 同步 web 并构建 APK
echo [2/3] 同步 web 资源并构建 APK...
cd /d "%ROOT%"
call npx cap sync
if errorlevel 1 ( echo   [错误] cap sync 失败 & pause & exit /b 1 )

set "JAVA_HOME=%JAVA_HOME%"
set "ANDROID_HOME=%ANDROID_HOME%"
call "%GRADLE%" -p android assembleDebug --no-daemon --console=plain
if errorlevel 1 ( echo   [错误] 构建失败 & pause & exit /b 1 )
echo   构建成功。

REM 3. 安装到设备
echo [3/3] 安装到设备（-r 覆盖安装，保留数据）...
"%ADB%" install -r "%APK%"
if errorlevel 1 ( echo   [错误] 安装失败 & pause & exit /b 1 )

echo ========================================
echo   完成！APP 已安装到设备，可直接打开。
echo ========================================
pause
endlocal
