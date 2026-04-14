import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Message, ModelConfig, ModelAdapter } from '../types.js';
import { ModelConfigManager } from '../managers/ModelConfigManager.js';
import { GlobalConfigManager } from '../managers/GlobalConfigManager.js';
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
  ) {
    // 监听配置变化事件，自动重新初始化模型
    this._configManager.onDidChangeConfig(() => {
      Logger.info('检测到模型配置变化，重新初始化模型');
      this.refresh();
    });
  }

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
    const globalConfigManager = GlobalConfigManager.getInstance();
    const agentConfig = globalConfigManager.getRuntimeConfig();
    const agentAndModelConfig = await this._configManager.getCurrentAgentAndModel();
    
    this._agentModeEnabled = agentConfig.agentModeEnabled;
    this._currentAgentId = agentConfig.currentAgent;
    
    // 确定使用哪个模型
    let modelConfigId: string;
    
    if (this._agentModeEnabled) {
      // Agent 模式：使用 Agent 关联的模型
      const agent = agentManager.getAgent(this._currentAgentId);
      if (agent) {
        // 如果 Agent 有指定的 modelId，使用它；否则使用 defaultModel
        modelConfigId = agent.modelConfigId && agent.modelConfigId !== 'default' 
          ? agent.modelConfigId 
          : agentAndModelConfig.defaultModel;
      } else {
        // Agent 不存在，回退到 defaultModel
        modelConfigId = agentAndModelConfig.defaultModel;
      }
    } else {
      // 直接模式：直接使用 defaultModel
      modelConfigId = agentAndModelConfig.defaultModel;
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
      const globalConfigManager = GlobalConfigManager.getInstance();
      const agentConfig = globalConfigManager.getRuntimeConfig();
      const modelConfig = await this._configManager.getCurrentAgentAndModel();
      
      // 获取所有 Agent
      const agents = agentManager.getAllAgents();
      
      // 获取所有 Models
      const models = this._configManager.getModels();
      
      // 发送配置信息
      this._view.webview.postMessage({
        type: 'configLoaded',
        config: {
          agentModeEnabled: agentConfig.agentModeEnabled,
          currentAgent: agentConfig.currentAgent,
          defaultModel: modelConfig.defaultModel
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
        agentModeEnabled: agentConfig.agentModeEnabled,
        currentAgent: agentConfig.currentAgent,
        defaultModel: modelConfig.defaultModel,
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
    const globalConfigManager = GlobalConfigManager.getInstance();
    await globalConfigManager.setAgentModeEnabled(enabled);
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
    const globalConfigManager = GlobalConfigManager.getInstance();
    await globalConfigManager.setCurrentAgent(agentId);
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
    const htmlPath = path.join(this._extensionPath, 'media', 'chatView.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');
    
    // 替换 CSS 和 JS 的路径
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(vscode.Uri.file(this._extensionPath), 'media', 'chatView.css')
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(vscode.Uri.file(this._extensionPath), 'media', 'chatView.js')
    );
    
    html = html.replace('chatView.css', styleUri.toString());
    html = html.replace('chatView.js', jsUri.toString());
    
    // 注入测试 Markdown 文本
    html = html.replace('let testMarkdownText = \'\';', `let testMarkdownText = ${JSON.stringify(testMarkdownText)};`);
    
    return html;
  }
}
