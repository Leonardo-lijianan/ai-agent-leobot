import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger.js';
import { ModelConfigManager } from './modelConfigManager.js';

const CONFIG_FILE_NAME = 'agentConfig.json';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  modelId?: string; // 关联的模型
}

export interface AgentConfigFile {
  agents: AgentConfig[];
  defaultAgent: string;
}

export class AgentConfigManager {
  private static instance: AgentConfigManager;
  private configPath: string = '';
  private _context?: vscode.ExtensionContext;
  
  private constructor() {}

  static getInstance(): AgentConfigManager {
    if (!AgentConfigManager.instance) {
      AgentConfigManager.instance = new AgentConfigManager();
    }
    return AgentConfigManager.instance;
  }

  setContext(context: vscode.ExtensionContext) {
    this._context = context;
    // 使用 VS Code 的全局存储目录
    this.configPath = path.join(context.globalStorageUri.fsPath, CONFIG_FILE_NAME);
    Logger.config('AgentConfigManager 初始化', { configPath: this.configPath });
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
      const defaultConfig: AgentConfigFile = {
        agents: [
          {
            id: 'default',
            name: '默认助手',
            description: '默认的 AI 助手',
            systemPrompt: '你是一个有用的 AI 助手。',
            tools: [],
            modelId: 'default' // 动态关联到 modelConfig.json 的 defaultModel
          }
        ],
        defaultAgent: 'default'
      };
      
      fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      Logger.config('创建默认 Agent 配置文件', { path: this.configPath });
    }
  }

  private readConfig(): AgentConfigFile {
    this.ensureConfigFile();
    
    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      Logger.error('读取 Agent 配置文件失败', error);
      Logger.errorAndThrow(`配置文件损坏：${error.message}`);
    }
  }

  private writeConfig(config: AgentConfigFile): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      Logger.config('保存 Agent 配置文件', { path: this.configPath });
    } catch (error: any) {
      Logger.error('保存 Agent 配置文件失败', error);
      Logger.errorAndThrow(`无法保存配置文件：${error.message}`);
    }
  }

  getAgents(): AgentConfig[] {
    const config = this.readConfig();
    const agents = config.agents || [];
    
    // 处理 modelId 为 'default' 的情况
    const modelConfigManager = ModelConfigManager.getInstance();
    const defaultModel = modelConfigManager.getDefaultModel();
    
    return agents.map(agent => {
      if (agent.modelId === 'default') {
        return { ...agent, modelId: defaultModel };
      }
      return agent;
    });
  }

  async updateAgents(agents: AgentConfig[]): Promise<void> {
    const config = this.readConfig();
    config.agents = agents;
    this.writeConfig(config);
  }

  getAgentById(id: string): AgentConfig | undefined {
    const config = this.readConfig();
    const agent = config.agents.find(a => a.id === id);
    
    // 如果 modelId 是 'default'，则使用 modelConfig.json 的 defaultModel
    if (agent && agent.modelId === 'default') {
      const modelConfigManager = ModelConfigManager.getInstance();
      const defaultModel = modelConfigManager.getDefaultModel();
      return { ...agent, modelId: defaultModel };
    }
    
    return agent;
  }

  async addAgent(agent: AgentConfig): Promise<void> {
    const config = this.readConfig();
    
    // 检查 ID 是否已存在
    if (config.agents.some(a => a.id === agent.id)) {
      Logger.errorAndThrow(`Agent ID "${agent.id}" 已存在`);
    }
    
    config.agents.push(agent);
    this.writeConfig(config);
  }

  async updateAgent(id: string, agent: Partial<AgentConfig>): Promise<void> {
    const config = this.readConfig();
    const index = config.agents.findIndex(a => a.id === id);
    
    if (index === -1) {
      Logger.errorAndThrow(`Agent ID "${id}" 不存在`);
    }
    
    config.agents[index] = { ...config.agents[index], ...agent };
    this.writeConfig(config);
  }

  async removeAgent(id: string): Promise<void> {
    const config = this.readConfig();
    config.agents = config.agents.filter(a => a.id !== id);
    this.writeConfig(config);
  }

  getDefaultAgent(): string {
    const config = this.readConfig();
    return config.defaultAgent || 'default';
  }

  async setDefaultAgent(agentId: string): Promise<void> {
    const config = this.readConfig();
    config.defaultAgent = agentId;
    this.writeConfig(config);
  }

  async setAgentModel(agentId: string, modelId: string): Promise<void> {
    const config = this.readConfig();
    const index = config.agents.findIndex(a => a.id === agentId);
    
    if (index === -1) {
      Logger.errorAndThrow(`Agent ID "${agentId}" 不存在`);
    }
    
    config.agents[index].modelId = modelId;
    this.writeConfig(config);
  }
}
