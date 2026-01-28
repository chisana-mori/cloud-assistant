# Cloud Codex

基于 OpenAI Codex App Server Protocol 的云端 Codex 服务。

## 特性

### Phase 1: 核心功能
- ✅ **完整的 App Server 协议支持**：基于 JSON-RPC 2.0 over JSONL
- ✅ **多用户会话隔离**：每个用户独立的 codex app-server 进程和工作目录
- ✅ **Approval 透传**：完整支持命令执行和文件变更审批
- ✅ **实时事件流**：通过 WebSocket 推送所有 Codex 事件
- ✅ **Thread/Turn 管理**：完整的会话和对话管理 API

### Phase 2: 企业级增强 (NEW!)
- ✅ **智能 Approval 策略**：自动批准只读命令，白名单路径
- ✅ **Approval 超时处理**：5分钟超时自动拒绝，防止挂起
- ✅ **审计日志**：记录所有审批操作，包括自动批准和人工审批
- 🚧 **JWT 认证**：Token 验证（已实现工具类）
- 🚧 **会话持久化**：Redis 存储会话状态
- 🚧 **心跳保活**：WebSocket 连接健康检查

## 架构

```
客户端 (WebSocket) 
    ↓
WebSocket 网关 
    ↓
Session 管理器 
    ↓
CodexAppServer (独立进程)
    ↓
codex app-server (CLI)
```

## 快速开始

### 前置要求

- Node.js 18+
- 已安装 `codex` CLI（`npm install -g @openai/codex`）
- OpenAI API Key

### 安装

```bash
cd cloud-codex
npm install
```

### 启动服务器

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

服务器默认运行在 `http://localhost:3000`

### 使用客户端示例

```bash
# 在另一个终端
tsx examples/client.ts
```

## API 文档

### WebSocket 端点

```
ws://localhost:3000/ws?userId=<your-user-id>
```

### 客户端消息格式

```typescript
// 启动线程
{
  type: 'thread/start',
  payload: {
    model: 'gpt-5.1-codex',
    workingDirectory: '/path/to/project'
  },
  requestId: 'req_1'
}

// 发起对话
{
  type: 'turn/start',
  payload: {
    threadId: 'thr_xxx',
    input: [{ type: 'text', text: 'Your prompt' }]
  },
  requestId: 'req_2'
}

// 响应 Approval
{
  type: 'approval/respond',
  payload: {
    approvalId: 'appr_xxx',
    decision: 'accept' // or 'decline'
  }
}
```

### 服务端事件格式

```typescript
// 事件流
{
  type: 'event',
  payload: {
    method: 'item/agentMessage/delta',
    params: { delta: '...' }
  }
}

// Approval 请求
{
  type: 'approval/request',
  payload: {
    approvalId: 'appr_xxx',
    method: 'item/commandExecution/requestApproval',
    command: 'ls -la',
    cwd: '/path'
  }
}
```

## REST API

### 健康检查

```bash
GET /health
```

### 创建线程

```bash
POST /api/threads
Content-Type: application/json

{
  "userId": "user123",
  "model": "gpt-5.1-codex"
}
```

## 配置

环境变量：

```bash
PORT=3000                              # 服务器端口
WORKSPACE_ROOT=/tmp/codex-workspaces   # 工作目录根路径
OPENAI_API_KEY=sk-xxx                  # OpenAI API Key
JWT_SECRET=your-secret-key             # JWT 密钥
```

### Approval 策略配置

在 `src/gateway/websocket-gateway.ts` 中可配置：

```typescript
{
  timeoutMs: 5 * 60 * 1000,  // 超时时间（默认5分钟）
  defaultAction: 'decline',   // 超时默认动作
  autoApprove: {
    commands: ['ls', 'cat', 'grep', 'git status', 'git log'],
    paths: ['/tmp/*'],
  }
}
```

**自动批准规则**：
- 只读命令（ls, cat, grep 等）自动批准
- 白名单命令自动批准
- 白名单路径下的操作自动批准

## 项目结构

```
cloud-codex/
├── src/
│   ├── core/
│   │   └── codex-app-server.ts    # App Server 进程封装
│   ├── session/
│   │   └── session-manager.ts     # 会话管理器
│   ├── gateway/
│   │   └── websocket-gateway.ts   # WebSocket 网关
│   ├── types/
│   │   └── protocol.ts            # 协议类型定义
│   └── index.ts                   # 主入口
├── examples/
│   └── client.ts                  # 客户端示例
└── package.json
```

## 开发

```bash
# 开发模式（自动重启）
npm run dev

# 构建
npm run build

# 测试
npm test
```

## 许可证

MIT
