import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Message } from './types';
import { ConfigManager } from './configManager';
import { createModelAdapter, ModelAdapter } from './modelAdapter';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ai-agent-leobot-chat';
  private _view?: vscode.WebviewView;
  private _messages: Message[] = [];
  private _modelAdapter: ModelAdapter | null = null;
  private _currentModel: string = '';
  private _systemPromptAdded = false;

  constructor(
    private readonly _extensionPath: string,
    private readonly _configManager: ConfigManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(this._extensionPath)]
    };

    // 加载 Markdown 测试文本
    const markdownPath = path.join(this._extensionPath, 'media', 'testMarkdown.md');
    let testMarkdownText = '# Markdown 测试文本\n\n加载中...';
    try {
      testMarkdownText = fs.readFileSync(markdownPath, 'utf-8');
    } catch (error) {
      console.error('加载 Markdown 测试文件失败:', error);
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, testMarkdownText);

    this._setupWebviewMessageListener();
    this._initializeModel();
  }

  private async _initializeModel() {
    const defaultModel = this._configManager.getDefaultModel();
    const modelConfig = this._configManager.getModelByName(defaultModel);
    
    if (modelConfig) {
      this._currentModel = defaultModel;
      this._modelAdapter = createModelAdapter(modelConfig);
    }
  }

  private _setupWebviewMessageListener() {
    this._view?.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'send':
          await this._handleSendMessage(message.content);
          break;
        case 'ready':
          await this._sendMessagesToWebview();
          break;
        case 'config':
          await this._initializeModel();
          break;
      }
    });
  }

  private async _handleSendMessage(content: string) {
    if (!this._modelAdapter) {
      this._view?.webview.postMessage({
        type: 'error',
        content: '模型未初始化，请检查配置'
      });
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: Date.now()
    };
    this._messages.push(userMessage);

    const messagesToSend: Message[] = [...this._messages];

    if (!this._systemPromptAdded) {
      const systemPrompt = `你是一个智能编程助手，可以访问本地文件系统来帮助用户完成编程任务。

你拥有以下工具能力：
1. read_file - 读取文件内容
2. write_file - 写入/修改文件内容  
3. list_directory - 列出目录内容
4. search_files - 搜索文件
5. insert_lines - 在文件指定位置插入行

**工作流程：**
1. 如果用户明确要求修改/添加内容 → **直接使用 write_file 或 insert_lines**，不要先读取
2. 如果用户要求查看文件 → 使用 read_file
3. 如果需要了解文件内容才能修改 → 先 read_file，然后立即 write_file/insert_lines

**重要规则：**
- 工具调用后，你会看到工具执行结果
- 根据工具结果继续下一步操作，**不要重复调用相同的工具**
- 如果用户明确要求修改文件，**不要先读取再修改，直接修改**
- 最多进行 3 次工具调用循环

请根据用户的具体需求选择合适的工具。`;

      messagesToSend.unshift({
        role: 'system',
        content: systemPrompt,
        timestamp: Date.now()
      });
      this._systemPromptAdded = true;
    }

    try {
      const response = await this._modelAdapter.chat(messagesToSend, undefined, true);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };
      this._messages.push(assistantMessage);

      this._view?.webview.postMessage({
        type: 'response',
        message: assistantMessage
      });
    } catch (error: any) {
      this._view?.webview.postMessage({
        type: 'error',
        content: error.message || '调用失败，请检查 API Key 和网络连接'
      });
    }
  }

  private async _sendMessagesToWebview() {
    this._view?.webview.postMessage({
      type: 'history',
      messages: this._messages
    });
  }

  public async sendMessage(content: string) {
    await this._handleSendMessage(content);
  }

  public clearChat() {
    this._messages = [];
    this._view?.webview.postMessage({
      type: 'clear'
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview, testMarkdownText: string): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(vscode.Uri.file(this._extensionPath), 'media', 'chatView.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(vscode.Uri.file(this._extensionPath), 'media', 'chatView.css')
    );

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Agent LeoBot</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="chatContainer">
    <div class="welcome">
      <h2>🤖 AI Agent LeoBot</h2>
      <p>你好！我是 LeoBot，你的 AI 编程助手。</p>
      <p>我可以帮你：</p>
      <ul>
        <li>编写和调试代码</li>
        <li>解释代码逻辑</li>
        <li>回答编程问题</li>
        <li>提供代码优化建议</li>
      </ul>
      <p>请输入消息开始交流！</p>
    </div>
  </div>
  
  <div class="input-container">
    <div id="currentModel" class="model-info">当前模型：未加载</div>
    <div class="input-wrapper">
      <textarea id="messageInput" placeholder="输入消息，按 Ctrl+Enter 发送..." rows="3"></textarea>
      <button id="sendButton" title="发送 (Ctrl+Enter)">发送</button>
    </div>
    <div class="input-wrapper" style="margin-top: 8px;">
      <button id="testMarkdownBtn" title="测试 Markdown 渲染" style="background-color: var(--vscode-button-secondaryBackground);">测试 Markdown</button>
    </div>
  </div>
  
  <script>
    window.testMarkdownText = ${JSON.stringify(testMarkdownText)};
  </script>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
