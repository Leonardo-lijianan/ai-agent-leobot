import * as vscode from 'vscode';
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

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

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

  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Agent Chat</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .message {
      margin-bottom: 16px;
      padding: 12px;
      border-radius: 8px;
      line-height: 1.5;
    }

    .message.user {
      background-color: var(--vscode-input-background);
      border-left: 3px solid var(--vscode-button-background);
    }

    .message.assistant {
      background-color: var(--vscode-editor-background);
      border-left: 3px solid var(--vscode-editor-foreground);
    }

    .message.error {
      background-color: var(--vscode-inputValidation-errorBackground);
      border-left: 3px solid var(--vscode-errorForeground);
    }

    .message-role {
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 0.9em;
      opacity: 0.8;
    }

    .message-content {
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .input-container {
      padding: 16px;
      border-top: 1px solid var(--vscode-widget-border);
      background-color: var(--vscode-sideBar-background);
    }

    .input-wrapper {
      display: flex;
      gap: 8px;
    }

    textarea {
      flex: 1;
      resize: none;
      padding: 8px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      min-height: 60px;
    }

    textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    button {
      padding: 8px 16px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: var(--vscode-font-size);
    }

    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid var(--vscode-progressBar-background);
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .welcome {
      text-align: center;
      padding: 40px 20px;
      color: var(--vscode-descriptionForeground);
    }

    .welcome h2 {
      margin-bottom: 16px;
      color: var(--vscode-foreground);
    }

    .welcome p {
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="chat-container" id="chatContainer">
    <div class="welcome">
      <h2>🤖 AI Agent LeoBot</h2>
      <p>欢迎使用 AI Agent 聊天</p>
      <p>配置 API Key 后即可开始对话</p>
      <p style="margin-top: 16px; font-size: 0.9em;">
        当前模型：<strong id="currentModel">未配置</strong>
      </p>
    </div>
  </div>
  <div class="input-container">
    <div class="input-wrapper">
      <textarea 
        id="messageInput" 
        placeholder="输入消息，按 Ctrl+Enter 发送..."
        rows="3"
      ></textarea>
      <button id="sendButton" title="发送 (Ctrl+Enter)">发送</button>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const currentModelEl = document.getElementById('currentModel');

    let isLoading = false;

    function addMessage(message) {
      const existingWelcome = chatContainer.querySelector('.welcome');
      if (existingWelcome) {
        existingWelcome.remove();
      }

      const messageDiv = document.createElement('div');
      messageDiv.className = 'message ' + message.role;
      
      const roleText = message.role === 'user' ? '👤 你' : 
                       message.role === 'assistant' ? '🤖 AI' : '⚠️ 错误';
      
      messageDiv.innerHTML = \`
        <div class="message-role">\${roleText}</div>
        <div class="message-content">\${escapeHtml(message.content)}</div>
      \`;
      
      chatContainer.appendChild(messageDiv);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function clearMessages() {
      chatContainer.innerHTML = '';
    }

    function setLoading(loading) {
      isLoading = loading;
      sendButton.disabled = loading;
      messageInput.disabled = loading;
      
      if (loading) {
        sendButton.innerHTML = '<span class="loading"></span>';
      } else {
        sendButton.textContent = '发送';
      }
    }

    function sendMessage() {
      const content = messageInput.value.trim();
      if (!content || isLoading) return;

      vscode.postMessage({ type: 'send', content });
      messageInput.value = '';
      setLoading(true);
    }

    sendButton.addEventListener('click', sendMessage);

    messageInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        sendMessage();
      }
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      
      switch (message.type) {
        case 'response':
          addMessage(message.message);
          setLoading(false);
          break;
        case 'error':
          addMessage({ role: 'error', content: message.content });
          setLoading(false);
          break;
        case 'history':
          clearMessages();
          message.messages.forEach(msg => addMessage(msg));
          break;
        case 'clear':
          clearMessages();
          break;
        case 'model':
          currentModelEl.textContent = message.modelName;
          break;
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
