# AI Agent LeoBot

本地 AI Agent 运行时，支持多模型编排和自定义 Skills

## 功能特性

- 🤖 支持多个 AI 模型（OpenAI、硅基流动等）
- 💬 智能聊天界面，支持流式输出
- 🔧 MCP（Model Context Protocol）支持，让 AI 可以访问本地文件
- 📁 文件读写、目录浏览、文件搜索
- ✨ 代码解释和优化功能
- 🎯 自定义 Skills 系统

## 使用方法

1. 配置 API Key
   - 点击侧边栏的 AI Agent LeoBot 图标
   - 在设置中添加您的 API Key 和模型配置

2. 开始聊天
   - 在聊天框中输入问题
   - 支持 Markdown 格式输出

3. 使用 MCP 工具
   - AI 可以自动调用文件读写工具
   - 支持相对路径（基于工作空间目录）

4. 代码解释/优化
   - 选中代码
   - 右键 → AI Agent → 解释代码 / 优化代码

## 配置说明

在设置中配置模型信息：

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

## 已知问题

无

## 更新日志

### 0.0.1

- 初始版本
- 支持 OpenAI 兼容模型
- 实现 MCP 文件系统
- 添加代码解释和优化功能

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
