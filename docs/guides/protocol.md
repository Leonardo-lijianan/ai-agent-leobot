## 前后端通信协议

### 核心原则

0. **所有的基本接口** - 所有的基本接口都在 `types.ts` 不能放到其它地方
1. **核心数据模型** - 使用 `types.ts` 中定义的接口（如 `ModelConfig`）
2. **字段名统一** - 前后端使用相同字段名
3. **简单直接** - 简单消息直接用字面量

### 前端 → 后端消息

| 消息类型(参数字段是`type`) | 发送方 | 接收方 | 触发条件 | 参数(不能用`type`字段) | 说明 |
|---------|--------|--------|----------|------|------|
| `send` | chat_view | ChatViewProvider | 用户点击发送按钮或按Ctrl+Enter | `content: string` | 发送聊天消息 |
| `ready` | chat_view | ChatViewProvider | 前端页面加载完成 | 无 | 前端准备就绪，触发模型初始化 |
| `openConfig` | chat_view | ChatViewProvider | 用户点击配置按钮 | 无 | 打开配置面板 |
| `toggleAgentMode` | chat_view | ChatViewProvider | 用户切换Agent模式 | `enabled: boolean` | 切换 Agent 模式 |
| `switchConfig` | chat_view | ChatViewProvider | 用户切换配置 | `type: 'agent' / 'model', id: string` | 切换配置（Agent或模型） |
| `addConfig` | config_panel | ConfigPanel | 用户添加新配置 | `configType: 'model' / 'agent', config: ModelConfig / AgentConfig` | 添加新配置（模型或Agent） |
| `changeConfig` | config_panel | ConfigPanel | 用户修改配置 | `configType: 'model' / 'agent', config: ModelConfig / AgentConfig` | 修改配置（模型或Agent） |
| `deleteConfig` | config_panel | ConfigPanel | 用户删除配置 | `configType: 'model' / 'agent', id: string` | 删除配置（模型或Agent） |
| `testModelConfig` | config_panel | ConfigPanel | 用户点击测试连接按钮 | `config: ModelConfig, agentId: string` | 测试模型连接 |
| `listModels` | config_panel | ConfigPanel | 用户点击获取模型列表按钮 | `provider: string, endpoint: string, apiKey: string` | 获取可用模型列表 |
| `getConfigPath` | config_panel | ConfigPanel | 前端需要获取当前配置路径 | 无 | 获取当前配置路径 |
| `browseConfigPath` | config_panel | ConfigPanel | 用户点击浏览配置路径按钮 | 无 | 浏览新的配置路径 |
| `migrateConfig` | config_panel | ConfigPanel | 用户点击迁移配置按钮 | `newPath: string` | 迁移配置文件 |

### 后端 → 前端消息

| 消息类型 | 发送方 | 接收方 | 触发条件 | 参数 | 说明 |
|---------|--------|--------|----------|------|------|
| `loadConfig` | ConfigPanel | config_panel | 前端请求编辑配置 | `config: ModelConfig / AgentConfig` | 加载配置（模型或Agent） |
| `configResult` | ConfigPanel | config_panel | 配置操作完成 | `type: 'add' / 'change' / 'delete', success: boolean, error?: string` | 配置操作结果 |
| `configPathInfo` | ConfigPanel | config_panel | 前端请求配置路径 | `currentPath: string, error?: string` | 配置路径信息 |
| `browsePathResult` | ConfigPanel | config_panel | 浏览路径操作完成 | `success: boolean, newPath?: string, error?: string` | 浏览路径结果 |
| `migrateResult` | ConfigPanel | config_panel | 迁移配置操作完成 | `success: boolean, message?: string, error?: string` | 迁移配置结果 |
| `listModelsResult` | ConfigPanel | config_panel | 获取模型列表操作完成 | `success: boolean, models?: string[], error?: string` | 获取模型列表结果 |
| `agentModelList` | ConfigPanel | config_panel | 配置面板加载或Agent列表变化 | `agentModels: any[]` | Agent 模型列表 |
| `testResult` | ConfigPanel | config_panel | 测试连接操作完成 | `success: boolean, error?: string` | 测试结果 |
| `configLoaded` | ChatViewProvider | chat_view | 前端准备就绪或配置变化 | `config: {agentModeEnabled, currentAgent, defaultModel}` | 配置加载完成 |
| `agentList` | ChatViewProvider | chat_view | 前端准备就绪或Agent列表变化 | `agents: Array<{id, name}>` | Agent 列表 |
| `modelList` | ChatViewProvider | chat_view | 前端准备就绪或模型列表变化 | `models: Array<{name, modelId, protocolType}>` | 模型列表 |
| `response` | ChatViewProvider | chat_view | 模型生成响应完成 | `message: Message` | 聊天响应 |
| `modelLoaded` | ChatViewProvider | chat_view | 模型初始化完成 | `model: {id, modelId, protocolType, agentMode, agentId, agentName}` | 模型加载完成 |
| `error` | ChatViewProvider | chat_view | 操作失败 | `content: string` | 错误信息 |
| `clear` | ChatViewProvider | chat_view | 用户清空聊天记录 | 无 | 清空聊天记录 |
| `history` | ChatViewProvider | chat_view | 前端准备就绪或聊天记录加载 | `messages: Message[]` | 聊天历史记录 |