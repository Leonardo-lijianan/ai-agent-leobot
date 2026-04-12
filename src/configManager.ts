import * as vscode from 'vscode';
import { ModelConfig } from './types.js';
import { agentManager } from './managers/AgentManager.js';

const CONFIG_KEY = 'aiAgentLeoBot';

export class ConfigManager {
  private static instance: ConfigManager;
  private _context?: vscode.ExtensionContext;
  
  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  setContext(context: vscode.ExtensionContext) {
    this._context = context;
  }

  getContext(): vscode.ExtensionContext | undefined {
    return this._context;
  }

  getModels(): ModelConfig[] {
    const config = vscode.workspace.getConfiguration(CONFIG_KEY);
    const models = config.get<ModelConfig[]>('models', []);
    
    if (models.length === 0) {
      return [
        {
          id: '硅基流动',
          protocolType: 'openai',
          endpoint: 'https://api.siliconflow.cn/v1',
          apiKey: '',
          modelId: 'Qwen/Qwen3.5-122B-A10B'
        }
      ];
    }
    
    return models;
  }

  async updateModels(models: ModelConfig[]): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_KEY);
    await config.update('models', models, vscode.ConfigurationTarget.Global);
  }

  getDefaultModel(): string {
    const config = vscode.workspace.getConfiguration(CONFIG_KEY);
    return config.get<string>('defaultModel', '硅基流动');
  }

  async setDefaultModel(modelName: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_KEY);
    await config.update('defaultModel', modelName, vscode.ConfigurationTarget.Global);
  }

  async getApiKey(modelName: string): Promise<string | undefined> {
    // 优先从 SecretStorage 读取 API Key
    if (this._context) {
      const secretKey = await this._context.secrets.get('api-key');
      if (secretKey) {
        return secretKey;
      }
    }
    
    // 回退到 settings.json
    const models = this.getModels();
    const model = models.find(m => m.id === modelName);
    return model?.apiKey;
  }

  async updateApiKey(modelName: string, apiKey: string): Promise<void> {
    const models = this.getModels();
    const modelIndex = models.findIndex(m => m.id === modelName);
    
    if (modelIndex !== -1) {
      models[modelIndex].apiKey = apiKey;
      await this.updateModels(models);
    }
  }

  getModelByName(name: string): ModelConfig | undefined {
    const models = this.getModels();
    return models.find(m => m.id === name);
  }

  async getCurrentAgent(): Promise<string> {
    const config = vscode.workspace.getConfiguration(CONFIG_KEY);
    return config.get<string>('currentAgent', 'default');
  }

  async setCurrentAgent(agentId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_KEY);
    await config.update('currentAgent', agentId, vscode.ConfigurationTarget.Global);
  }

  getAllAgents() {
    return agentManager.getAllAgents();
  }
}
