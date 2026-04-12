export interface ModelConfig {
  id: string;
  protocolType: 'openai' | 'anthropic' | 'ollama' | 'gemini' | 'custom';
  apiKey?: string;
  endpoint?: string;
  modelId?: string;
}

export interface ModelAdapter {
  modelId: string;
  protocolType: 'openai' | 'anthropic' | 'ollama' | 'gemini' | 'custom';
  chat(messages: Message[], model?: string, tools?: boolean): Promise<string>;
  stream?(messages: Message[], model?: string): AsyncIterable<string>;
}

export interface SkillConfig {
  name: string;
  type: 'mcp' | 'local' | 'api';
  config?: any;
  path?: string;
  description?: string;
}

/**
 * Agent 配置接口
 */
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  modelConfigId?: string; // 关联的模型
}

export interface AgentModelConfig {
  id: string;
  name: string;
  modelId: string; // 关联的模型 ID
}

export interface ModelConfigFile {
  models: ModelConfig[];
  defaultModel: string;
  currentAgent: string;
  agentModels: AgentModelConfig[]; // Agent 和模型的关联
  agentModeEnabled?: boolean; // 是否启用 Agent 模式
}

export interface AgentConfigFile {
  agents: AgentConfig[];
  defaultAgent: string;
}

// export interface PluginConfig {
//   models: ModelConfig[];
//   skills: SkillConfig[];
//   agents: AgentConfig[];
//   defaultModel: string;
// }

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface ChatPanelMessage {
  type: 'send' | 'ready' | 'response' | 'error' | 'config';
  data?: any;
}

export interface Skill {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute(input: any): Promise<any>;
}

/**
 * 统一工具接口
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute(args: any): Promise<any>;
  source: 'mcp' | 'skill';
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
    }>;
    required?: string[];
  };
  handler: (args: any) => Promise<any>;
}

export interface MCPMessage {
  role: 'user' | 'assistant' | 'system';
  content: MCPContent[];
}

export type MCPContent = 
  | { type: 'text'; text: string }
  | { type: 'resource'; resource: { uri: string; text: string; mimeType?: string } }
  | { type: 'image'; data: string; mimeType: string };
