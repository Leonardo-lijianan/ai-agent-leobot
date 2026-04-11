# Change Log

All notable changes to the "ai-agent-leobot" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Initial release

## [0.0.1] - 2026-04-10

### Added
- ✨ 基础 AI 聊天功能，支持 Webview 聊天界面
- 🔧 配置面板，支持多模型提供商配置（硅基流动、OpenAI、Google Gemini）
- 🤖 Google Gemini API 支持（使用新版 `@google/genai` SDK）
- 📋 查看可用模型功能（Gemini Top 5 模型列表）
-  HTTP 代理支持（解决 Gemini API 地理位置限制）
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
-  手动声明 GoogleGenAI 类型定义
- 📊 完整的调试日志系统

太好了！🎉 让我们总结一下这个项目完成的工作：

## 项目总结

### ✅ 已完成的功能

**1. 核心功能**
- ✨ AI 聊天界面（Webview）
- 🔧 多模型配置（硅基流动、OpenAI、Google Gemini）
- 🤖 Google Gemini API 完整支持
- 📋 查看可用模型列表
- 🎯 代码解释和优化（右键菜单）
- 📝 Markdown 渲染

**2. 技术架构**
- 🔄 ESM 模块系统（TypeScript + Node16）
- 🔒 Webview CSP 安全策略
- 🎨 完美适配 VS Code 主题（明暗色）
- 📊 完整的调试日志系统

**3. UI/UX 优化**
- 💬 对话气泡布局（用户右对齐，AI 左对齐）
- 🏷️ 角色标签（标签在上，气泡在下）
- 🎨 主题自适应（CSS 变量）
- ⚡ 自动填充预设配置

**4. 代码质量**
- 📦 清理未使用依赖
- 📝 完整的 CHANGELOG
- ✅ TypeScript 类型安全
- 🔍 ESLint 代码检查

### 📦 项目依赖

```json
{
  "@google/genai": "^1.49.0",  // Google Gemini SDK
  "openai": "^4.28.0",         // OpenAI 兼容（硅基流动）
  "markdown-it": "^14.1.1"     // Markdown 渲染
}
```

### 🎯 项目状态

**现在是一个功能完整的 VS Code AI 助手扩展！**

可以：
- ✅ 正常编译运行
- ✅ 完美适配 VS Code 主题
- ✅ 支持多个 AI 模型提供商
- ✅ 流畅的聊天体验