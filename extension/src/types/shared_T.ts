export type configEnum = "global" | "model" | "agent";
export type protocolEnum = "openai" | "anthropic" | "ollama" | "gemini" | "custom";

export interface ModelAdapter {
  modelId: string;
  protocolType: "openai" | "anthropic" | "ollama" | "gemini" | "custom";
  chat(messages: Message[], model?: string, tools?: boolean): Promise<string>;
  stream?(messages: Message[], model?: string): AsyncIterable<string>;
}

/***************************************
 * 配置接口                             *
 ***************************************/

export interface GlobalConfig {
  currentAgent: string;
  agentModeEnabled?: boolean;
}

export interface ModelConfig {
  id: string;
  protocolType: "openai" | "anthropic" | "ollama" | "gemini" | "custom";
  apiKey?: string;
  endpoint?: string;
  modelId?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  modelConfigId?: string; // 关联的模型
}

export type configR = ModelConfig | GlobalConfig | AgentConfig;

export interface SkillConfig {
  name: string;
  type: "mcp" | "local" | "api";
  config?: any;
  path?: string;
  description?: string;
}

/***************************************
 * 全局配置文件接口                       *
 ***************************************/
export interface GlobalConfigFile {
  currentAgent: string;
  agentModeEnabled: boolean;
}

export interface ModelConfigFile {
  models: ModelConfig[];
  defaultModel: string;
}

export interface AgentConfigFile {
  agents: AgentConfig[];
  defaultAgent: string;
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Skill {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  execute(input: any): Promise<any>;
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
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description?: string;
      }
    >;
    required?: string[];
  };
  handler: (args: any) => Promise<any>;
}

export interface MCPMessage {
  role: "user" | "assistant" | "system";
  content: MCPContent[];
}

export type MCPContent =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; text: string; mimeType?: string } }
  | { type: "image"; data: string; mimeType: string };

/**
 * 统一工具接口
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  execute(args: any): Promise<any>;
  source: "mcp" | "skill";
}
