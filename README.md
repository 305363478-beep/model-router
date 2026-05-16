# Youlin — Codex Model Switcher

一键切换 Codex Desktop 底层模型。GPT 用完了？切 DeepSeek。DeepSeek 慢了？切 Claude Code。聊天记录自动保留，迁移随心。

**支持平台**: macOS 原生应用 + Windows 网页版  
**支持模型**: GPT / DeepSeek / Claude Code / Qwen / 任意 OpenAI 兼容 API

---

## 为什么需要 Youlin？

Codex 默认绑定 OpenAI，当 GPT 额度耗尽就无法继续。Youlin 让你：

- ⚡ **一键切换** — 在 Codex 对话框里说"切换到 deepseek"，立刻生效
- 🔄 **线程迁移** — 切换模型后把聊天记录搬过去，不中断工作上下文
- 🔑 **多 API Key** — 管理所有模型的密钥，一个配置文件搞定
- 🖥️ **原生体验** — macOS 菜单栏应用 + 网页界面，不用离开 Codex
- 🌍 **开源 MIT** — 自由使用、修改、分发

---

## 快速开始

### macOS

```bash
# 1. 克隆仓库
git clone https://github.com/305363478-beep/model-router.git
cd model-router

# 2. 运行安装
bash scripts/install-mac.sh

# 3. 编辑 API Key
nano ~/.model-router/config/secrets.env

# 4. 完全退出并重新打开 Codex
```

### Windows

```bash
# 1. 确保已安装 Node.js 18+
# 2. 双击 安装-Windows.bat
# 3. 编辑 %USERPROFILE%\.model-router\config\secrets.env
# 4. 双击 启动Youlin.bat
# 5. 打开 http://127.0.0.1:8787/
```

---

## 工作原理

```
Codex Desktop
    │
    ├─ config.toml ──→ Youlin 修改模型配置
    │
    ├─ MCP ──→ model-router-mcp.js ──→ 路由决策
    │                                      │
    │                          ┌───────────┼───────────┐
    │                          ▼           ▼           ▼
    │                       GPT        DeepSeek    Claude Code
    │
    └─ SQLite sessions ──→ router-ui.js ──→ 线程迁移
```

---

## 项目结构

```
model-router/
├── router/
│   ├── bin/                    # 核心服务脚本
│   │   ├── model-router-mcp.js  # MCP 服务器
│   │   ├── router-ui.js         # Web UI (端口 8787)
│   │   ├── router-chat.js       # 对话路由
│   │   ├── router-init.js       # 初始化
│   │   └── router-doctor.js     # 诊断工具
│   ├── lib/                    # 共享库
│   ├── config/                 # 配置模板
│   └── codex-mcp.json          # MCP 配置示例
├── native/
│   └── YoulinSwitcher.swift    # macOS SwiftUI 应用
├── scripts/
│   ├── install-mac.sh          # macOS 安装脚本
│   ├── 安装-Windows.bat         # Windows 安装脚本
│   └── 启动Youlin.bat          # Windows 启动脚本
├── LICENSE                     # MIT
├── README.md                   # 本文件
└── MANUAL.md                   # 完整使用说明书
```

---

## 功能页面

| 页面 | 地址 | 说明 |
|------|------|------|
| 状态面板 | `http://127.0.0.1:8787/` | 查看当前模型，一键切换 |
| 设置 | `http://127.0.0.1:8787/settings` | 添加 API Key、自定义模型 |
| 线程迁移 | `http://127.0.0.1:8787/migrate` | 跨模型迁移聊天记录 |

---

## 配置 API Key

编辑 `~/.model-router/config/secrets.env`：

```bash
OPENAI_API_KEY=sk-xxx           # GPT
DEEPSEEK_API_KEY=sk-xxx         # DeepSeek
ANTHROPIC_API_KEY=sk-ant-xxx    # Claude Code
QWEN_API_KEY=sk-xxx             # Qwen
```

或在网页 `http://127.0.0.1:8787/settings` 直接填写。

---

## 添加自定义模型

编辑 `~/.model-router/config/models.yaml`：

```yaml
models:
  - id: my-provider
    name: My Custom LLM
    provider: openai-compatible
    base_url: https://api.mymodel.com/v1
    api_key_env: MY_MODEL_API_KEY
```

---

## 在 Codex 中对话切换

MCP 集成后，直接在对话框中说：

- `切换到deepseek`
- `用claude code`
- `切换回gpt`

模型即时切换，然后完全退出再打开 Codex 生效。

---

## 常见问题

**切换后聊天记录不见了？**  
用「线程迁移」功能把记录搬到新模型下。

**网页打不开？**  
macOS: `lsof -i :8787` 检查端口。Windows: 确保 `启动Youlin.bat` 在运行。

**怎么切换回去？**  
随时切回 GPT 或其他模型，无需重新配置。

---

## 开源许可

MIT License © 2026 Youlin

欢迎提 Issue 和 PR！
