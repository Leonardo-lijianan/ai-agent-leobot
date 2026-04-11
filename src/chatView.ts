import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Message, ModelConfig } from './types.js';
import { ModelConfigManager } from './modelConfigManager.js';
import { createModelAdapter, ModelAdapter } from './modelAdapter.js';
import { agentManager } from './agentManager.js';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ai-agent-leobot-chat';
  private _view?: vscode.WebviewView;
  private _messages: Message[] = [];
  private _modelAdapter: ModelAdapter | null = null;
  private _currentModel: string = '';
  private _currentAgentId: string = 'default';
  private _agentModeEnabled: boolean = true;
  private _systemPromptAdded = false;

  constructor(
    private readonly _extensionPath: string,
    private readonly _configManager: ModelConfigManager
  ) {}

  public async resolveWebviewView(
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
    // 先初始化模型，但不等待完成，让视图尽快显示
    // 实际的模型配置会在收到 ready 消息后重新初始化并发送
    this._initializeModel(false).catch(err => {
      console.error('视图初始化模型失败:', err);
    });
  }

  private async _initializeModel(sendMessage: boolean = true) {
    // 获取当前配置
    const config = await this._configManager.getCurrentAgentAndModel();
    this._agentModeEnabled = config.agentModeEnabled;
    this._currentAgentId = config.currentAgent;
    
    // 确定使用哪个模型
    let modelToUse: string;
    
    if (this._agentModeEnabled) {
      // Agent 模式：使用 Agent 关联的模型
      const agent = agentManager.getAgent(this._currentAgentId);
      if (agent) {
        // 如果 Agent 有指定的 modelId，使用它；否则使用 defaultModel
        modelToUse = agent.modelId && agent.modelId !== 'default' 
          ? agent.modelId 
          : config.defaultModel;
      } else {
        // Agent 不存在，回退到 defaultModel
        modelToUse = config.defaultModel;
      }
    } else {
      // 直接模式：直接使用 defaultModel
      modelToUse = config.defaultModel;
    }
    
    // 初始化 Model Adapter
    const modelConfig = this._configManager.getModelByName(modelToUse);
    if (modelConfig) {
      this._currentModel = modelToUse;
      
      // 从配置文件读取 API Key（已解密）
      const apiKey = await this._configManager.getApiKey(modelToUse);
      if (apiKey) {
        modelConfig.apiKey = apiKey;
      }
      
      this._modelAdapter = createModelAdapter(modelConfig);
      
      // 更新 UI 显示当前模型和 Agent 信息
      if (sendMessage) {
        this._view?.webview.postMessage({
          type: 'modelLoaded',
          model: {
            name: modelToUse,
            modelName: modelConfig.modelName || '',
            provider: modelConfig.type,
            agentMode: this._agentModeEnabled,
            agentId: this._currentAgentId,
            agentName: agentManager.getAgent(this._currentAgentId)?.name || '默认助手'
          }
        });
      }
      
      console.log('模型初始化成功', {
        model: modelToUse,
        agentMode: this._agentModeEnabled,
        agentId: this._currentAgentId
      });
    } else {
      console.error('模型配置不存在', { model: modelToUse });
      if (sendMessage) {
        this._view?.webview.postMessage({
          type: 'error',
          content: `模型 "${modelToUse}" 配置不存在，请检查配置`
        });
      }
    }
  }

  private _setupWebviewMessageListener() {
    this._view?.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'send':
          await this._handleSendMessage(message.content);
          break;
        case 'ready':
          // 前端已准备好，发送模型配置信息
          await this._initializeModel(true);
          await this._sendConfigToWebview();
          await this._sendMessagesToWebview();
          break;
        case 'config':
          await this._initializeModel();
          break;
        case 'toggleAgentMode':
          await this.toggleAgentMode(message.enabled);
          break;
        case 'openConfig':
          console.log('⚙️ 收到 openConfig 消息');
          await vscode.commands.executeCommand('ai-agent-leobot.configure');
          break;
      }
    });
  }

  private async _sendConfigToWebview() {
    if (!this._view) return;
    
    try {
      // 获取配置
      const config = await this._configManager.getCurrentAgentAndModel();
      
      // 获取所有 Agent
      const agents = agentManager.getAllAgents();
      
      // 获取所有 Models
      const models = this._configManager.getModels();
      
      // 发送配置信息
      this._view.webview.postMessage({
        type: 'configLoaded',
        config: {
          agentModeEnabled: config.agentModeEnabled,
          currentAgent: config.currentAgent,
          defaultModel: config.defaultModel
        }
      });
      
      // 发送 Agent 列表
      this._view.webview.postMessage({
        type: 'agentList',
        agents: agents.map(a => ({
          id: a.id,
          name: a.name
        }))
      });
      
      // 发送 Model 列表
      this._view.webview.postMessage({
        type: 'modelList',
        models: models.map(m => ({
          name: m.name,
          modelName: m.modelName || '',
          type: m.type
        }))
      });
      
      console.log('已发送配置信息到前端', {
        agentModeEnabled: config.agentModeEnabled,
        currentAgent: config.currentAgent,
        defaultModel: config.defaultModel,
        agentsCount: agents.length,
        modelsCount: models.length
      });
    } catch (error: any) {
      console.error('发送配置信息失败', error);
    }
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

    // 只在 Agent 模式下添加 System Prompt
    if (this._agentModeEnabled && !this._systemPromptAdded) {
      const agent = agentManager.getAgent(this._currentAgentId);
      if (agent && agent.systemPrompt) {
        messagesToSend.unshift({
          role: 'system',
          content: agent.systemPrompt,
          timestamp: Date.now()
        });
        this._systemPromptAdded = true;
        console.log('已添加 Agent System Prompt', { 
          agentId: this._currentAgentId,
          agentName: agent.name 
        });
      }
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

  async toggleAgentMode(enabled: boolean) {
    // 保存配置
    await this._configManager.setAgentModeEnabled(enabled);
    this._agentModeEnabled = enabled;
    this._systemPromptAdded = false;
    
    // 重新初始化模型
    await this._initializeModel();
    
    // 清空消息历史
    this._messages = [];
    this._view?.webview.postMessage({
      type: 'clear'
    });
    
    console.log('Agent 模式已切换', { enabled });
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
    <!-- 顶部控制栏 -->
    <div class="control-bar">
      <div class="control-group">
        <label class="control-label">模式：</label>
        <select id="modeSelect" class="control-select">
          <option value="agent">🤖 Agent 模式</option>
          <option value="direct">⚡ 直接模式</option>
        </select>
      </div>
      
      <div class="control-group" id="agentSelectorGroup">
        <label class="control-label">Agent：</label>
        <select id="agentSelect" class="control-select">
          <option value="default">默认助手</option>
        </select>
      </div>
      
      <div class="control-group">
        <label class="control-label">模型：</label>
        <select id="modelSelect" class="control-select">
          <option value="">加载中...</option>
        </select>
      </div>
    </div>
    
    <!-- 聊天区域 -->
    <div class="chat-content">
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
  </div>
  
  <div class="input-container">
    <div id="currentModel" class="model-info">当前模型：未加载</div>
    <div class="input-wrapper">
      <textarea id="messageInput" placeholder="输入消息，按 Ctrl+Enter 发送..." rows="3"></textarea>
      <button id="sendButton" title="发送 (Ctrl+Enter)">发送</button>
    </div>
    <div class="button-row">
      <button id="testMarkdownBtn">测试 Markdown</button>
      <button id="configBtn">⚙️ 配置</button>
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
