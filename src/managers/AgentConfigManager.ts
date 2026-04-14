import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/Logger.js';
import { ModelConfigManager } from './ModelConfigManager.js';
import { AgentConfig, AgentConfigFile } from '../types.js';

const CONFIG_FILE_NAME = 'agentConfig.json';

export class AgentConfigManager {
  private static instance: AgentConfigManager;
  private configPath: string = '';
  private _context?: vscode.ExtensionContext;
  private _onDidChangeConfig = new vscode.EventEmitter<void>();
  public readonly onDidChangeConfig = this._onDidChangeConfig.event;
  
  private constructor() {}

  static getInstance(): AgentConfigManager {
    if (!AgentConfigManager.instance) {
      AgentConfigManager.instance = new AgentConfigManager();
    }
    return AgentConfigManager.instance;
  }

  /**
   * 获取默认系统提示词
   * 从 media/system_prompt.md 读取
   */
  public getDefaultSystemPrompt(): string {
    // 扩展路径
    const extensionPath = this._context ? this._context.extensionPath : __dirname;
    const promptPath = path.join(extensionPath, 'media', 'system_prompt.md');
    
    if (!fs.existsSync(promptPath)) {
      throw new Error(
        `系统提示词文件不存在：${promptPath}\n` +
        `可能原因：\n` +
        `1. 插件安装不完整\n` +
        `2. media/system_prompt.md 文件丢失\n\n` +
        `建议：\n` +
        `- 重新安装插件\n` +
        `- 或联系开发者获取完整版本`
      );
    }
    
    return fs.readFileSync(promptPath, 'utf-8');
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
      // 使用默认系统提示词（从 media/system_prompt.md 读取）
      const defaultSystemPrompt = this.getDefaultSystemPrompt();
      
      const defaultConfig: AgentConfigFile = {
        agents: [
          {
            id: 'default',
            name: '默认助手',
            description: '默认的 AI 助手',
            systemPrompt: defaultSystemPrompt,
            tools: [],
            modelConfigId: 'default' // 动态关联到 modelConfig.json 的 defaultModel
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
      if (agent.modelConfigId === 'default') {
        return { ...agent, modelId: defaultModel };
      }
      return agent;
    });
  }

  async updateAgents(agents: AgentConfig[]): Promise<void> {
    const config = this.readConfig();
    config.agents = agents;
    this.writeConfig(config);
    this._onDidChangeConfig.fire();
  }

  getAgentById(id: string): AgentConfig | undefined {
    const config = this.readConfig();
    const agent = config.agents.find(a => a.id === id);
    
    // 如果 modelId 是 'default'，则使用 modelConfig.json 的 defaultModel
    if (agent && agent.modelConfigId === 'default') {
      const modelConfigManager = ModelConfigManager.getInstance();
      const defaultModel = modelConfigManager.getDefaultModel();
      return { ...agent, modelConfigId: defaultModel };
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
    this._onDidChangeConfig.fire();
  }

  async updateAgent(id: string, agent: Partial<AgentConfig>): Promise<void> {
    const config = this.readConfig();
    const index = config.agents.findIndex(a => a.id === id);
    
    if (index === -1) {
      Logger.errorAndThrow(`Agent ID "${id}" 不存在`);
    }
    
    config.agents[index] = { ...config.agents[index], ...agent };
    this.writeConfig(config);
    this._onDidChangeConfig.fire();
  }

  async removeAgent(id: string): Promise<void> {
    const config = this.readConfig();
    config.agents = config.agents.filter(a => a.id !== id);
    this.writeConfig(config);
    this._onDidChangeConfig.fire();
  }

  getDefaultAgent(): string {
    const config = this.readConfig();
    return config.defaultAgent || 'default';
  }

  async setDefaultAgent(agentId: string): Promise<void> {
    const config = this.readConfig();
    config.defaultAgent = agentId;
    this.writeConfig(config);
    this._onDidChangeConfig.fire();
  }

  async setAgentModel(agentId: string, modelId: string): Promise<void> {
    const config = this.readConfig();
    const index = config.agents.findIndex(a => a.id === agentId);
    
    if (index === -1) {
      Logger.errorAndThrow(`Agent ID "${agentId}" 不存在`);
    }
    
    config.agents[index].modelConfigId = modelId;
    this.writeConfig(config);
    this._onDidChangeConfig.fire();
  }

  /**
   * 获取配置文件路径（供迁移功能使用）
   */
  getConfigFilePath(): string {
    return this.configPath;
  }
}
