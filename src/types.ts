export interface ModelConfig {
  name: string;
  type: 'openai' | 'anthropic' | 'ollama' | 'gemini' | 'custom' | 'siliconflow';
  apiKey?: string;
  endpoint?: string;
  model?: string;
  modelName?: string; // 实际使用的模型名称
}

export interface SkillConfig {
  name: string;
  type: 'mcp' | 'local' | 'api';
  config?: any;
  path?: string;
  description?: string;
}

export interface AgentConfig {
  name: string;
  model: string;
  skills: string[];
  description?: string;
}

export interface PluginConfig {
  models: ModelConfig[];
  skills: SkillConfig[];
  agents: AgentConfig[];
  defaultModel: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface ChatPanelMessage {
  type: 'send' | 'ready' | 'response' | 'error' | 'config';
  data?: any;
}
