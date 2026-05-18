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
mkdir -p "${ROUTER_DIR}/app/config"
mkdir -p "${ROUTER_DIR}/config"
mkdir -p "${ROUTER_DIR}/logs"
mkdir -p "${APP_DIR}"

echo "[1/4] 安装模型路由..."
cp -R "${SCRIPT_DIR}/router/bin/"* "${ROUTER_DIR}/app/bin/"
cp -R "${SCRIPT_DIR}/router/lib/"* "${ROUTER_DIR}/app/lib/"
cp -R "${SCRIPT_DIR}/router/config/"* "${ROUTER_DIR}/app/config/"
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
  /usr/libexec/PlistBuddy -c "Set :NSRequiresAquaSystemAppearance true" "${APP_DIR}/Youlin Switcher.app/Contents/Info.plist" 2>/dev/null || \
    /usr/libexec/PlistBuddy -c "Add :NSRequiresAquaSystemAppearance bool true" "${APP_DIR}/Youlin Switcher.app/Contents/Info.plist" 2>/dev/null || true
  echo "  应用已安装到 ~/Applications/"
fi

echo "[4/4] 配置开机自启动..."
PLIST_PATH="${HOME_DIR}/Library/LaunchAgents/com.youlin.router-ui.plist"
NODE_PATH=$(which node)
NPM_PATH=$(command -v npm || true)
MIMO2CODEX_PATH=$(command -v mimo2codex || true)
mkdir -p "${HOME_DIR}/Library/LaunchAgents"

if [ -z "${MIMO2CODEX_PATH}" ] && [ -n "${NPM_PATH}" ]; then
  echo "  安装本地模型代理 mimo2codex..."
  npm install -g mimo2codex >/dev/null 2>&1 || true
  MIMO2CODEX_PATH=$(command -v mimo2codex || true)
fi

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

if [ -n "${MIMO2CODEX_PATH}" ]; then
  DEEPSEEK_PLIST="${HOME_DIR}/Library/LaunchAgents/com.youlin.deepseek-v4pro.plist"
  cat > "${DEEPSEEK_PLIST}" << PLISTXML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.youlin.deepseek-v4pro</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-lc</string>
        <string>set -a; . "${ROUTER_DIR}/config/secrets.env" 2>/dev/null || true; set +a; if [ -z "\${DEEPSEEK_API_KEY:-}" ]; then echo "DEEPSEEK_API_KEY is empty; proxy idle"; sleep 3600; exit 0; fi; exec "${MIMO2CODEX_PATH}" --model ds --port 8788 --no-admin</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${ROUTER_DIR}/logs/deepseek-v4pro-8788.log</string>
    <key>StandardErrorPath</key>
    <string>${ROUTER_DIR}/logs/deepseek-v4pro-8788.err.log</string>
</dict>
</plist>
PLISTXML

  GEMINI_PLIST="${HOME_DIR}/Library/LaunchAgents/com.youlin.gemini2codex.plist"
  cat > "${GEMINI_PLIST}" << PLISTXML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.youlin.gemini2codex</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-lc</string>
        <string>set -a; . "${ROUTER_DIR}/config/secrets.env" 2>/dev/null || true; set +a; if [ -z "\${GEMINI_API_KEY:-}" ]; then echo "GEMINI_API_KEY is empty; proxy idle"; sleep 3600; exit 0; fi; export GENERIC_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai"; export GENERIC_API_KEY="\${GEMINI_API_KEY}"; export GENERIC_DEFAULT_MODEL="gemini-2.5-flash"; exec "${MIMO2CODEX_PATH}" --model generic --port 8790 --no-admin</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${ROUTER_DIR}/logs/gemini2codex.log</string>
    <key>StandardErrorPath</key>
    <string>${ROUTER_DIR}/logs/gemini2codex.err.log</string>
</dict>
</plist>
PLISTXML

  launchctl unload "${DEEPSEEK_PLIST}" 2>/dev/null || true
  launchctl unload "${GEMINI_PLIST}" 2>/dev/null || true
  launchctl load "${DEEPSEEK_PLIST}" 2>/dev/null || true
  launchctl load "${GEMINI_PLIST}" 2>/dev/null || true
  echo "  DeepSeek/Gemini 本地代理已配置"
else
  echo "  未找到 mimo2codex；填写 API Key 后请执行: npm install -g mimo2codex"
fi

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
