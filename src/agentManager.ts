import { Logger } from './logger.js';
import { AgentConfigManager } from './agentConfigManager.js';

/**
 * Agent 配置接口
 */
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  modelId?: string; // 关联的模型
}

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
    // 默认通用助手
    this.registerAgent({
      id: 'default',
      name: '通用助手',
      description: '通用的 AI 编程助手',
      systemPrompt: this.getDefaultSystemPrompt(),
      tools: ['read_file', 'write_file', 'list_directory', 'search_files', 'insert_lines']
    });

    Logger.info('Agent 管理器已初始化', { 
      agentCount: this.agents.size,
      currentAgent: this.currentAgentId,
      mode: this.agentConfigManager ? '配置文件' : '内存'
    });
  }

  /**
   * 获取默认系统提示词
   */
  private getDefaultSystemPrompt(): string {
    return `你是 AI 助手，可访问本地文件系统帮助用户完成任务。

## 基础工具（MCP）
- read_file: 读取文件
- write_file: 写入/修改文件
- list_directory: 列出目录
- search_files: 搜索文件
- insert_lines: 插入内容

## 高级技能（Skill）
- refactor-code: 重构代码
- add-feature: 添加功能
- debug-issue: 调试问题

## 工作流程
1. 简单操作：直接用 MCP 工具（read_file/write_file/insert_lines 等）
2. 复杂任务：用 Skill（refactor-code/add-feature/debug-issue）
3. 需要查看：用 read_file

## 规则
- 工具调用后会看到执行结果
- 不重复调用相同工具
- 用户明确修改时直接修改，不先读取
- 最多 5 次工具调用循环

## 角色说明
根据上下文和用户需求调整专业领域和表达方式。`;
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
