# Change Log

All notable changes to the "ai-agent-leobot" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Fixed
- 🐛 **文件名安全性验证增强** - 实现完整的跨平台文件名验证逻辑
- 🐛 **控制字符过滤** - 禁止 ASCII 0-31 控制字符（包括空字符）
- 🐛 **Windows 保留名检查** - 禁止 CON、PRN、AUX、NUL、COM1-9、LPT1-9
- 🐛 **文件名长度限制** - 限制文件名最大 255 字符（Windows 限制）
- 🐛 **路径遍历防护** - 多层验证防止路径注入攻击

### Technical
- 🔒 **6 层安全防护** - 空值检查、路径分隔符、控制字符、basename、Windows 字符、保留名、长度检查
- 🛡️ **跨平台兼容** - 支持 Windows、macOS、Linux 所有平台的文件名规范
- 📝 **chatHistoryManager.ts** - 增强 `getHistoryFilePath()` 方法的安全验证逻辑

## [0.0.3] - 2026-04-12

### Added
- ✨ **聊天记录按 Agent 分离** - 不同 Agent 使用独立的聊天记录文件
- ✨ **聊天记录按 Model 分离** - 不同 Model 使用独立的聊天记录文件
- ✨ **智能上下文切换** - 切换 Agent/Model 时自动加载对应的聊天记录
- ✨ **直接模式独立存储** - 直接模式使用 `direct_{modelId}.json` 存储

### Changed
- 🔄 **存储结构优化** - 聊天记录文件名从 `{mode}_{modelId}.json` 改为 `{agentId}_{modelId}.json`
- 🔄 **ChatHistoryManager 重构** - 支持按 Agent 和 Model 维度管理聊天记录
- 🔄 **UI 交互优化** - 直接模式下自动隐藏 Agent 选择器

### Fixed
- 🐛 **聊天记录加载** - 修复切换 Agent/Model 时聊天记录无法正确加载的问题
- 🐛 **模式切换逻辑** - 修复切换模式时聊天记录被意外清空的问题
- 🐛 **文件名路径安全性** - 修复文件名直接使用 `${agentId}_${modelId}` 可能存在的路径遍历风险
- 🐛 **跨平台兼容性** - 改进文件名验证逻辑，支持 Windows、macOS、Linux 所有平台
- 🐛 **中文模型 ID 支持** - 修复中文模型 ID（如"硅基流动"）无法通过验证的问题

### Technical
- 📝 **ChatHistoryManager** - 新增 `setCurrentContext(agentId, modelId)` 方法
- 📝 **chatView.ts** - 优化 `switchAgent`、`switchModel`、`toggleAgentMode` 方法逻辑
- 📝 **CSS 样式** - 使用 `!important` 确保 Agent 选择器显示/隐藏样式优先级
- 🔒 **路径安全验证** - 实现跨平台文件名安全性验证（禁止路径分隔符、空字符、Windows 特殊字符）
- 🛡️ **多层防护** - 使用 path.basename() 提取纯文件名，防止路径遍历攻击

## 更新日志

### 0.0.3

- ✨ 聊天记录按 Agent 和 Model 维度分离
- ✨ 切换 Agent/Model 时自动加载对应聊天记录
- ✨ 直接模式独立存储（`direct_{modelId}.json`）
- ✨ 直接模式下自动隐藏 Agent 选择器
- 🐛 修复切换 Agent/Model 时聊天记录无法加载的问题
- 🐛 修复模式切换时聊天记录被清空的问题

## [0.0.2] - 2026-04-12

### Added
- ✨ **聊天记录永久化存储** - 使用 JSON 文件持久化保存聊天历史
- ✨ **模式分离** - Agent 模式和直接模式使用独立的聊天记录文件
- ✨ **API Key 加密** - 使用 VS Code SecretStorage 和 crypto-js 加密存储 API Key
- ✨ **工具调用控制** - 仅在 Agent 模式下启用工具调用
- ✨ **系统提示词管理** - Agent 模式使用完整的系统提示词（包含工具说明）
- ✨ **错误处理增强** - 详细的 API 错误信息输出

### Changed
- 🔄 **架构优化** - 将 DOM 操作和事件监听器从 HTML 迁移到 TypeScript
- 🔄 **配置面板重构** - 分离前端（configPanelView.ts）和后端（configPanel.ts）逻辑
- 🔄 **系统提示词优化** - 使用 AgentManager.getDefaultSystemPrompt() 获取完整提示词
- 🔄 **工具调用逻辑** - 根据模式动态启用/禁用工具

### Fixed
- 🐛 **配置面板按钮** - 修复按钮不可点击问题（使用内联脚本注入）
- 🐛 **Markdown 渲染** - 修复重新打开聊天视图时 Markdown 失效问题
- 🐛 **系统提示词丢失** - 修复重新加载聊天记录后 system prompt 标志未重置问题
- 🐛 **AI 身份识别** - 修复直接模式下 AI 仍显示为"AI 助手"的问题（禁用工具）
- 🐛 **TypeScript 编译** - 创建独立的 frontend tsconfig（module: "None"）

### Technical
- 📝 **ChatHistoryManager** - 新增聊天记录管理类，支持模式分离和持久化
- 📝 **多 TypeScript 配置** - tsconfig.json（后端）和 tsconfig.frontend.json（前端）
- 📝 **编译脚本** - npm run compile:backend 和 npm run compile:frontend
- 🔒 **加密模块** - 使用 AES 加密算法保护 API Key
- 📊 **日志系统** - 完整的调试日志，包括请求体 JSON 输出

## [0.0.1] - 2026-04-10

### Added
- ✨ 基础 AI 聊天功能，支持 Webview 聊天界面
- 🔧 配置面板，支持多模型提供商配置（硅基流动、OpenAI、Google Gemini）
- 🤖 Google Gemini API 支持（使用新版 `@google/genai` SDK）
- 📋 查看可用模型功能（Gemini Top 5 模型列表）
- 🌐 HTTP 代理支持（解决 Gemini API 地理位置限制）
- 🎯 代码解释和优化功能（右键菜单）
- 📝 Markdown 渲染支持（使用 markdown-it）
- ⚙️ 自动填充预设配置（API 端点和模型名称）

### Changed
- 🔄 从 CommonJS 迁移到 ESM 模块系统
- 🔄 迁移到新版 Google GenAI SDK (`@google/genai` v1.49.0)
- 🎨 优化配置面板 UI 和用户体验
- 📦 清理未使用的依赖（dompurify、https-proxy-agent）

### Fixed
- 🐛 修复 ESM 迁移后配置面板空白问题
- 🐛 修复 TypeScript 导入路径扩展名问题
- 🐛 修复 Gemini API 类型定义问题
- 🐛 修复配置面板自动填充功能

### Technical
- 📝 TypeScript + ESM 配置（Node16 模块解析）
- 🔒 添加 Webview CSP 安全策略
- 📝 手动声明 GoogleGenAI 类型定义
- 📊 完整的调试日志系统
