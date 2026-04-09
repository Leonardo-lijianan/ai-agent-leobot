import * as vscode from 'vscode';
import { PluginConfig, ModelConfig } from './types';

const CONFIG_KEY = 'aiAgentLeoBot';

export class ConfigManager {
  private static instance: ConfigManager;
  
  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  getModels(): ModelConfig[] {
    const config = vscode.workspace.getConfiguration(CONFIG_KEY);
    const models = config.get<ModelConfig[]>('models', []);
    
    if (models.length === 0) {
      return [
        {
          name: '硅基流动',
          type: 'openai',
          endpoint: 'https://api.siliconflow.cn/v1',
          apiKey: ''
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
    const models = this.getModels();
    const model = models.find(m => m.name === modelName);
    return model?.apiKey;
  }

  async updateApiKey(modelName: string, apiKey: string): Promise<void> {
    const models = this.getModels();
    const modelIndex = models.findIndex(m => m.name === modelName);
    
    if (modelIndex !== -1) {
      models[modelIndex].apiKey = apiKey;
      await this.updateModels(models);
    }
  }

  getModelByName(name: string): ModelConfig | undefined {
    const models = this.getModels();
    return models.find(m => m.name === name);
  }
}
