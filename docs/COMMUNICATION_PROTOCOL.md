## 前后端通信协议

### 核心原则

0. **所有的基本接口** - 所有的基本接口都在 `types.ts` 不能放到其它地方
1. **核心数据模型** - 使用 `types.ts` 中定义的接口（如 `ModelConfig`）
2. **字段名统一** - 前后端使用相同字段名
3. **简单直接** - 简单消息直接用字面量

### 前端 → 后端消息

| 消息类型 | 参数 | 说明 |
|---------|------|------|
| `send` | `content: string` | 发送聊天消息 |
| `ready` | 无 | 前端准备就绪 |
| `openConfig` | 无 | 打开配置面板 |
| `toggleAgentMode` | `enabled: boolean` | 切换 Agent 模式 |
| `switchAgent` | `agentId: string` | 切换 Agent |
| `switchModel` | `modelId: string` | 切换模型 |
| `test` | `config: ModelConfig` | 测试连接 |
| `saveModelConfig` | `config: ModelConfig` | 保存配置 |
| `listModels` | `config: ModelConfig` | 获取可用模型列表 |

### 后端 → 前端消息

| 消息类型 | 参数 | 说明 |
|---------|------|------|
| `loadConfig` | `config: ModelConfig` | 加载配置 |
| `agentList` | `agents: Array<{id, name}>` | Agent 列表 |
| `modelList` | `models: ModelConfig[]` | 模型列表 |
| `testResult` | `success: boolean, error?: string` | 测试结果 |
| `response` | `message: Message` | 聊天响应 |
| `modelLoaded` | `model: {id, modelId, protocolType, ...}` | 模型加载完成 |