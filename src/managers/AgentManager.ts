import { Logger } from '../utils/Logger.js';
import { AgentConfigManager } from './AgentConfigManager.js';
import { AgentConfig } from '../types.js'


/**
 * Agent 管理器
 * 负责管理多个 AI Agent 配置和切换
 */
export class AgentManager {
  private static instance: AgentManager;
  private agents: Map<string, AgentConfig> = new Map();
  private currentAgentId: string = 'default';
  private agentConfigManager?: AgentConfigManager;

  private constructor() {}

  static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  setAgentConfigManager(configManager: AgentConfigManager) {
    this.agentConfigManager = configManager;
    this.loadAgentsFromConfig();
  }

  /**
   * 从配置文件加载 Agent
   */
  private loadAgentsFromConfig() {
    if (!this.agentConfigManager) {
      // AgentConfigManager 未设置，使用内存模式
      this.registerDefaultAgents();
      return;
    }

    try {
      const agents = this.agentConfigManager.getAgents();
      this.agents.clear();
      
      for (const agent of agents) {
        this.agents.set(agent.id, agent);
      }
      
      this.currentAgentId = this.agentConfigManager.getDefaultAgent();
      
      Logger.info('从配置文件加载 Agent', { 
        agentCount: this.agents.size,
        currentAgent: this.currentAgentId 
      });
    } catch (error) {
      Logger.error('加载 Agent 配置失败，使用默认配置', error);
      this.registerDefaultAgents();
    }
  }

  /**
   * 保存 Agent 到配置文件
   */
  private async saveAgentsToConfig() {
    if (!this.agentConfigManager) {
      // 内存模式，不需要保存
      return;
    }

    try {
      const agents: AgentConfig[] = [];
      this.agents.forEach(agent => agents.push(agent));
      await this.agentConfigManager.updateAgents(agents);
      Logger.debug('Agent 配置已保存');
    } catch (error) {
      Logger.error('保存 Agent 配置失败', error);
    }
  }

  /**
   * 注册默认 Agent
   */
  private registerDefaultAgents() {
    if (!this.agentConfigManager) {
      // AgentConfigManager 未初始化，抛出错误
      Logger.errorAndThrow('AgentConfigManager 未初始化，无法加载默认 Agent');
      return;
    }

    try {
      // 从配置文件加载 Agent，如果不存在则创建
      const agents = this.agentConfigManager.getAgents();
      this.agents.clear();
      
      for (const agent of agents) {
        this.agents.set(agent.id, agent);
      }
      
      this.currentAgentId = this.agentConfigManager.getDefaultAgent();
      
      Logger.info('从配置文件加载 Agent', { 
        agentCount: this.agents.size,
        currentAgent: this.currentAgentId 
      });
    } catch (error) {
      Logger.error('加载 Agent 配置失败', error);
      throw error;
    }
  }

  /**
   * 注册 Agent
   */
  registerAgent(agent: AgentConfig) {
    this.agents.set(agent.id, agent);
    this.saveAgentsToConfig();
    Logger.debug('Agent 已注册', { id: agent.id, name: agent.name });
  }

  /**
   * 添加新 Agent
   */
  async addAgent(agent: AgentConfig): Promise<void> {
    if (this.agents.has(agent.id)) {
      Logger.errorAndThrow(`Agent ID "${agent.id}" 已存在`);
    }
    
    this.agents.set(agent.id, agent);
    await this.saveAgentsToConfig();
    Logger.info('新 Agent 已添加', { id: agent.id, name: agent.name });
  }

  /**
   * 更新 Agent
   */
  async updateAgent(agentId: string, updates: Partial<AgentConfig>): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      Logger.errorAndThrow(`Agent ID "${agentId}" 不存在`);
    }
    
    const updatedAgent = { ...agent, ...updates };
    this.agents.set(agentId, updatedAgent);
    await this.saveAgentsToConfig();
    Logger.info('Agent 已更新', { id: agentId });
  }

  /**
   * 删除 Agent
   */
  async removeAgent(agentId: string): Promise<void> {
    if (!this.agents.has(agentId)) {
      Logger.errorAndThrow(`Agent ID "${agentId}" 不存在`);
    }
    
    this.agents.delete(agentId);
    await this.saveAgentsToConfig();
    Logger.info('Agent 已删除', { id: agentId });
  }

  /**
   * 获取所有 Agent
   */
  getAllAgents(): AgentConfig[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取 Agent
   */
  getAgent(agentId: string): AgentConfig | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 获取当前 Agent
   */
  getCurrentAgent(): AgentConfig {
    const agent = this.agents.get(this.currentAgentId);
    if (!agent) {
      Logger.errorAndThrow(`当前 Agent 不存在：${this.currentAgentId}`);
    }
    return agent;
  }

  /**
   * 切换 Agent
   */
  switchAgent(agentId: string): boolean {
    if (!this.agents.has(agentId)) {
      Logger.error('切换 Agent 失败，Agent 不存在', { agentId });
      return false;
    }

    const oldAgentId = this.currentAgentId;
    this.currentAgentId = agentId;
    
    const newAgent = this.agents.get(agentId)!;
    Logger.info('Agent 已切换', { 
      from: oldAgentId, 
      to: agentId,
      name: newAgent.name 
    });
    
    return true;
  }

  /**
   * 获取当前系统提示词
   */
  getSystemPrompt(): string {
    return this.getCurrentAgent().systemPrompt;
  }

  /**
   * 获取当前 Agent 可用的工具列表
   */
  getAvailableTools(): string[] {
    return this.getCurrentAgent().tools;
  }

  /**
   * 获取所有 Agent 列表
   */
  updateAgentSystemPrompt(agentId: string, systemPrompt: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      Logger.error('更新 Agent 失败，Agent 不存在', { agentId });
      return false;
    }

    agent.systemPrompt = systemPrompt;
    Logger.info('Agent 系统提示词已更新', { agentId });
    return true;
  }

  /**
   * 删除 Agent
   */
  deleteAgent(agentId: string): boolean {
    if (agentId === 'default') {
      Logger.error('不能删除默认 Agent', { agentId });
      return false;
    }

    const success = this.agents.delete(agentId);
    if (success) {
      Logger.info('Agent 已删除', { agentId });
      
      // 如果删除的是当前 Agent，切换回默认
      if (this.currentAgentId === agentId) {
        this.currentAgentId = 'default';
      }
    }
    return success;
  }
}

// 导出单例
export const agentManager = AgentManager.getInstance();
