import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ModelConfig } from './types.js';
import { Logger } from './logger.js';
import { agentManager } from './agentManager.js';
import { encrypt, decrypt } from './crypto.js';
import { AgentModelConfig, ModelConfigFile } from './types.js'

const CONFIG_FILE_NAME = 'modelConfig.json';

export class ModelConfigManager {
  private static instance: ModelConfigManager;
  private configPath: string = '';
  private _context?: vscode.ExtensionContext;
  
  private constructor() {}

  static getInstance(): ModelConfigManager {
    if (!ModelConfigManager.instance) {
      ModelConfigManager.instance = new ModelConfigManager();
    }
    return ModelConfigManager.instance;
  }

  setContext(context: vscode.ExtensionContext) {
    this._context = context;
    // 使用 VS Code 的全局存储目录（用户数据目录）
    // Windows: %APPDATA%\Code\User\globalStorage\your-extension-id\
    this.configPath = path.join(context.globalStorageUri.fsPath, CONFIG_FILE_NAME);
    Logger.config('ModelConfigManager 初始化', { configPath: this.configPath });
  }

  getContext(): vscode.ExtensionContext | undefined {
    return this._context;
  }

  private ensureConfigFile(): void {
    const configDir = path.dirname(this.configPath);
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.configPath)) {
      const defaultConfig: ModelConfigFile = {
        models: [
          {
            id: '硅基流动',
            protocolType: 'openai',
            endpoint: 'https://api.siliconflow.cn/v1',
            apiKey: '',
            modelId: 'Qwen/Qwen3.5-122B-A10B'
          }
        ],
        defaultModel: '硅基流动',
        currentAgent: 'default',
        agentModels: [], // 初始化为空数组
        agentModeEnabled: true // 默认启用 Agent 模式
      };
      
      fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      Logger.config('创建默认配置文件', { path: this.configPath });
    }
  }

  private readConfig(): ModelConfigFile {
    this.ensureConfigFile();
    
    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      Logger.error('读取配置文件失败', error);
      Logger.errorAndThrow(`配置文件损坏：${error.message}`);
    }
  }

  private writeConfig(config: ModelConfigFile): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      Logger.config('保存配置文件', { path: this.configPath });
    } catch (error: any) {
      Logger.errorAndThrow(`无法保存配置文件：${error.message}`);
    }
  }

  getModels(): ModelConfig[] {
    const config = this.readConfig();
    return config.models || [];
  }

  async updateModels(models: ModelConfig[]): Promise<void> {
    const config = this.readConfig();
    config.models = models;
    this.writeConfig(config);
  }

  getDefaultModel(): string {
    const config = this.readConfig();
    return config.defaultModel || '硅基流动';
  }

  async setDefaultModel(modelName: string): Promise<void> {
    const config = this.readConfig();
    config.defaultModel = modelName;
    this.writeConfig(config);
  }

  async getApiKey(modelName: string): Promise<string | undefined> {
    const models = this.getModels();
    const model = models.find(m => m.id === modelName);
    
    if (model?.apiKey) {
      if (!this._context) {
        Logger.error('Context 未初始化，无法解密 API Key');
        return model.apiKey; // 返回加密文本（兼容模式）
      }
      try {
        return await decrypt(model.apiKey, this._context);
      } catch (error: any) {
        Logger.error('解密 API Key 失败', error);
        return model.apiKey; // 解密失败则返回原文（兼容旧数据）
      }
    }
    return undefined;
  }

  async updateApiKey(modelName: string, apiKey: string): Promise<void> {
    const models = this.getModels();
    const modelIndex = models.findIndex(m => m.id === modelName);
    
    if (modelIndex !== -1) {
      if (!this._context) {
        Logger.error('Context 未初始化，无法加密 API Key');
        models[modelIndex].apiKey = apiKey; // 直接保存明文（兼容模式）
      } else {
        const encryptedKey = await encrypt(apiKey, this._context);
        models[modelIndex].apiKey = encryptedKey;
      }
      await this.updateModels(models);
    }
  }

  getModelByName(name: string): ModelConfig | undefined {
    const models = this.getModels();
    return models.find(m => m.id === name);
  }

  async getCurrentAgent(): Promise<string> {
    const config = this.readConfig();
    return config.currentAgent || 'default';
  }

  async setCurrentAgent(agentId: string): Promise<void> {
    const config = this.readConfig();
    config.currentAgent = agentId;
    this.writeConfig(config);
  }

  getAgentModels(): AgentModelConfig[] {
    const config = this.readConfig();
    return config.agentModels || [];
  }

  async setAgentModel(agentId: string, agentName: string, modelId: string): Promise<void> {
    const config = this.readConfig();
    
    // 查找是否已存在该 Agent 的配置
    const existingIndex = config.agentModels.findIndex(am => am.id === agentId);
    
    if (existingIndex !== -1) {
      // 更新现有配置
      config.agentModels[existingIndex].modelId = modelId;
    } else {
      // 添加新配置
      config.agentModels.push({
        id: agentId,
        name: agentName,
        modelId: modelId
      });
    }
    
    this.writeConfig(config);
  }

  async removeAgentModel(agentId: string): Promise<void> {
    const config = this.readConfig();
    config.agentModels = config.agentModels.filter(am => am.id !== agentId);
    this.writeConfig(config);
  }

  getAgentModel(agentId: string): string | undefined {
    const config = this.readConfig();
    const agentModel = config.agentModels.find(am => am.id === agentId);
    return agentModel?.modelId;
  }

  isAgentModeEnabled(): boolean {
    const config = this.readConfig();
    return config.agentModeEnabled !== false; // 默认为 true
  }

  async setAgentModeEnabled(enabled: boolean): Promise<void> {
    const config = this.readConfig();
    config.agentModeEnabled = enabled;
    this.writeConfig(config);
  }

  async getCurrentAgentAndModel(): Promise<{
    agentModeEnabled: boolean,
    currentAgent: string,
    defaultModel: string
  }> {
    const config = this.readConfig();
    return {
      agentModeEnabled: config.agentModeEnabled !== false,
      currentAgent: config.currentAgent || 'default',
      defaultModel: config.defaultModel || '硅基流动'
    };
  }

  getAllAgents(): any[] {
    // 从 agentManager 获取所有 Agent
    return agentManager.getAllAgents();
  }

  getConfigFilePath(): string {
    return this.configPath;
  }
}
