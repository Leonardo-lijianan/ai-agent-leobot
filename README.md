# AI Agent LeoBot

本地 AI Agent 运行时，支持多模型编排、MCP 工具和自定义 Skills

## 功能特性

- 🤖 **多模型支持** - OpenAI、硅基流动、Google Gemini 等
- 💬 **智能聊天** - Webview 聊天界面，Markdown 渲染
- 🔧 **MCP 工具** - 文件读写、目录浏览、文件搜索
- 📁 **文件操作** - 读取、写入、插入内容、列出目录
- ✨ **Skills 系统** - 代码重构、功能添加、问题调试
- 🎯 **Agent 模式** - 支持 Agent 编排和直接对话两种模式
- 🔒 **API Key 加密** - 使用 VS Code SecretStorage 安全存储
- 💾 **聊天记录** - 永久化存储，按 Agent 和 Model 维度分离
- 🌐 **代理支持** - HTTP 代理支持（解决地理位置限制）

## 使用方法

### 1. 配置 API Key
- 点击侧边栏的 AI Agent LeoBot 图标
- 在配置面板中添加模型和 API Key
- API Key 会自动加密存储

### 2. 开始聊天
- 在聊天框中输入问题
- 支持 Markdown 格式输出
- 支持代码高亮和表格

### 3. 使用 MCP 工具
- AI 可以自动调用文件操作工具
- 支持相对路径（基于工作空间目录）
- 可用工具：
  - `read_file` - 读取文件
  - `write_file` - 写入文件
  - `list_directory` - 列出目录
  - `search_files` - 搜索文件
  - `insert_lines` - 插入内容

### 4. 使用 Skills
- 复杂任务会自动使用 Skills
- 可用 Skills：
  - `refactor-code` - 重构代码
  - `add-feature` - 添加功能
  - `debug-issue` - 调试问题

### 5. 代码解释/优化
- 选中代码
- 右键 → AI Agent → 解释代码 / 优化代码

### 6. 切换模式
- **Agent 模式** - 启用工具和 Skills，适合复杂任务
- **直接模式** - 纯对话，适合简单交流
- **切换 Agent** - 不同 Agent 有独立的聊天记录
- **切换 Model** - 不同 Model 有独立的聊天记录

### 7. 聊天记录管理
- 聊天记录自动保存，按 Agent 和 Model 维度分离
- 切换 Agent 或 Model 时自动加载对应的聊天记录
- 直接模式使用独立的存储空间（`direct_{modelId}.json`）
- 不同 Agent 之间的聊天内容完全独立，不会串台

## 配置说明

在配置面板中配置模型信息，或使用 settings.json：

```json
{
  "aiAgentLeoBot.models": [
    {
      "name": "My Model",
      "type": "openai",
      "apiBase": "https://api.example.com",
      "apiKey": "your-api-key",
      "model": "gpt-4"
    }
  ]
}
```

### 支持的模型提供商

- **硅基流动** - `https://api.siliconflow.cn/v1`
  - Qwen/Qwen3.5-122B-A10B
  - Qwen/Qwen2.5-72B-Instruct
  - 等开源模型

- **OpenAI** - `https://api.openai.com/v1`
  - gpt-4
  - gpt-3.5-turbo
  - 等 OpenAI 模型

- **Google Gemini** - 使用 `@google/genai` SDK
  - gemini-2.0-flash
  - gemini-1.5-pro
  - 等 Gemini 模型

## 项目结构

```
ai-agent-leobot/
├── src/
│   ├── extension.ts          # 扩展入口
│   ├── chatView.ts           # 聊天视图提供者
│   ├── configPanel.ts        # 配置面板
│   ├── modelAdapter.ts       # 模型适配器（OpenAI/Gemini）
│   ├── modelConfigManager.ts # 模型配置管理
│   ├── agentConfigManager.ts # Agent 配置管理
│   ├── agentManager.ts       # Agent 管理器
│   ├── mcp.ts                # MCP 服务器
│   ├── skills.ts             # Skills 管理
│   ├── toolRegistry.ts       # 工具注册表
│   ├── crypto.ts             # API Key 加密
│   └── logger.ts             # 日志系统
├── media/
│   ├── chatView.html         # 聊天视图 HTML
│   ├── chatView.js           # 聊天视图脚本
│   └── configPanel.html      # 配置面板 HTML
└── package.json              # 扩展配置
```

## 技术特性

- ✅ **ESM 模块系统** - TypeScript + Node16 模块解析
- ✅ **Webview CSP** - 严格的内容安全策略
- ✅ **主题适配** - 完美适配 VS Code 明暗主题
- ✅ **类型安全** - 完整的 TypeScript 类型定义
- ✅ **调试日志** - 详细的调试信息输出

## 已知问题

无

## 更新日志

### 0.0.3

- ✨ 聊天记录按 Agent 和 Model 维度分离
- ✨ 切换 Agent/Model 时自动加载对应聊天记录
- ✨ 直接模式独立存储（`direct_{modelId}.json`）
- ✨ 直接模式下自动隐藏 Agent 选择器
- 🐛 修复切换 Agent/Model 时聊天记录无法加载的问题
- 🐛 修复模式切换时聊天记录被清空的问题
- 🐛 修复文件名路径安全性问题（防止路径遍历攻击）
- 🐛 改进跨平台兼容性（支持 Windows、macOS、Linux）
- 🐛 支持中文模型 ID（如"硅基流动"）

### Unreleased

- 🔒 增强文件名安全性验证（6 层防护）
- 🔒 添加控制字符过滤（ASCII 0-31）
- 🔒 添加 Windows 保留文件名检查
- 🔒 添加文件名长度限制（255 字符）

### 0.0.2

- ✨ 聊天记录永久化存储（按模式分离）
- ✨ Agent 模式和直接模式切换
- ✨ API Key 加密存储（VS Code SecretStorage）
- ✨ 工具调用优化（仅 Agent 模式启用）
- 🐛 修复配置面板按钮点击问题
- 🐛 修复 Markdown 渲染失效问题
- 🐛 修复系统提示词丢失问题

### 0.0.1

- 初始版本
- 支持 OpenAI 兼容模型
- 实现 MCP 文件系统
- 添加代码解释和优化功能

## 对于更多信息

* [Visual Studio Code 扩展指南](https://code.visualstudio.com/api/references/extension-guidelines)
* [Markdown 语法参考](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
