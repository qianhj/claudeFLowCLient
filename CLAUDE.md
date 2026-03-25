# HZ-CC Flow — Claude Code 项目指南

## 项目简介

HZ-CC Flow 是基于 Web 的 Claude Code 图形化前端，通过 **Claude Agent SDK** 将 Claude Code CLI 的全部能力以友好的 Web UI 呈现，支持：实时对话流、Tool Call 可视化、HIL 权限确认、Session 管理、上下文压缩、MCP 管理、Memory 管理、终端集成、Sub-Agent 树、工作流、团队协作、插件/技能市场等。

## 项目结构

```
hz-cc-flow-src/
├── client/                   # 前端 React 19 + Vite + TypeScript
│   └── src/
│       ├── components/
│       │   ├── layout/       # AppLayout / Sidebar / TopBar / RightPanel
│       │   ├── chat/         # ChatPanel / InputBar / MessageList / ToolCallCard / SlashCommandMenu
│       │   ├── agent/        # AgentManager / SubAgentTree / CheckpointTimeline / WorkflowManager / TeamPanel
│       │   ├── ide/          # FileTree / CodeViewer / DiffViewer / Terminal
│       │   ├── manage/       # SessionList / McpManager / MemoryManager / PluginManager / SkillsManager / HooksManager / UsageDashboard
│       │   ├── modals/       # SettingsModal / HistoryModal / FolderBrowserModal / SkillBrowserModal
│       │   ├── settings/     # ClaudeEnvPanel
│       │   └── shared/       # MarkdownRenderer / ErrorBoundary / XTerminal
│       ├── stores/           # chatStore / uiStore / agentStore / sessionStore / fileStore / configStore
│       │                     # systemStore / skillStore / pluginStore / mcpStore / memoryStore
│       │                     # hooksStore / workflowStore / teamStore / marketplaceStore
│       ├── hooks/            # useWebSocket / useAutoScroll / useClaudeStatus / useDoubleEsc
│       ├── services/         # api.ts / websocket.ts
│       ├── types/            # agent / api / config / file / workflow / plugin / mcp / skill / session / team / claude
│       └── utils/            # costCalculator / frontmatterParser
├── server/                   # 后端 Node.js + Express + WebSocket
│   └── src/
│       ├── routes/           # index / agents / attachments / config / files / hooks / marketplace
│       │                     # memory / mcp / plugins / sessions / skills / system / teams / workflows
│       ├── services/         # claudeAgentService / sessionManager / ptyService / configService
│       │                     # fileService / mcpService / memoryService / skillService / pluginService
│       │                     # agentService / agentRegistry / workflowService / teamService
│       │                     # marketplaceService / attachmentService / hooksService / systemService
│       │                     # claudeSettingsService / proxyConfig
│       ├── websocket/        # index / chatHandler / terminalHandler / protocol
│       ├── utils/            # pathUtils / logger / frontmatterParser
│       └── types/            # api / claude / team
├── electron/                 # Electron 桌面应用包装
│   └── src/
│       ├── main.ts           # 主进程：启动后端、创建窗口
│       └── preload.ts        # 预加载脚本（contextIsolation）
├── package.json              # 根 package（monorepo 脚本）
└── pnpm-workspace.yaml
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 19 + Vite + TypeScript |
| UI 样式 | Tailwind CSS v4（Void Console 设计系统） |
| 前端状态 | Zustand（功能域独立 Store） |
| 后端框架 | Node.js + Express + ws |
| AI 集成 | `@anthropic-ai/claude-agent-sdk` |
| 终端 | node-pty + xterm.js |
| 代码查看 | CodeMirror 6 |
| 桌面应用 | Electron 32 |
| 包管理 | pnpm workspace (Monorepo) |

## 开发命令

```bash
# ========== Windows ==========
# ⚠️ bash 环境中 pnpm 路径有问题，必须用 PowerShell 启动
powershell -Command "cd D:\hz-cc-flow-src; pnpm --filter server dev"   # 后端 :3001
powershell -Command "cd D:\hz-cc-flow-src; pnpm --filter client dev"   # 前端 :5173

# ========== macOS / Linux ==========
# 首次安装需确保 Xcode 命令行工具已安装（用于编译 node-pty）
xcode-select --install  # macOS only

pnpm install
pnpm --filter server dev   # 后端 :3001
pnpm --filter client dev   # 前端 :5173

# ========== 通用命令 ==========
pnpm build            # 构建生产版本
pnpm start            # 启动生产后端（需先 build）
pnpm lint             # ESLint 检查
pnpm format           # Prettier 格式化
pnpm electron:dev     # 启动 Electron 开发模式
pnpm electron:build   # 构建 Electron 安装包
```

> 根目录 `concurrently` 依赖因 electron 文件锁可能未完整安装，建议分别启动前后端。

## 代码规范

- TypeScript 严格模式，所有组件和服务均有类型
- 组件文件 PascalCase（`ChatPanel.tsx`），服务/工具文件 camelCase（`sessionManager.ts`）
- 使用 Tailwind CSS utility classes，不写自定义 CSS 文件
- 前端状态管理：Zustand，每个功能域独立 Store
- 后端分层：`routes` → `services` → `utils`，路由只做参数校验和调用转发
- API 路径前缀统一为 `/api`，WebSocket 路径为 `/ws`（聊天）和 `/terminal`

## 关键架构决策

- **Agent SDK 集成**：对话流通过 `@anthropic-ai/claude-agent-sdk` 的 `query()` 实现，基于 EventEmitter 推送事件（`session_init` / `assistant_text` / `tool_use_start` / `tool_use_result` 等），支持 HIL 权限回调
- **通信协议**：WebSocket 处理对话流和终端 I/O，REST API 处理配置管理（MCP / Memory / Settings / Skills 等）
- **跨平台路径**：统一用 `path.normalize`，Windows 下路径哈希先将 `\` 转换为 `/`
- **安全**：API Key 仅存本地不写日志，文件写操作校验路径在项目目录内
- **Electron**：生产模式 fork 后端子进程，轮询 `/api/health` 等待就绪后加载 UI

## 前端设计系统（Void Console）

核心颜色：

| 用途 | 值 |
|------|----|
| 全局背景 | `#13111C` (obsidian-900) |
| 主操作色 | `#d97757` (amber-glow) |
| 品牌/AI 色 | `#7c3aed` (purple-glow) |
| 文字层级 | white → slate-200 → slate-300 → slate-400 |

关键规则：

- 文字颜色用 `slate-*`，**不用** `obsidian-*`（obsidian-500 = `#2D2845` 近乎纯黑）
- 面板背景用内联 `rgba()` style，不用 Tailwind `bg-obsidian-*`
- 主操作按钮：`bg-[#ca5d3d] hover:bg-amber-glow text-white font-medium`
- 光晕环境仅在 Sidebar **外**的中/右区域，Sidebar 本身无光晕

## 注意事项

- `node-pty` 需要本机编译（`node-gyp`），**macOS 需安装 Xcode 命令行工具**：`xcode-select --install`
- Windows 需确保 Python 和 C++ 构建工具已就位
- Windows 下 Claude Code CLI 需要 Git Bash，路径由 `CLAUDE_CODE_GIT_BASH_PATH` 环境变量覆盖
- 权限请求（HIL）超时为 60 秒，超时后自动拒绝
- `maxBudgetUsd` 选项可在 Settings 页面配置，防止单次任务费用失控
- Electron 打包时需先运行 `pnpm build` 再运行 `pnpm electron:build`

## Electron Agent（Desktop 自动化）

项目内置 Electron 自动化 Agent，位于 `.claude/agents/electron-agent/`，通过 Electron IPC 桥接前端与主进程。

### 目录结构

```
.claude/
├── config.yaml                    # Agent 全局配置（启用/禁用、触发关键词）
└── agents/electron-agent/
    ├── agent.yaml                 # Agent 模型/工具/权限配置
    ├── index.ts                   # ElectronAutomationAgent 主类
    ├── tools/index.ts             # 工具定义
    └── README.md                  # 使用文档
```

### 启用状态

- `agentState.enabled` 默认 `true`（`electron/src/main.ts`）
- 前端通过 **右侧栏 → 拓展 → Desktop** 面板管理（仅 Electron 环境可见）

### IPC 接口（主进程 ↔ 渲染进程）

| 频道 | 功能 |
|------|------|
| `agent:enable` | 启用/禁用 Agent |
| `agent:status` | 获取 Agent 状态 |
| `agent:capture` | 截图（返回 base64 dataUrl）|
| `agent:window-info` | 获取窗口信息（位置/尺寸/焦点等）|
| `agent:window-control` | 窗口操作（minimize / maximize / restore / focus）|
| `agent:set-bounds` | 设置窗口位置和大小 |
| `agent:execute-js` | 在渲染进程执行 JavaScript |
| `agent:screen-info` | 获取显示器信息 |
| `agent:shortcut` | 模拟键盘快捷键 |
| `agent:menu-command` | 执行内置菜单命令（reload / toggle-devtools / zoom-in 等）|
| `agent:menu-list` | 获取可用菜单命令列表 |

### 前端使用

```typescript
// 检查是否在 Electron 环境
const isElectron = typeof window !== "undefined" && !!window.electronAPI;

// 截图
const res = await window.electronAPI.agent.capture();

// 窗口控制
await window.electronAPI.agent.windowControl("maximize");

// 执行 JS
await window.electronAPI.agent.executeJS("document.title");
```

## Electron 打包说明

### 构建命令

```powershell
powershell -ExecutionPolicy Bypass -File "D:\hz-cc-flow-src\build-pack.ps1"
```

输出产物：`C:\HzBuild\release\HZ CC Flow Setup 1.0.0.exe`

### 架构要点

- 生产模式：Electron 主进程通过 `child_process.fork()` + `ELECTRON_RUN_AS_NODE=1` 启动后端子进程
- `ELECTRON_RESOURCES_PATH` 环境变量传给子进程，服务端 `app.ts` 用它定位 `client/dist` 静态文件
- 原生文件夹对话框通过 `ipcMain.handle('show-open-dialog')` + `preload.ts` 暴露给前端，降级走 REST `/api/system/pick-folder`
- 诊断日志：`%AppData%\hz-cc-flow-electron\logs\server.log`

### 已知坑（已修复）

| 问题 | 根因 | 修复位置 |
|------|------|---------|
| 服务端 `import` 语法错误 | `server/package.json`（含 `"type":"module"`）未打包，Node.js 将 ESM 当 CJS | `electron/electron-builder.yml` extraResources 加入 `server/package.json` |
| 子进程变成 Electron 窗口 | `fork()` 缺少 `ELECTRON_RUN_AS_NODE=1` | `electron/src/main.ts` fork env |
| `Cannot GET /`（连上 dev server）| 开发服务器残留占用 3001 端口 | `main.ts` 启动前调用 `killPort()` |
| 黑屏不渲染 | Google Fonts 外部请求在打包环境阻塞渲染 | `client/index.html` 移除 Google Fonts 链接 |
| 服务端启动崩溃 | Express 5 不支持 `app.get("*", ...)` 通配符 | `server/src/app.ts` 改为 `"/*path"` |
| IPC `mainWindow!` 空指针 | 窗口关闭后调用 dialog 崩溃 | `main.ts` 改为 `BrowserWindow.getFocusedWindow()` |

### 打包优化

**优化脚本**：`scripts/optimize-electron.ps1`

用于清理无用文件并创建精简版 server，减少安装包体积。

```powershell
# 执行优化（打包前运行）
powershell -ExecutionPolicy Bypass -File "scripts/optimize-electron.ps1"

# 然后打包
cd electron
pnpm pack
```

**优化内容**：

| 优化项 | 原大小 | 优化后 | 说明 |
|--------|--------|--------|------|
| `.ignored` 目录 | ~294 MB | 0 | pnpm 旧版本缓存，可删除 |
| `server` 依赖 | 147 MB (含 dev) | 148 MB (仅 prod) | 生产依赖本身已较精简 |

**空间占用分析**（node_modules）：

```
electron/node_modules       ~1,043 MB  (主要: app-builder-bin 414MB + electron 268MB)
client/node_modules           ~222 MB
server/node_modules           ~147 MB  (claude-agent-sdk + node-pty 为主)
node_modules/.pnpm            ~841 MB  (pnpm 全局存储，硬链接不重复占用)
```

**清理命令**：

```powershell
# 删除 pnpm 缓存（如需要）
Remove-Item -Path "electron/node_modules/.ignored" -Recurse -Force

# 完整重建（从干净状态开始）
Remove-Item -Path "electron/node_modules", "electron/server-prod" -Recurse -Force
pnpm install
```
