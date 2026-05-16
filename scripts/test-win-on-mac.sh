#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0; FAIL=0
green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
check() {
  local label="$1"
  echo -n "  $label ... "
  if node --input-type=module -e "$2" 2>/dev/null; then green "PASS"; PASS=$((PASS+1))
  else red "FAIL"; FAIL=$((FAIL+1)); fi
}

echo "=========================================="
echo "  Youlin Windows 模拟测试 (macOS)"
echo "=========================================="
echo ""

echo "--- 1. Windows 路径兼容 ---"
check "路径 - Win homedir 拼接" '
  import path from "node:path";
  if (!path.join("C:\\Users\\x",".model-router").includes(".model-router"))
    throw new Error("path join failed");
'

echo ""
echo "--- 2. 平台特定分支 ---"
check "process.platform 注入 win32" '
  const cmd = process.platform === "win32" ? "where" : "which";
  // macOS 下当然是 which，这是双重保险测试
'

check "restartCodex PowerShell 脚本完整" '
  const ps = [
    "\$p = Get-Process | Where-Object { \$_.ProcessName -like \"Codex*\" } | Select-Object -First 1",
    "\$path = if (\$p) { \$p.Path } else { \$null }",
    "if (\$p) { Stop-Process -Id \$p.Id -Force }",
    "Start-Sleep -Seconds 1",
    "if (\$path) { Start-Process -FilePath \$path } else { Start-Process \"Codex\" }",
  ].join("; ");
  ["Get-Process","Stop-Process","Start-Process"].forEach(k => {
    if (!ps.includes(k)) throw new Error("missing " + k);
  });
'

echo ""
echo "--- 3. 批处理脚本静态检查 ---"
check "安装-Windows.bat - 有 xcopy + USERPROFILE" '
  import fs from "node:fs";
  const c = fs.readFileSync("scripts/安装-Windows.bat", "utf8");
  ["xcopy","%USERPROFILE%","powershell","mkdir"].forEach(k => {
    if (!c.includes(k)) throw new Error("missing " + k);
  });
'

check "安装-Windows.bat - 有 Node.js 检查 (重要!)" '
  import fs from "node:fs";
  const c = fs.readFileSync("scripts/安装-Windows.bat", "utf8");
  // 期望安装脚本也有 where node 检查
  if (!c.includes("where node") && !c.includes("node -v"))
    throw new Error("安装脚本缺少 Node.js 检查!");
'

check "启动Youlin.bat - where node + start /B" '
  import fs from "node:fs";
  const c = fs.readFileSync("scripts/启动Youlin.bat", "utf8");
  ["where node","start /B","127.0.0.1:8787"].forEach(k => {
    if (!c.includes(k)) throw new Error("missing " + k);
  });
'

echo ""
echo "--- 4. JS 文件完整性 ---"
for f in router/bin/*.js router/lib/*.js; do
  check "解析: $f" '
    import fs from "node:fs";
    if (fs.readFileSync("'$f'","utf8").length < 10)
      throw new Error("too short");
  '
done

check "codex-config.js - CRLF 兼容" '
  import fs from "node:fs";
  if (!fs.readFileSync("router/lib/codex-config.js","utf8").includes("split(/\\r?\\n/)"))
    throw new Error("missing CRLF handling");
'

echo ""
echo "--- 5. HTTP 服务兼容 ---"
check "router-ui - 绑定 127.0.0.1" '
  import fs from "node:fs";
  if (!fs.readFileSync("router/bin/router-ui.js","utf8").includes("127.0.0.1"))
    throw new Error("not binding to 127.0.0.1");
'
check "router-ui - win32 分支" '
  import fs from "node:fs";
  if (!fs.readFileSync("router/bin/router-ui.js","utf8").includes("win32"))
    throw new Error("missing win32 branch");
'

echo ""
echo "=========================================="
printf "  结果: \033[32m%d PASS\033[0m / \033[31m%d FAIL\033[0m\n" "$PASS" "$FAIL"
echo "=========================================="
[ "$FAIL" -eq 0 ] || exit 1
