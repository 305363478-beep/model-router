# Youlin 使用说明书 v1.0.0

**Youlin** — Codex Desktop 模型快速切换工具。让你在 GPT、DeepSeek、Claude Code、Qwen 之间一键切换，并支持跨模型的聊天记录迁移。

---

## 系统要求

| 平台 | 最低要求 |
|------|---------|
| macOS | macOS 13+ (Ventura 或更新) |
| Windows | Windows 10/11, Node.js 18+ |
| 通用依赖 | Codex Desktop 已安装 |

---

## 安装

### macOS

1. 解压 `Youlin-macOS-v1.0.0.zip`
2. 打开 **终端 (Terminal)**，进入解压后的 `Youlin` 文件夹
3. 运行安装脚本：
   ```bash
   cd ~/Desktop/youlin-release/Youlin  # 或你的解压路径
   bash install-mac.sh
   ```
4. 安装完成后，应用会自动注册开机启动。可以在 `~/Applications/` 找到 **Youlin Switcher** 应用
5. **完全退出 Codex**（右键 Dock 图标 → 退出 或 Cmd+Q）

### Windows

1. 确保已安装 **Node.js 18+** — 如果没装，去 [nodejs.org](https://nodejs.org) 下载安装
2. 解压 `Youlin-Windows-v1.0.0.zip`
3. 双击 `安装-Windows.bat` 完成安装
4. 双击 `启动Youlin.bat` 启动后台服务
5. **完全退出 Codex**

---

## 配置 API Key

编辑 `~/.model-router/config/secrets.env` 文件：

```bash
# 示例
DEEPSEEK_API_KEY=sk-your-deepseek-key
GEMINI_API_KEY=your-gemini-key
QWEN_API_KEY=sk-your-qwen-key
ANTHROPIC_API_KEY=sk-ant-your-claude-key
```

也可以直接打开网页 `http://127.0.0.1:8787/settings` 在设置页面填写。

---

## 使用方式

### 方式一：Youlin Switcher 应用 (macOS)

1. 打开 `~/Applications/Youlin Switcher.app`
2. **供应商** 标签页：查看和切换模型预设
3. **线程迁移** 标签页：迁移聊天记录到其他模型
4. 点击 **Use in Codex** 切换模型后，**完全退出并重新打开 Codex**

### 方式二：网页界面 (macOS / Windows)

浏览器打开以下地址：

| 页面 | 地址 | 功能 |
|------|------|------|
| Router Chat | http://127.0.0.1:8787/ | 查看当前模型、快速切换 |
| Settings | http://127.0.0.1:8787/settings | 添加自定义模型、API Key |
| Thread Migrate | http://127.0.0.1:8787/migrate | 迁移聊天记录 |

### 方式三：在 Codex 对话框中直接切换

在对话框输入 `切换到deepseek` 或 `用claude`，MCP 会自动切换模型。

---

## 线程迁移

当你切换模型后，原有的聊天记录默认不会迁移到新的模型。使用线程迁移功能：

1. 打开网页 `http://127.0.0.1:8787/migrate` 或应用中的「线程迁移」标签
2. 左侧显示所有线程，按模型分组
3. 展开线程查看聊天内容
4. 选择目标模型，点击 **Migrate** 按钮
5. 迁移完成后，迁移目标下拉框会显示所有已配置的模型（包括已迁移过的）

> **注意**：迁移是双向的。如果你想从 DeepSeek 迁移回 GPT，选择 GPT 作为目标即可。

---

## MCP 配置

Youlin 通过 Codex MCP 集成。安装脚本已经自动配置。如需手动配置，在 `~/.codex/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "youlin": {
      "command": "node",
      "args": ["<HOME>/.model-router/app/bin/model-router-mcp.js"],
      "env": {
        "MODEL_ROUTER_HOME": "<HOME>/.model-router"
      }
    }
  }
}
```

---

## 添加自定义模型

编辑 `~/.model-router/config/models.yaml`，按已有格式添加新模型：

```yaml
models:
  - id: my-model
    name: My Custom Model
    provider: openai-compatible
    base_url: https://api.example.com/v1
    api_key_env: MY_MODEL_API_KEY
```

---

## 常见问题

**Q: 切换模型后聊天记录不见了？**
A: 不同模型的聊天记录是独立存储的。使用「线程迁移」功能可以把记录迁移到当前模型。

**Q: 开机后网页打不开 (http://127.0.0.1:8787)？**
A: 
- macOS: 检查 launchd 服务是否运行。终端执行 `lsof -i :8787`
- Windows: 确保启动了 `启动Youlin.bat`

**Q: Gemini 切换后 Codex 报 `502 Bad Gateway`？**
A: Gemini 不是由 Codex 直接请求 Google API。Youlin 会启动本地 `mimo2codex` 代理，把 Codex 的 Responses API 请求转换为 Gemini OpenAI-compatible 请求。

默认链路：

```text
Codex -> http://localhost:8790/v1/responses -> mimo2codex -> Gemini API
```

请确认：

- Youlin 的 Gemini 本地代理正在监听 `8790`
- Codex 配置里的 Gemini `base_url` 是 `http://localhost:8790/v1`
- 模型名使用 Google 当前可用的 API ID，例如 `gemini-3.1-pro-preview`
- `localhost`、`127.0.0.1`、`::1` 没有被系统代理或 TUN 代理接管

macOS 检查端口：

```bash
lsof -i :8790
```

Windows 检查端口：

```powershell
Get-NetTCPConnection -LocalPort 8790
```

或：

```powershell
netstat -ano | findstr :8790
```

如果开启了 Clash / FlClash / Clash Verge / Mihomo / Surge 等代理工具，请添加本地地址直连规则。

通用直连地址：

```text
localhost
127.0.0.1
::1
```

Clash/Mihomo 规则示例：

```text
DOMAIN,localhost,DIRECT
IP-CIDR,127.0.0.0/8,DIRECT,no-resolve
IP-CIDR6,::1/128,DIRECT,no-resolve
```

macOS TUN 模式还需要排除 loopback 路由：

```text
127.0.0.0/8
::1/128
```

Windows 系统代理绕过列表可以加入：

```text
localhost;127.*;::1;<local>
```

也可以给 Youlin/Codex 进程设置：

```text
NO_PROXY=localhost,127.0.0.1,::1
no_proxy=localhost,127.0.0.1,::1
```

**Q: 如何卸载？**
A:
- macOS: 删除 `~/.model-router/` 目录，删除 `~/Library/LaunchAgents/com.youlin.router-ui.plist`，然后执行 `launchctl unload ~/Library/LaunchAgents/com.youlin.router-ui.plist`
- Windows: 删除 `%USERPROFILE%\.model-router\` 目录

**Q: 可以同时用多个模型吗？**
A: 同一时间 Codex 只能使用一个模型。但切换后可以随时切换回来，聊天记录通过迁移功能保留。

---

## 文件结构

```
~/.model-router/
├── app/
│   ├── bin/           # 核心脚本
│   │   ├── model-router-mcp.js   # MCP 服务
│   │   ├── router-ui.js          # 网页界面
│   │   ├── router-chat.js        # 路由对话
│   │   └── router-init.js        # 初始化
│   └── lib/           # 库文件
├── config/
│   ├── models.yaml    # 自定义模型定义
│   ├── policy.yaml    # 路由策略
│   └── secrets.env    # API Key (不要提交到 git!)
├── logs/              # 日志
└── codex-mcp.json     # MCP 配置
```

---

## 许可证

MIT License © 2026 Youlin

项目地址: https://github.com/305363478-beep/model-router
(上线后填入实际地址)
