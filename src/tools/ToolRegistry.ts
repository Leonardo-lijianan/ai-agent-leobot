import { Skill, Tool, MCPTool } from '../types.js';
import { Logger } from '../utils/Logger.js';

/**
 * 工具注册表
 * 
 * 职责：
 * - 注册所有 MCP 工具和 Skill
 * - 统一暴露给 LLM
 * - 执行工具调用
 */
export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, Tool> = new Map();
  
  private constructor() {}
  
  /**
   * 获取单例实例
   */
  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }
  
  /**
   * 注册 MCP 工具
   */
  registerMCPTools(mcpTools: MCPTool[]) {
    for (const tool of mcpTools) {
      const wrappedTool: Tool = {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: (args) => tool.handler(args),
        source: 'mcp'
      };
      this.tools.set(tool.name, wrappedTool);
      Logger.debug('注册 MCP 工具', { name: tool.name });
    }
  }
  
  /**
   * 注册 Skill
   */
  registerSkills(skills: Skill[]) {
    for (const skill of skills) {
      const wrappedTool: Tool = {
        name: skill.name,
        description: skill.description,
        inputSchema: skill.inputSchema,
        execute: (args) => skill.execute(args),
        source: 'skill'
      };
      this.tools.set(skill.name, wrappedTool);
      Logger.debug('注册 Skill', { name: skill.name, source: 'skill' });
    }
  }
  
  /**
   * 获取所有工具（给 LLM 用）
   */
  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * 执行工具
   */
  async executeTool(name: string, args: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      Logger.errorAndThrow(`工具不存在：${name}`);
    }
    
    Logger.info('执行工具', { 
      name, 
      source: tool.source,
      args: JSON.stringify(args).substring(0, 100) 
    });
    
    return tool.execute(args);
  }
}
