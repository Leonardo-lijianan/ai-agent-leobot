import * as vscode from 'vscode';
import * as fs from 'fs';
import { ModelConfigManager } from '../managers/ModelConfigManager.js';
import { AgentConfigManager } from '../managers/AgentConfigManager.js';
import { Logger } from '../utils/Logger.js';
import { ModelConfig, AgentConfig } from '../types.js';
import { createModelAdapter } from '../adapters/modelAdapter.js';

export class ConfigPanel {
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private modelConfigManager: ModelConfigManager;
  private agentConfigManager: AgentConfigManager;
  private context: vscode.ExtensionContext;

  constructor(
    panel: vscode.WebviewPanel,
    modelConfigManager: ModelConfigManager,
    agentConfigManager: AgentConfigManager,
    context: vscode.ExtensionContext,
    htmlPath: vscode.Uri
  ) {
    this.panel = panel;
    this.modelConfigManager = modelConfigManager;
    this.agentConfigManager = agentConfigManager;
    this.context = context;
    
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'media', 'configPanelView.js')
    );
    
    panel.webview.html = this.getHtmlForWebview(htmlPath, scriptUri);
    this.setupMessageListeners();
  }

  private getHtmlForWebview(htmlUri: vscode.Uri, scriptUri: vscode.Uri): string {
    const html = fs.readFileSync(htmlUri.fsPath, 'utf-8');
    const jsPath = scriptUri.fsPath;
    const jsContent = fs.readFileSync(jsPath, 'utf-8');
    
    // 使用字符串拼接，避免模板字符串的转义问题
    const scriptTag = '<script>' + jsContent + '</script>';
    return html.replace('</body>', scriptTag + '</body>');
  }

  private setupMessageListeners() {
    this.disposables.push(
      this.panel.webview.onDidReceiveMessage(async (message) => {
        Logger.config('收到消息', message);
        
        switch (message.type) {
          case 'editModel':
            await this.handleEditModel(message.agentId);
            break;
            
          case 'testModelConfig':
            await this.handleTestModelConfig(message.config, message.agentId);
            break;
            
          case 'saveModelConfig':
            await this.handleSaveModelConfig(message.config, message.agentId);
            break;
            
          case 'listModels':
            await this.handleListModels(message.provider, message.endpoint, message.apiKey);
            break;
            
          case 'addAgent':
            await this.handleAddAgent(message.agent);
            break;
        }
      })
    );
  }

  private async handleEditModel(agentId: string) {
    try {
      Logger.config('编辑模型配置，Agent ID:', agentId);
      
      const config = this.modelConfigManager.getModelByName(agentId);
      
      Logger.config('当前配置:', config);
      
      this.panel.webview.postMessage({
        type: 'loadConfig',
        config: config || {}
      });
    } catch (error: any) {
      Logger.error('获取模型配置失败', error);
      this.panel.webview.postMessage({
        type: 'editModelResult',
        success: false,
        error: error.message || '获取配置失败'
      });
    }
  }

  private async handleTestModelConfig(config: ModelConfig, agentId: string) {
    try {
      Logger.config('测试模型配置:', config);
      
      if (config.protocolType === 'gemini') {
        const { GoogleGenAI } = await import('@google/genai');
        const genAI = new GoogleGenAI({ apiKey: config.apiKey || '' });
        await genAI.models.list();
      } else {
        const baseURL = config.endpoint || 'https://api.openai.com/v1';
        const url = `${baseURL}/chat/completions`;
        
        Logger.config('发送测试请求:', {
          url,
          model: config.modelId,
          hasApiKey: !!config.apiKey,
          apiKeyLength: config.apiKey?.length || 0
        });
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: config.modelId || 'deepseek-ai/DeepSeek-V3',
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: 10
          })
        });
        
        Logger.config('收到响应:', {
          status: response.status,
          statusText: response.statusText
        });
        
        if (!response.ok) {
          // 尝试读取响应体
          let errorText = '';
          try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const errorJson = await response.json();
              errorText = JSON.stringify(errorJson, null, 2);
              Logger.error('API 返回错误响应:', errorJson);
            } else {
              errorText = await response.text();
              Logger.error('API 返回错误文本:', errorText);
            }
          } catch (readError: any) {
            Logger.error('读取错误响应体失败:', readError);
            errorText = `无法读取响应体：${readError.message}`;
          }
          
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }
      }
      
      Logger.config('测试结果：成功');
      
      this.panel.webview.postMessage({
        type: 'testResult',
        success: true
      });
    } catch (error: any) {
      Logger.error('测试连接失败', error);
      this.panel.webview.postMessage({
        type: 'testResult',
        success: false,
        error: error.message || '测试失败'
      });
    }
  }

  private async handleSaveModelConfig(config: ModelConfig, agentId: string) {
    try {
      Logger.config('保存模型配置:', config);
      
      // 先获取现有模型列表
      const models = this.modelConfigManager.getModels();
      const existingIndex = models.findIndex(m => m.id === agentId);
      
      if (existingIndex !== -1) {
        // 更新现有配置
        models[existingIndex].protocolType = config.protocolType;
        models[existingIndex].endpoint = config.endpoint;
        models[existingIndex].modelId = config.modelId;
        // 使用加密方法保存 API Key
        if (config.apiKey) {
          await this.modelConfigManager.updateApiKey(config.id, config.apiKey);
        } else {
          await this.modelConfigManager.updateModels(models);
        }
      } else {
        // 新增配置 - 先保存配置，再加密 API Key
        models.push({ ...config });
        await this.modelConfigManager.updateModels(models);
        // 如果有 API Key，单独加密保存
        if (config.apiKey) {
          await this.modelConfigManager.updateApiKey(config.id, config.apiKey);
        }
      }
      
      await this.modelConfigManager.setDefaultModel(config.id);
      
      Logger.config('配置已保存');
      
      this.panel.webview.postMessage({
        type: 'editModelResult',
        success: true
      });
      
      // 通知聊天视图刷新配置
      await vscode.commands.executeCommand('ai-agent-leobot.refreshChatView');
      
      setTimeout(async () => {
        await this.loadAgentModelList();
      }, 500);
    } catch (error: any) {
      Logger.error('保存模型配置失败', error);
      this.panel.webview.postMessage({
        type: 'editModelResult',
        success: false,
        error: error.message || '保存失败'
      });
    }
  }

  private async handleListModels(provider: string, endpoint: string, apiKey: string) {
    try {
      Logger.config('获取模型列表:', { provider, endpoint });
      
      if (provider === 'gemini') {
        const { GoogleGenAI } = await import('@google/genai');
        const genAI = new GoogleGenAI({ apiKey });
        const response = await genAI.models.list();
        const models = (response as any).models || [];
        const generateModels = models.filter((model: any) => 
          model.supportedGenerationMethods?.includes('generateContent')
        );
        const top5 = generateModels.slice(0, 5);
        const modelList = top5.map((m: any) => m.name.replace('models/', ''));
        
        this.panel.webview.postMessage({
          type: 'listModelsResult',
          success: true,
          models: modelList
        });
      } else {
        const baseURL = endpoint || 'https://api.openai.com/v1';
        const response = await fetch(`${baseURL}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }
        
        const data: any = await response.json();
        const models = data.data || [];
        const top5 = models.slice(0, 5);
        const modelList = top5.map((m: any) => m.id);
        
        this.panel.webview.postMessage({
          type: 'listModelsResult',
          success: true,
          models: modelList
        });
      }
    } catch (error: any) {
      Logger.error('获取模型列表失败', error);
      this.panel.webview.postMessage({
        type: 'listModelsResult',
        success: false,
        error: error.message || '获取失败'
      });
    }
  }

  private async handleAddAgent(agent: AgentConfig) {
    try {
      Logger.config('新增 Agent:', agent);
      
      await this.agentConfigManager.addAgent(agent);
      
      Logger.config('Agent 已添加');
      
      this.panel.webview.postMessage({
        type: 'addAgentResult',
        success: true
      });
      
      setTimeout(async () => {
        await this.loadAgentModelList();
      }, 500);
    } catch (error: any) {
      Logger.error('新增 Agent 失败', error);
      this.panel.webview.postMessage({
        type: 'addAgentResult',
        success: false,
        error: error.message || '添加失败'
      });
    }
  }

  public async loadAgentModelList() {
    try {
      const agents = this.agentConfigManager.getAgents();
      const agentModels = agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        modelId: agent.modelConfigId || ''
      }));
      
      this.panel.webview.postMessage({
        type: 'agentModelList',
        agentModels: agentModels
      });
    } catch (error: any) {
      Logger.error('加载 Agent 列表失败', error);
    }
  }

  public async loadConfig() {
    await this.loadAgentModelList();
  }

  public dispose() {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
