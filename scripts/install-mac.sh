#!/bin/bash
set -e
echo "╔════════════════════════════════════╗"
echo "║   Youlin - macOS 安装程序         ║"
echo "╚════════════════════════════════════╝"
echo ""

HOME_DIR="$HOME"
ROUTER_DIR="${HOME_DIR}/.model-router"
APP_DIR="${HOME_DIR}/Applications"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Create directories
mkdir -p "${ROUTER_DIR}/app/bin"
mkdir -p "${ROUTER_DIR}/app/lib"
mkdir -p "${ROUTER_DIR}/config"
mkdir -p "${ROUTER_DIR}/logs"
mkdir -p "${APP_DIR}"

echo "[1/4] 安装模型路由..."
cp -R "${SCRIPT_DIR}/router/bin/"* "${ROUTER_DIR}/app/bin/"
cp -R "${SCRIPT_DIR}/router/lib/"* "${ROUTER_DIR}/app/lib/"
cp "${SCRIPT_DIR}/router/codex-mcp.json" "${ROUTER_DIR}/"
chmod +x "${ROUTER_DIR}/app/bin/"*.js

echo "[2/4] 安装配置文件..."
for f in models.yaml policy.yaml secrets.env; do
  if [ ! -f "${ROUTER_DIR}/config/${f}" ] && [ -f "${SCRIPT_DIR}/router/config/${f}.example" ]; then
    cp "${SCRIPT_DIR}/router/config/${f}.example" "${ROUTER_DIR}/config/${f}"
    echo "  创建 config/${f} (请编辑填入你的设置)"
  fi
done

echo "[3/4] 安装 Youlin Switcher 应用..."
if [ -d "${SCRIPT_DIR}/Youlin Switcher.app" ]; then
  rm -rf "${APP_DIR}/Youlin Switcher.app" 2>/dev/null || true
  cp -R "${SCRIPT_DIR}/Youlin Switcher.app" "${APP_DIR}/"
  echo "  应用已安装到 ~/Applications/"
fi

echo "[4/4] 配置开机自启动..."
PLIST_PATH="${HOME_DIR}/Library/LaunchAgents/com.youlin.router-ui.plist"
NODE_PATH=$(which node)
mkdir -p "${HOME_DIR}/Library/LaunchAgents"

cat > "${PLIST_PATH}" << PLISTXML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.youlin.router-ui</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_PATH}</string>
        <string>${ROUTER_DIR}/app/bin/router-ui.js</string>
        <string>--port</string>
        <string>8787</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${HOME_DIR}/.model-router/logs/ui.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME_DIR}/.model-router/logs/ui-error.log</string>
</dict>
</plist>
PLISTXML

launchctl unload "${PLIST_PATH}" 2>/dev/null || true
launchctl load "${PLIST_PATH}"
echo "  开机自启动已配置"

echo ""
echo "╔════════════════════════════════════╗"
echo "║      安装完成!                    ║"
echo "╚════════════════════════════════════╝"
echo ""
echo "快速开始:"
echo "  1. 编辑配置: ~/.model-router/config/secrets.env"
echo "  2. 打开应用: ~/Applications/Youlin Switcher.app"
echo "  3. 网页界面: http://127.0.0.1:8787/"
echo "  4. 设置页面: http://127.0.0.1:8787/settings"
echo "  5. 线程迁移: http://127.0.0.1:8787/migrate"
echo ""
echo "切换模型: 打开 Youlin Switcher 应用，点击快速切换按钮，"
echo "然后完全退出并重新打开 Codex。"
echo ""
