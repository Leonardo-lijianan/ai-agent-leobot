// 基本类型定义（JSON 可序列化）

export type GlobalConfigData = {
  agentModeEnabled: boolean;
};

export type ModelConfigData = {
  id: string;
  protocolType: protocolEnum;
  apiKey?: string;
  endpoint?: string;
  modelId?: string;
};

export type AgentConfigData = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  modelConfigId?: string;
};

export type configDataEnum = GlobalConfigData | ModelConfigData | AgentConfigData;

export interface receiveMap {
  "config>updateList>chat": { listType: configEnum };

  // ChatView 相关通知
  "chat:error": string;
  "chat:clear": {};
}

export interface requestMap {
  "chat:ready": {};
  "chat:getHistory": { modelConfigId: string; agentConfigId: string };
  "chat:getCurrentConfig": { configType: configEnum };
  "chat:getConfigs": { configType: configEnum };
  "chat:getTestMarkdown": {};
  "chat:send": { sendContent: string };
  "chat:clear": {};
  "chat:openConfigPanel": {};
  "chat:toggleAgentMode": { enabled: boolean };
  "chat:switchConfig": { configType: configEnum; id: string };

  "config:loadConfig": { configType: configEnum; id: string };
  "config:currentModelConfig": {};
  "config:listConfigs": { configType: configEnum };

  "config:listUsableModels": { provider: string; endpoint: string; apiKey: string };
  "config:testModelConfig": { config: ModelConfigData };
  "config:changeConfig": {
    configType: configEnum;
    config: ModelConfigData | AgentConfigData;
  };

  "config:addConfig": {
    configType: configEnum;
    config: ModelConfigData | AgentConfigData;
  };
  "config:deleteConfig": { configType: configEnum; id: string };

  "config:getConfigPath": {};
  "config:browseConfigPath": {};
  "config:migrateConfig": { newPath: string };
  "config:loadAgentList": {};
}

// request 的响应数据类型映射（定义各种响应数据的格式）
export interface responseMap {
  "chat:ready": {};
  "chat:getHistory": { messages: Array<{ role: string; content: string; timestamp: number }> };
  "chat:getCurrentConfig": { config: GlobalConfigData | ModelConfigData | AgentConfigData };
  "chat:getConfigs": { configs: Array<configDataEnum> };
  "chat:getTestMarkdown": { text: string };
  "chat:send": { receiveContent: string };
  "chat:clear": {};
  "chat:openConfigPanel": {};
  "chat:toggleAgentMode": {};
  "chat:switchConfig": {};

  "config:loadConfig": { config: ModelConfigData | AgentConfigData };
  "config:listConfigs": { configs: ModelConfigData[] | AgentConfigData[] };
  "config:getConfigPath": { path: string };
  "config:testModelConfig": {};
  "config:changeConfig": {};
  "config:listUsableModels": { usableModels: string[] };
  "config:addConfig": {};
  "config:deleteConfig": {};
  "config:browseConfigPath": { path: string; cancelled: boolean };
  "config:migrateConfig": {};
  "config:currentModelConfig": { config: ModelConfigData };
  "config:loadAgentList": {};
}

// request 的响应数据格式（从 responseDataMap 中提取）
export type responseData<T extends keyof responseMap> = {
  success: boolean;
  data?: responseMap[T];
  error?: string;
};
