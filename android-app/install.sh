#!/usr/bin/env bash
# 有数 · 一键构建并安装到已连接的安卓设备（Git Bash 版）
# 用法：cd /c/project/wx/android-app && bash install.sh
# 前提：手机 USB 连接 + 已开启 USB 调试 + 已信任此电脑
set -e
ROOT="/c/project/wx/android-app"
ADB="/c/Android/Sdk/platform-tools/adb.exe"
GRADLE="/c/Android/gradle-8.2.1/bin/gradle.bat"
export JAVA_HOME="/c/Program Files/Microsoft/jdk-17.0.19.10-hotspot"
export ANDROID_HOME="/c/Android/Sdk"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"

echo "========================================"
echo "  有数 · 构建 + 安装到安卓设备"
echo "========================================"

echo "[1/3] 检查已连接设备..."
if ! "$ADB" devices | grep -q "device$"; then
  echo "  [错误] 未检测到已连接的设备。"
  echo "  请确认：手机已 USB 连接 + 已开启「USB 调试」+ 已信任此电脑。"
  exit 1
fi
echo "  设备已连接。"

echo "[2/3] 同步 web 资源并构建 APK..."
cd "$ROOT"
npx cap sync
"$GRADLE" -p android assembleDebug --no-daemon --console=plain
echo "  构建成功。"

echo "[3/3] 安装到设备（-r 覆盖安装，保留数据）..."
"$ADB" install -r "$APK"

echo "========================================"
echo "  完成！APP 已安装到设备，可直接打开。"
echo "========================================"
