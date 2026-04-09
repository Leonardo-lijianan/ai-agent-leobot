export interface ModelConfig {
  name: string;
  type: 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiKey?: string;
  endpoint?: string;
  model?: string;
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
