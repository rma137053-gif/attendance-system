#!/bin/bash
# 考勤管理 APK 构建脚本
# 用法: cd mobile-app && bash build-apk.sh

set -e

export JAVA_HOME="$HOME/jdk-21/Contents/Home"
export ANDROID_HOME="$HOME/android-sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "==> 开始构建 APK..."
cd "$(dirname "$0")"

# 同步 Capacitor 插件
npx cap sync android

cd android

# 确保 local.properties 存在
echo "sdk.dir=$ANDROID_HOME" > local.properties

# 构建 release APK
./gradlew assembleRelease

# 复制到桌面
VERSION="v1.1"
cp app/build/outputs/apk/release/app-release.apk "$HOME/Desktop/考勤管理-${VERSION}.apk"

echo "==> 构建完成！"
echo "    APK 文件: $HOME/Desktop/考勤管理-${VERSION}.apk"
ls -lh "$HOME/Desktop/考勤管理-${VERSION}.apk"
