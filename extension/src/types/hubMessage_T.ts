import { AgentConfig, ModelConfig, Message } from "./shared_T.js";
import { configEnum } from "./shared_T.js";

export interface hubMessage {
  type: string;
  data?: any;
  requestId?: string; // 请求-响应配对用
  fromWebviewId?: string; // 后端知道消息来自哪个前端
  error?: string; // 错误信息
}

export interface hubResponse {
  requestId: string;
  data?: any;
  error?: string;
}

// shared/types.ts

// 处理器类型
export type Handler = (from: string, data: any, requestId?: string) => void;

// 待处理请求
export interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout; // 超时计时器
}

// 生成唯一 ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface OnMap {
  // ConfigPanel 消息（前端发送，后端接收）
  "config_panel:loadConfig": { configType: configEnum; id: string };
  "config_panel:testModelConfig": { config: ModelConfig };
  "config_panel:addConfig": { configType: configEnum; config: any };
  "config_panel:changeConfig": { configType: configEnum; config: any };
  "config_panel:deleteConfig": { configType: configEnum; id: string };
  "config_panel:listModels": { provider: string; endpoint: string; apiKey: string };
  "config_panel:getConfigPath": {};
  "config_panel:browseConfigPath": {};
  "config_panel:migrateConfig": { newPath: string };

  // ChatView 消息（前端发送，后端接收）
  "chat_view:send": { content: string };
  "chat_view:ready": {};
  "chat_view:toggleAgentMode": { enabled: boolean };
  "chat_view:switchConfig": { type: "agent" | "model"; id: string };
  "chat_view:addConfig": {};
  "chat_view:changeConfig": {};
  "chat_view:deleteConfig": {};
  "chat_view:openConfig": {};
}

export interface SendMap {
  // ConfigPanel 消息（后端发送，前端接收）
  "ConfigPanel:loadModelConfig": ModelConfig;
  "ConfigPanel:loadAgentConfig": AgentConfig;
  testResult: { success: boolean; error?: string };
  configResult: { configType: string; success: boolean; error?: string };
  editModelResult: any;
  listModelsResult: any;
  agentModelList: any;
  configPathInfo: { path: string };
  browsePathResult: { path?: string; cancelled?: boolean };
  migrateResult: { success: boolean; error?: string };
  addAgentResult: { success: boolean; error?: string };

  // ChatView 消息（后端发送，前端接收）
  modelLoaded: {
    id: string;
    modelId: string;
    protocolType: string;
    agentMode: boolean;
    agentId: string;
    agentName: string;
  };
  configLoaded: {
    agentModeEnabled: boolean;
    currentAgent: string;
    defaultModel: string;
  };
  agentList: Array<{ id: string; name: string }>;
  modelList: Array<{ name: string; modelId: string; protocolType: string }>;
  response: Message;
  history: Message[];
  error: string;
  clear: {};
}


