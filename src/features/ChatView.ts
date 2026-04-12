import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Message, ModelConfig, ModelAdapter } from '../types.js';
import { ModelConfigManager } from '../managers/ModelConfigManager.js';
import { createModelAdapter } from '../adapters/modelAdapter.js';
import { agentManager } from '../managers/AgentManager.js';
import { Logger } from '../utils/Logger.js';
import { chatHistoryManager } from '../managers/ChatHistoryManager.js';

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
    let modelConfigId: string;
    
    if (this._agentModeEnabled) {
      // Agent 模式：使用 Agent 关联的模型
      const agent = agentManager.getAgent(this._currentAgentId);
      if (agent) {
        // 如果 Agent 有指定的 modelId，使用它；否则使用 defaultModel
        modelConfigId = agent.modelConfigId && agent.modelConfigId !== 'default' 
          ? agent.modelConfigId 
          : config.defaultModel;
      } else {
        // Agent 不存在，回退到 defaultModel
        modelConfigId = config.defaultModel;
      }
    } else {
      // 直接模式：直接使用 defaultModel
      modelConfigId = config.defaultModel;
    }
    
    // 设置聊天记录上下文（会自动加载对应的聊天记录）
    // 直接模式使用特殊的 agentId 标识
    const historyAgentId = this._agentModeEnabled ? this._currentAgentId : 'direct';
    chatHistoryManager.setCurrentContext(historyAgentId, modelConfigId);
    
    // 从持久化存储加载聊天记录
    this._messages = chatHistoryManager.getHistory();
    // 重置 system prompt 标志，因为历史消息中不包含 system prompt
    this._systemPromptAdded = false;
    
    // 初始化 Model Adapter
    const modelConfig = this._configManager.getModelByName(modelConfigId);
    if (modelConfig) {
      this._currentModel = modelConfigId;
      
      // 从配置文件读取 API Key
      const apiKey = await this._configManager.getApiKey(modelConfigId);
      Logger.info('获取 API Key', {
        model: modelConfigId,
        apiKeyExists: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        apiKeyPrefix: apiKey ? apiKey.substring(0, 3) + '...' : '无',
        protocolType: modelConfig.protocolType
      });
      
      if (apiKey) {
        modelConfig.apiKey = apiKey;
      }
      
      this._modelAdapter = createModelAdapter(modelConfig);
      
      // 更新 UI 显示当前模型和 Agent 信息
      if (sendMessage) {
        this._view?.webview.postMessage({
          type: 'modelLoaded',
          model: {
            id: modelConfig.id,
            modelId: modelConfig.modelId || '',
            protocolType: modelConfig.protocolType,
            agentMode: this._agentModeEnabled,
            agentId: this._currentAgentId,
            agentName: agentManager.getAgent(this._currentAgentId)?.name || '默认助手'
          }
        });
      }
      
      console.log('模型初始化成功', {
        model: modelConfigId,
        agentMode: this._agentModeEnabled,
        agentId: this._currentAgentId
      });
    } else {
      console.error('模型配置不存在', { model: modelConfigId });
      if (sendMessage) {
        this._view?.webview.postMessage({
          type: 'error',
          content: `模型 "${modelConfigId}" 配置不存在，请检查配置`
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
        case 'switchAgent':
          await this.switchAgent(message.agentId);
          break;
        case 'switchModel':
          await this.switchModel(message.modelId);
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
          name: m.id,
          modelId: m.modelId || '',
          protocolType: m.protocolType
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
    // 保存到持久化存储
    chatHistoryManager.addMessage(userMessage);

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
      // 只在 Agent 模式下启用工具
      const enableTools = this._agentModeEnabled;
      const response = await this._modelAdapter.chat(messagesToSend, undefined, enableTools);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };
      this._messages.push(assistantMessage);
      // 保存到持久化存储
      chatHistoryManager.addMessage(assistantMessage);

      this._view?.webview.postMessage({
        type: 'response',
        message: assistantMessage
      });
    } catch (error: any) {
      this._view?.webview.postMessage({
        type: 'error',
        content: error.message || '调用失败，请检查 API Key 和网络连接'
      });
      // 失败时移除最后一条用户消息
      this._messages.pop();
      chatHistoryManager.removeLastMessage();
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
    // 清空持久化存储
    chatHistoryManager.clearHistory();
    this._view?.webview.postMessage({
      type: 'clear'
    });
  }

  async toggleAgentMode(enabled: boolean) {
    // 保存配置
    await this._configManager.setAgentModeEnabled(enabled);
    this._agentModeEnabled = enabled;
    this._systemPromptAdded = false;
    
    // 重新初始化模型（会自动加载对应的聊天记录）
    await this._initializeModel();
    
    // 不需要清空消息历史，因为 _initializeModel 已经加载了对应的聊天记录
    // 直接发送历史消息到前端
    await this._sendMessagesToWebview();
    
    console.log('Agent 模式已切换', { enabled });
  }

  async switchAgent(agentId: string) {
    console.log('切换 Agent', { agentId });
    
    // 保存配置
    await this._configManager.setCurrentAgent(agentId);
    this._currentAgentId = agentId;
    this._systemPromptAdded = false;
    
    // 重新初始化模型（会自动加载对应的聊天记录）
    await this._initializeModel();
    
    // 发送加载的历史记录到前端
    await this._sendMessagesToWebview();
    
    console.log('Agent 已切换', { agentId });
  }

  async switchModel(modelId: string) {
    console.log('切换 Model', { modelId });
    
    // 保存配置
    await this._configManager.setDefaultModel(modelId);
    this._systemPromptAdded = false;
    
    // 重新初始化模型（会自动加载对应的聊天记录）
    await this._initializeModel();
    
    // 发送加载的历史记录到前端
    await this._sendMessagesToWebview();
    
    console.log('Model 已切换', { modelId });
  }

  public refresh() {
    // 重新初始化模型和配置
    this._initializeModel(true).catch(err => {
      console.error('刷新聊天视图失败:', err);
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview, testMarkdownText: string): string {
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
  <style>
    /* 内联关键样式，确保尽快渲染 */
    body { margin: 0; padding: 0; }
    #chatContainer { display: flex; flex-direction: column; height: 100vh; }
    .chat-content { flex: 1; overflow-y: auto; padding: 20px; }
    .input-container { border-top: 1px solid var(--vscode-widget-border); padding: 16px; }
  </style>
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
  
  <!-- 引入 markdown-it 和 DOMPurify -->
  <script src="https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/dist/markdown-it.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/markdown-it-footnote@3.0.3/dist/markdown-it-footnote.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/markdown-it-task-lists@2.1.1/dist/markdown-it-task-lists.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
  
  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      const testMarkdownText = ${JSON.stringify(testMarkdownText)};
      
      let isLoading = false;
      let currentAgentMode = true;
      let md = null;
      let isMarkdownInitialized = false;
      
      // 初始化 markdown-it
      function initMarkdown() {
        if (isMarkdownInitialized) return;
        
        if (typeof window.markdownit !== 'undefined') {
          md = window.markdownit({
            html: false,
            xhtmlOut: false,
            breaks: false,
            langPrefix: 'language-',
            linkify: false,
            typographer: false,
            quotes: '""\\'\\''
          });
          
          if (typeof window.markdownitFootnote !== 'undefined') {
            md.use(window.markdownitFootnote);
          }
          
          if (typeof window.markdownitTaskLists !== 'undefined') {
            md.use(window.markdownitTaskLists);
          }
          
          isMarkdownInitialized = true;
          console.log('Markdown 初始化完成');
        }
      }
      
      // 立即尝试初始化
      initMarkdown();
      
      // 如果还没加载完成，继续轮询
      const initInterval = setInterval(() => {
        initMarkdown();
        if (isMarkdownInitialized) {
          clearInterval(initInterval);
        }
      }, 100);
      
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }
      
      function addMessage(message) {
        const chatContainer = document.getElementById('chatContainer');
        const chatContent = chatContainer.querySelector('.chat-content');
        const existingWelcome = chatContent.querySelector('.welcome');
        if (existingWelcome) {
          existingWelcome.remove();
        }
        
        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'message-wrapper ' + message.role;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ' + message.role;
        
        const roleText = message.role === 'user' ? '👤 你' : 
                         message.role === 'assistant' ? '🤖 AI' : '⚠️ 错误';
        
        const roleDiv = document.createElement('div');
        roleDiv.className = 'message-role';
        roleDiv.textContent = roleText;
        
        let contentHtml;
        if (message.role === 'user') {
          contentHtml = escapeHtml(message.content);
        } else {
          if (md) {
            const markdownHtml = md.render(message.content);
            contentHtml = typeof DOMPurify !== 'undefined' ? 
              DOMPurify.sanitize(markdownHtml) : escapeHtml(message.content);
          } else {
            contentHtml = escapeHtml(message.content);
          }
        }
        
        messageDiv.innerHTML = '<div class="message-content">' + contentHtml + '</div>';
        
        wrapperDiv.appendChild(roleDiv);
        wrapperDiv.appendChild(messageDiv);
        chatContent.appendChild(wrapperDiv);
        chatContent.scrollTop = chatContent.scrollHeight;
      }
      
      function clearMessages() {
        const chatContainer = document.getElementById('chatContainer');
        const chatContent = chatContainer.querySelector('.chat-content');
        chatContent.innerHTML = '';
      }
      
      function setLoading(loading) {
        isLoading = loading;
        const sendButton = document.getElementById('sendButton');
        const messageInput = document.getElementById('messageInput');
        sendButton.disabled = loading;
        messageInput.disabled = loading;
        
        if (loading) {
          sendButton.innerHTML = '<span class="loading"></span>';
        } else {
          sendButton.textContent = '发送';
        }
      }
      
      function sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const content = messageInput.value.trim();
        if (!content || isLoading) return;
        
        addMessage({ role: 'user', content: content });
        vscode.postMessage({ type: 'send', content });
        messageInput.value = '';
        setLoading(true);
      }
      
      // 绑定事件
      document.addEventListener('DOMContentLoaded', () => {
        const sendButton = document.getElementById('sendButton');
        const messageInput = document.getElementById('messageInput');
        const testMarkdownBtn = document.getElementById('testMarkdownBtn');
        const configBtn = document.getElementById('configBtn');
        const modeSelect = document.getElementById('modeSelect');
        const agentSelect = document.getElementById('agentSelect');
        const modelSelect = document.getElementById('modelSelect');
        const agentSelectorGroup = document.getElementById('agentSelectorGroup');
        const currentModelEl = document.getElementById('currentModel');
        
        // 发送按钮
        sendButton.addEventListener('click', sendMessage);
        
        // Ctrl+Enter 发送
        messageInput.addEventListener('keydown', (e) => {
          if (e.ctrlKey && e.key === 'Enter') {
            sendMessage();
          }
        });
        
        // 测试 Markdown
        if (testMarkdownBtn) {
          testMarkdownBtn.addEventListener('click', () => {
            addMessage({ role: 'assistant', content: testMarkdownText });
          });
        }
        
        // 配置按钮
        if (configBtn) {
          configBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'openConfig' });
          });
        }
        
        // 模式切换
        if (modeSelect) {
          modeSelect.addEventListener('change', (e) => {
            const agentMode = e.target.value === 'agent';
            currentAgentMode = agentMode;
            
            if (agentMode) {
              agentSelectorGroup.classList.add('visible');
            } else {
              agentSelectorGroup.classList.remove('visible');
            }
            
            vscode.postMessage({ type: 'toggleAgentMode', enabled: agentMode });
          });
        }
        
        // Agent 选择器
        if (agentSelect) {
          agentSelect.addEventListener('change', (e) => {
            vscode.postMessage({ type: 'switchAgent', agentId: e.target.value });
          });
        }
        
        // Model 选择器
        if (modelSelect) {
          modelSelect.addEventListener('change', (e) => {
            vscode.postMessage({ type: 'switchModel', modelId: e.target.value });
          });
        }
        
        // 消息监听
        window.addEventListener('message', (event) => {
          const message = event.data;
          
          switch (message.type) {
            case 'ready':
              // 前端已准备好，确保 markdown 已初始化
              initMarkdown();
              break;
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
            case 'modelLoaded':
              if (message.model) {
                const modelName = message.model.modelId || message.model.id;
                const provider = message.model.protocolType || '';
                const agentMode = message.model.agentMode;
                const agentName = message.model.agentName || '默认助手';
                
                currentModelEl.textContent = modelName + (provider ? ' (' + provider + ')' : '');
                currentModelEl.style.color = 'var(--vscode-foreground)';
                
                if (modeSelect) {
                  modeSelect.value = agentMode ? 'agent' : 'direct';
                  currentAgentMode = agentMode;
                  
                  // 根据模式显示/隐藏 Agent 选择器
                  if (agentMode) {
                    agentSelectorGroup.classList.add('visible');
                  } else {
                    agentSelectorGroup.classList.remove('visible');
                  }
                }
                
                if (agentSelect && message.model.agentId) {
                  agentSelect.value = message.model.agentId;
                }
                
                console.log('✅ 模型已加载:', { model: modelName, provider, agentMode, agentName });
              }
              break;
            case 'configLoaded':
              if (message.config) {
                const config = message.config;
                
                if (modeSelect) {
                  modeSelect.value = config.agentModeEnabled ? 'agent' : 'direct';
                  currentAgentMode = config.agentModeEnabled;
                  
                  // 根据模式显示/隐藏 Agent 选择器
                  if (config.agentModeEnabled) {
                    agentSelectorGroup.classList.add('visible');
                  } else {
                    agentSelectorGroup.classList.remove('visible');
                  }
                }
                
                if (agentSelect) {
                  agentSelect.value = config.currentAgent || 'default';
                }
                
                if (modelSelect && config.defaultModel) {
                  modelSelect.innerHTML = '<option value="' + config.defaultModel + '">' + config.defaultModel + '</option>';
                }
              }
              break;
            case 'agentList':
              if (message.agents && Array.isArray(message.agents)) {
                if (agentSelect) {
                  agentSelect.innerHTML = message.agents.map(agent => 
                    '<option value="' + agent.id + '">' + agent.name + '</option>'
                  ).join('');
                }
              }
              break;
            case 'modelList':
              if (message.models && Array.isArray(message.models)) {
                if (modelSelect) {
                  modelSelect.innerHTML = message.models.map(model => 
                    '<option value="' + model.name + '">' + model.name + (model.modelId ? ' (' + model.modelId + ')' : '') + '</option>'
                  ).join('');
                }
              }
              break;
          }
        });
        
        // 发送 ready 消息
        vscode.postMessage({ type: 'ready' });
      });
    })();
  </script>
</body>
</html>`;
  }
}
