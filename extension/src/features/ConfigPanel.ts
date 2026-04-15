import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ModelConfigManager } from '../managers/ModelConfigManager.js';
import { GlobalConfigManager } from '../managers/GlobalConfigManager.js';
import { AgentConfigManager } from '../managers/AgentConfigManager.js';
import { Logger } from '../utils/Logger.js';
import { ModelConfig, AgentConfig } from '../types.js';
import { createModelAdapter } from '../adapters/modelAdapter.js';
import { getHtmlForWebview } from '../utils/loadMedia.js';

export class ConfigPanel {
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private modelConfigManager: ModelConfigManager;
  private agentConfigManager: AgentConfigManager;
  private context: vscode.ExtensionContext;
  private readonly _extensionPath: string;

  constructor(
    panel: vscode.WebviewPanel,
    modelConfigManager: ModelConfigManager,
    agentConfigManager: AgentConfigManager,
    context: vscode.ExtensionContext
  ) {
    this.panel = panel;
    this.modelConfigManager = modelConfigManager;
    this.agentConfigManager = agentConfigManager;
    this.context = context;
    this._extensionPath = context.extensionPath;
    
    panel.webview.html = this.getHtmlForWebview();
    this.setupMessageListeners();
  }

  private getHtmlForWebview(): string {
    // 使用 loadMedia.ts 来加载 HTML
    return getHtmlForWebview(this._extensionPath, 'config_panel.html', 'config_panel.css', 'config_panel.js');
  }

  private setupMessageListeners() {
    this.disposables.push(
      this.panel.webview.onDidReceiveMessage(async (message) => {
        Logger.config('[ConfigPanel] 收到消息', message);
        
        switch (message.type) {
          case 'loadConfig':
            await this.handleLoadConfig(message.configType, message.id);
            break;
            
          case 'testModelConfig':
            await this.handleTestModelConfig(message.config, message.agentId);
            break;
            
          case 'addConfig':
            await this.handleAddConfig(message.configType, message.config);
            break;
            
          case 'changeConfig':
            await this.handleChangeConfig(message.configType, message.config);
            break;
            
          case 'deleteConfig':
            await this.handleDeleteConfig(message.configType, message.id);
            break;
            
          case 'listModels':
            await this.handleListModels(message.provider, message.endpoint, message.apiKey);
            break;
            
          case 'getConfigPath':
            await this.handleGetConfigPath();
            break;
            
          case 'browseConfigPath':
            await this.handleBrowseConfigPath();
            break;
            
          case 'migrateConfig':
            await this.handleMigrateConfig(message.newPath);
            break;
        }
      })
    );
  }

  private async handleLoadConfig(configType: string, id: string) {
    try {
      Logger.config(`加载配置，类型: ${configType} ID: ${id}`);
      
      if (configType === 'model') {
        // 获取模型配置
        const config = this.modelConfigManager.getModelByName(id);
        
        Logger.config(`当前模型配置: ${JSON.stringify(config)}`);
        
        this.panel.webview.postMessage({
          type: 'loadConfig',
          config: config || {}
        });
      } else if (configType === 'agent') {
        // 获取 Agent 配置
        const config = this.agentConfigManager.getAgentById(id);
        
        Logger.config(`当前 Agent 配置: ${JSON.stringify(config)}`);
        
        this.panel.webview.postMessage({
          type: 'loadConfig',
          config: config || {}
        });
      }
    } catch (error: any) {
      Logger.error('获取配置失败', error);
      this.panel.webview.postMessage({
        type: 'configResult',
        configType: 'load',
        success: false,
        error: error.message || '获取配置失败'
      });
    }
  }

  private async handleAddConfig(configType: string, config: any) {
    try {
      Logger.config(`添加配置，类型: ${configType} 配置: ${JSON.stringify(config)}`);
      
      if (configType === 'model') {
        // 添加模型配置
        const models = this.modelConfigManager.getModels();
        models.push(config);
        await this.modelConfigManager.updateModels(models);
      } else if (configType === 'agent') {
        // 使用 AgentConfigManager 的 addAgent 方法
        await this.agentConfigManager.addAgent(config);
      }
      
      this.panel.webview.postMessage({
        type: 'configResult',
        configType: 'add',
        success: true
      });
    } catch (error: any) {
      Logger.error('添加配置失败', error);
      this.panel.webview.postMessage({
        type: 'configResult',
        configType: 'add',
        success: false,
        error: error.message || '添加配置失败'
      });
    }
  }

  private async handleChangeConfig(configType: string, config: any) {
    try {
      Logger.config(`修改配置，类型: ${configType} 配置: ${JSON.stringify(config)}`);
      
      if (configType === 'model') {
        // 修改模型配置
        const models = this.modelConfigManager.getModels();
        const index = models.findIndex(m => m.id === config.id);
        if (index !== -1) {
          models[index] = config;
          await this.modelConfigManager.updateModels(models);
        }
      } else if (configType === 'agent') {
        // 修改 Agent 配置
        await this.agentConfigManager.updateAgent(config.id, config);
      }
      
      this.panel.webview.postMessage({
        type: 'configResult',
        configType: 'change',
        success: true
      });
    } catch (error: any) {
      Logger.error('修改配置失败', error);
      this.panel.webview.postMessage({
        type: 'configResult',
        configType: 'change',
        success: false,
        error: error.message || '修改配置失败'
      });
    }
  }

  private async handleDeleteConfig(configType: string, id: string) {
    try {
      Logger.config(`删除配置，类型: ${configType} ID: ${id}`);
      
      if (configType === 'model') {
        // 删除模型配置
        const models = this.modelConfigManager.getModels();
        const filteredModels = models.filter(m => m.id !== id);
        await this.modelConfigManager.updateModels(filteredModels);
      } else if (configType === 'agent') {
        // 删除 Agent 配置
        const agents = this.agentConfigManager.getAgents();
        const filteredAgents = agents.filter(a => a.id !== id);
        await this.agentConfigManager.updateAgents(filteredAgents);
      }
      
      this.panel.webview.postMessage({
        type: 'configResult',
        configType: 'delete',
        success: true
      });
    } catch (error: any) {
      Logger.error('删除配置失败', error);
      this.panel.webview.postMessage({
        type: 'configResult',
        configType: 'delete',
        success: false,
        error: error.message || '删除配置失败'
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

  /**
   * 获取当前配置路径
   */
  private async handleGetConfigPath() {
    try {
      const currentPath = this.agentConfigManager.getConfigFilePath();
      const configDir = currentPath.replace(/[^\\\/]*\.json$/, '');
      
      this.panel.webview.postMessage({
        type: 'configPathInfo',
        currentPath: configDir
      });
    } catch (error: any) {
      Logger.error('获取配置路径失败', error);
      this.panel.webview.postMessage({
        type: 'configPathInfo',
        currentPath: '获取失败',
        error: error.message
      });
    }
  }

  /**
   * 浏览新的配置路径
   */
  private async handleBrowseConfigPath() {
    try {
      const result = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: '选择新的配置存储位置',
        title: '迁移 AI Agent 配置'
      });

      if (result && result.length > 0) {
        this.panel.webview.postMessage({
          type: 'browsePathResult',
          success: true,
          newPath: result[0].fsPath
        });
      } else {
        this.panel.webview.postMessage({
          type: 'browsePathResult',
          success: false,
          error: '用户取消了选择'
        });
      }
    } catch (error: any) {
      Logger.error('浏览路径失败', error);
      this.panel.webview.postMessage({
        type: 'browsePathResult',
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 迁移配置文件
   */
  private async handleMigrateConfig(newPath: string) {
    try {
      if (!newPath) {
        throw new Error('未选择新的配置路径');
      }

      // 使用进度条显示迁移过程
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在迁移配置文件...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: '准备迁移...', increment: 10 });

        const currentPath = this.agentConfigManager.getConfigFilePath();
        const currentDir = currentPath.replace(/[^\\\/]*\.json$/, '');
        
        // 配置文件列表
        const configFiles = ['agentConfig.json', 'modelConfig.json', 'globalConfig.json'];
        
        progress.report({ message: '检查目标目录...', increment: 20 });
        
        // 确保目标目录存在
        if (!fs.existsSync(newPath)) {
          fs.mkdirSync(newPath, { recursive: true });
        }

        progress.report({ message: '复制配置文件...', increment: 30 });
        
        // 复制每个配置文件
        for (const file of configFiles) {
          const sourceFile = path.join(currentDir, file);
          const targetFile = path.join(newPath, file);
          
          if (fs.existsSync(sourceFile)) {
            fs.copyFileSync(sourceFile, targetFile);
            Logger.info(`配置文件已复制: ${file}`);
          }
        }

        progress.report({ message: '更新配置管理器...', increment: 20 });
        
        // 这里需要更新配置管理器的路径
        // 由于配置管理器是单例，需要重启扩展才能生效
        
        progress.report({ message: '迁移完成！', increment: 20 });
      });

      this.panel.webview.postMessage({
        type: 'migrateResult',
        success: true,
        message: '配置文件迁移完成！请重启 VS Code 扩展生效。'
      });

      // 显示重启提示
      vscode.window.showInformationMessage(
        '配置文件迁移完成！请重启 VS Code 扩展生效。',
        '重启扩展'
      ).then(selection => {
        if (selection === '重启扩展') {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      });

    } catch (error: any) {
      Logger.error('迁移配置失败', error);
      this.panel.webview.postMessage({
        type: 'migrateResult',
        success: false,
        error: error.message
      });
    }
  }

  public dispose() {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
