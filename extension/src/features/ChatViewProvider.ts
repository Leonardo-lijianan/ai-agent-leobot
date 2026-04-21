import * as vscode from "vscode";
import { Message, ModelConfig, ModelAdapter } from "../types/shared_T.js";
import { ModelConfigManager } from "../managers/ModelConfigManager.js";
import { GlobalConfigManager } from "../managers/GlobalConfigManager.js";
import { createModelAdapter } from "../adapters/modelAdapter.js";
import { agentManager } from "../managers/AgentManager.js";
import { Logger } from "../utils/Logger.js";
import { chatHistoryManager } from "../managers/ChatHistoryManager.js";
import { getHtmlForWebview, getMarkdownForWebview } from "../utils/loadMedia.js";
import { messageHub } from "../utils/messageHub.js";

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "ai-agent-leobot-chat";
  private _view?: vscode.WebviewView;
  private _messages: Message[] = [];
  private _modelAdapter: ModelAdapter | null = null;
  private _currentModel: string = "";
  private _currentAgentId: string = "default";
  private _agentModeEnabled: boolean = true;
  private _systemPromptAdded = false;
  private _messageListenersRegistered = false;
  private readonly _globalConfigManager: GlobalConfigManager;

  constructor(
    private readonly _extensionPath: string,
    private readonly _configManager: ModelConfigManager
  ) {
    // 初始化全局配置管理器
    this._globalConfigManager = GlobalConfigManager.getInstance();
  }

  /**
   * 获取 webview view（用于跨视图通信）
   */
  public get view(): vscode.WebviewView | undefined {
    return this._view;
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    Logger.config("[ChatViewProvider] resolveWebviewView 被调用");

    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(this._extensionPath)],
    };

    // 确保 GlobalConfig 已加载
    this._globalConfigManager.getRuntimeConfig();

    // 加载 Markdown 测试文本
    let testMarkdownText = "# Markdown 测试文本\n\n加载中...";
    try {
      testMarkdownText = getMarkdownForWebview(this._extensionPath, "test_markdown.md");
    } catch (error) {
      Logger.error("加载 Markdown 测试文件失败:", error);
    }

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview, testMarkdownText);

    // 设置消息监听器
    this._setupMessageListeners();
    // 模型初始化将在收到前端 ready 消息后进行
  }

  // 更新 Agent 配置
  private async updateAgentConfig(): Promise<boolean> {
    const agentConfig = this._globalConfigManager.getRuntimeConfig();
    const oldAgentMode = this._agentModeEnabled;
    const oldAgentId = this._currentAgentId;

    this._agentModeEnabled = agentConfig.agentModeEnabled;
    this._currentAgentId = agentConfig.currentAgent;

    // 检查 agent 配置是否发生变化
    return oldAgentMode !== this._agentModeEnabled || oldAgentId !== this._currentAgentId;
  }

  // 获取 Agent 对应的模型配置 ID
  private async getCurrentAgentConfig(): Promise<string> {
    const agentAndModelConfig = await this._configManager.getCurrentAgentAndModel();

    if (this._agentModeEnabled) {
      // Agent 模式：使用 Agent 关联的模型
      const agent = agentManager.getAgent(this._currentAgentId);
      if (agent) {
        // 如果 Agent 有指定的 modelId，使用它；否则使用 defaultModel
        return agent.modelConfigId && agent.modelConfigId !== "default"
          ? agent.modelConfigId
          : agentAndModelConfig.defaultModel;
      } else {
        // Agent 不存在，回退到 defaultModel
        return agentAndModelConfig.defaultModel;
      }
    } else {
      // 直接模式：直接使用 defaultModel
      return agentAndModelConfig.defaultModel;
    }
  }

  // 加载模型配置
  private loadModelConfig(modelConfigId: string): ModelConfig | null {
    return this._configManager.getModelById(modelConfigId) || null;
  }

  // 创建模型适配器
  private async createModelAdapter(modelConfig: ModelConfig): Promise<boolean> {
    this._currentModel = modelConfig.id;

    // 从配置文件读取 API Key
    const apiKey = await this._configManager.getApiKey(modelConfig.id);
    Logger.info("获取 API Key", {
      model: modelConfig.id,
      apiKeyExists: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      apiKeyPrefix: apiKey ? apiKey.substring(0, 3) + "..." : "无",
      protocolType: modelConfig.protocolType,
    });

    if (apiKey) {
      modelConfig.apiKey = apiKey;
    }

    this._modelAdapter = createModelAdapter(modelConfig);

    Logger.config("模型适配器初始化成功", {
      model: modelConfig.id,
      agentMode: this._agentModeEnabled,
      agentId: this._currentAgentId,
    });
    return true;
  }

  // 加载聊天上下文
  private loadChatContext(modelConfigId: string) {
    // 设置聊天记录上下文（会自动加载对应的聊天记录）
    // 直接模式使用特殊的 agentId 标识
    const historyAgentId = this._agentModeEnabled ? this._currentAgentId : "direct";
    chatHistoryManager.setCurrentContext(historyAgentId, modelConfigId);

    // 从持久化存储加载聊天记录
    this._messages = chatHistoryManager.getHistory();
    // 重置 system prompt 标志，因为历史消息中不包含 system prompt
    this._systemPromptAdded = false;
  }

  // // 初始化模型（完整流程）
  private async initializeModel() {
    // 更新 Agent 配置
    await this.updateAgentConfig();

    // 获取模型配置 ID
    const modelConfigId = await this.getCurrentAgentConfig();

    // 加载聊天上下文
    this.loadChatContext(modelConfigId);

    // 加载模型配置
    const modelConfig = this.loadModelConfig(modelConfigId);
    if (modelConfig) {
      // 创建模型适配器
      await this.createModelAdapter(modelConfig);
    } else {
      Logger.error("模型配置不存在", { model: modelConfigId });
      messageHub.sendToWebview(
        this._view!.webview,
        "chat:error",
        `模型 "${modelConfigId}" 配置不存在，请检查配置`
      );
    }
  }

  // 处理配置变更
  public async handleConfigChange() {
    // 更新 Agent 配置
    const agentChanged = await this.updateAgentConfig();

    // 获取当前模型配置 ID
    const modelConfigId = await this.getCurrentAgentConfig();

    // 检查模型是否需要更新
    const modelChanged = modelConfigId !== this._currentModel;

    Logger.config("handleConfigChange", {
      agentChanged,
      modelChanged,
      currentModel: this._currentModel,
      modelConfigId,
    });

    if (agentChanged || modelChanged) {
      // 更新 this._currentModel 为新值
      this._currentModel = modelConfigId;

      // Agent 或模型变更，需要重新初始化
      if (modelChanged) {
        // 模型变更，需要更新上下文和适配器
        this.loadChatContext(modelConfigId);
        const modelConfig = this.loadModelConfig(modelConfigId);
        if (modelConfig) {
          await this.createModelAdapter(modelConfig);
        } else {
          Logger.error("模型配置不存在", { model: modelConfigId });
          messageHub.sendToWebview(
            this._view!.webview,
            "chat:error",
            `模型 "${modelConfigId}" 配置不存在，请检查配置`
          );
        }
      } else {
        // 只有 Agent 变更，更新上下文
        this.loadChatContext(modelConfigId);
      }

      // 通知前端清空并重新拉取历史记录
      // 前端会主动调用 chat:getHistory 拉取最新的聊天记录
      if (this._view) {
        messageHub.sendToWebview(this._view.webview, "chat:clear", {});
      }
    }
  }

  // 设置消息监听器
  private _setupMessageListeners() {
    // 防止重复注册
    if (this._messageListenersRegistered) {
      Logger.config("[ChatViewProvider] 消息监听器已注册，跳过");
      return;
    }
    this._messageListenersRegistered = true;

    Logger.config("[ChatViewProvider] _setupMessageListeners 被调用");

    const webview = this._view!.webview;

    // 注册 webview 监听器（只注册一次）
    messageHub.ensureWebviewListener(webview);

    // 注册 ready 请求处理器
    messageHub.registerRequestHandler("chat:ready", async () => {
      Logger.config("[ChatViewProvider] 收到 chat:ready 请求！！！");
      // 前端已准备好，初始化模型
      await this.initializeModel();
      Logger.config("[ChatViewProvider] 模型初始化完成");
      return { success: true, data: {} };
    });

    // 注册 getCurrentConfig 请求处理器
    messageHub.registerRequestHandler("chat:getCurrentConfig", async (data) => {
      const configType = data.configType;

      if (configType === "global") {
        // 返回全局配置（Agent 模式等）
        const agentConfig = this._globalConfigManager.getRuntimeConfig();
        return {
          success: true,
          data: {
            config: {
              agentModeEnabled: agentConfig.agentModeEnabled,
              currentAgent: agentConfig.currentAgent,
            },
          },
        };
      } else if (configType === "model") {
        // 返回当前模型详细信息
        if (this._currentModel) {
          const model = this._configManager.getModelById(this._currentModel);
          if (model) {
            return {
              success: true,
              data: {
                config: {
                  id: model.id,
                  modelId: model.modelId || "",
                  protocolType: model.protocolType,
                },
              },
            };
          }
        }
        // 模型不存在，返回默认值
        return {
          success: true,
          data: {
            config: {
              id: "",
              modelId: "",
              protocolType: "custom",
            },
          },
        };
      } else if (configType === "agent") {
        // 返回当前 Agent 详细信息
        if (this._currentAgentId) {
          const agent = agentManager.getAgent(this._currentAgentId);
          if (agent) {
            return {
              success: true,
              data: {
                config: {
                  id: agent.id,
                  name: agent.name,
                  description: agent.description,
                  systemPrompt: agent.systemPrompt || "",
                  tools: agent.tools || [],
                  modelConfigId: agent.modelConfigId,
                },
              },
            };
          }
        }
        // Agent 不存在，返回默认值
        return {
          success: true,
          data: {
            config: {
              id: "default",
              name: "默认助手",
              description: "",
              systemPrompt: "",
              tools: [],
            },
          },
        };
      }

      return { success: false, error: "未知配置类型" };
    });

    // 注册 getConfigs 请求处理器
    messageHub.registerRequestHandler("chat:getConfigs", async (data) => {
      const configType = data.configType || "agent";
      if (configType === "agent") {
        const agents = agentManager.getAllAgents();
        return {
          success: true,
          data: {
            configs: agents.map((a) => ({
              id: a.id,
              name: a.name,
              description: a.description,
              systemPrompt: a.systemPrompt,
              tools: a.tools,
              modelConfigId: a.modelConfigId,
            })),
          },
        };
      } else if (configType === "model") {
        const models = this._configManager.getModels();
        return {
          success: true,
          data: {
            configs: models.map((m) => ({
              id: m.id,
              name: m.id,
              modelId: m.modelId || "",
              protocolType: m.protocolType,
              endpoint: m.endpoint,
            })),
          },
        };
      }
      return { success: false, error: "未知配置类型" };
    });

    // 注册 getHistory 请求处理器
    messageHub.registerRequestHandler("chat:getHistory", async (data) => {
      // 直接使用当前的上下文获取历史记录
      // 注意：不要调用 setCurrentContext，因为 handleConfigChange 已经设置好了
      const history = chatHistoryManager.getHistory();
      Logger.config("chat:getHistory", {
        request: data,
        currentAgentId: chatHistoryManager.getCurrentAgentId(),
        currentModelId: chatHistoryManager.getCurrentModelId(),
        historyCount: history.length,
      });
      return {
        success: true,
        data: { messages: history },
      };
    });

    // 注册 clear 请求处理器
    messageHub.registerRequestHandler("chat:clear", async () => {
      // 设置当前的 Agent 和 Model 上下文
      chatHistoryManager.setCurrentContext(this._currentAgentId, this._currentModel || "");
      chatHistoryManager.clearHistory();
      this._messages = [];
      return { success: true, data: {} };
    });

    // 注册 getTestMarkdown 请求处理器
    messageHub.registerRequestHandler("chat:getTestMarkdown", async () => {
      const testMarkdownText = getMarkdownForWebview(this._extensionPath, "test_markdown.md");
      return {
        success: true,
        data: { text: testMarkdownText },
      };
    });

    // 注册 switchConfig 请求处理器
    messageHub.registerRequestHandler("chat:switchConfig", async (data) => {
      if (data.configType === "agent") {
        await this.switchAgent(data.id);
      } else if (data.configType === "model") {
        await this.switchModel(data.id);
      }
      return { success: true, data: {} };
    });

    // 注册 toggleAgentMode 请求处理器
    messageHub.registerRequestHandler("chat:toggleAgentMode", async (data) => {
      await this._globalConfigManager.setAgentModeEnabled(data.enabled);
      this._agentModeEnabled = data.enabled;
      this._systemPromptAdded = false;
      await this.handleConfigChange();
      Logger.config("Agent 模式已切换", { enabled: data.enabled });
      return { success: true, data: { enabled: data.enabled } };
    });

    // 注册 send 请求处理器
    messageHub.registerRequestHandler("chat:send", async (data) => {
      try {
        const response = await this.handleSendMessage(data.sendContent);
        return { success: true, data: { receiveContent: response } };
      } catch (error: any) {
        return { success: false, error: error.message || "调用失败，请检查 API Key 和网络连接" };
      }
    });

    // 注册 openConfig 请求处理器
    messageHub.registerRequestHandler("chat:openConfigPanel", async () => {
      await vscode.commands.executeCommand("ai-agent-leobot.configure");
      return { success: true, data: {} };
    });
  }

  // 处理发送消息
  private async handleSendMessage(content: string): Promise<string> {
    Logger.config("[ChatViewProvider] 收到消息:", { content });

    if (!this._modelAdapter) {
      Logger.error("[ChatViewProvider] 模型未初始化");
      throw new Error("模型未初始化，请检查配置");
    }

    // 设置当前的 Agent 和 Model 上下文
    chatHistoryManager.setCurrentContext(this._currentAgentId, this._currentModel);

    const userMessage: Message = {
      role: "user",
      content,
      timestamp: Date.now(),
    };
    this._messages.push(userMessage);
    // 保存到持久化存储
    chatHistoryManager.addMessage(userMessage);
    const messagesToSend: Message[] = [...this._messages];

    // 只在 Agent 模式下添加 System Prompt
    if (this._agentModeEnabled && !this._systemPromptAdded) {
      const agent = agentManager.getAgent(this._currentAgentId);
      if (agent && agent.systemPrompt) {
        messagesToSend.unshift({
          role: "system",
          content: agent.systemPrompt,
          timestamp: Date.now(),
        });
        this._systemPromptAdded = true;
        Logger.config("已添加 Agent System Prompt", {
          agentId: this._currentAgentId,
          agentName: agent.name,
        });
      }
    }

    // 只在 Agent 模式下启用工具
    const enableTools = this._agentModeEnabled;
    // 不传入 model 参数，让适配器使用 config.modelId（真实的模型名称）
    const response = await this._modelAdapter.chat(messagesToSend, undefined, enableTools);

    const assistantMessage: Message = {
      role: "assistant",
      content: response,
      timestamp: Date.now(),
    };
    this._messages.push(assistantMessage);
    // 保存到持久化存储
    chatHistoryManager.addMessage(assistantMessage);

    return response;
  }

  // 发送消息
  public async sendMessage(content: string) {
    await this.handleSendMessage(content);
  }

  // 清空聊天记录
  public clearChat() {
    this._messages = [];
    // 清空持久化存储
    chatHistoryManager.clearHistory();
    if (this._view) {
      messageHub.sendToWebview(this._view.webview, "chat:clear", {});
    }
  }

  // 切换 Agent 模式
  async toggleAgentMode(enabled: boolean) {
    // 保存配置
    await this._globalConfigManager.setAgentModeEnabled(enabled);
    this._agentModeEnabled = enabled;
    this._systemPromptAdded = false;

    // 处理配置变更
    await this.handleConfigChange();

    Logger.config("Agent 模式已切换", { enabled });
  }

  // 切换 Agent
  async switchAgent(agentId: string) {
    Logger.config("切换 Agent", { agentId });

    // 保存配置
    await this._globalConfigManager.setCurrentAgent(agentId);
    // 不要提前更新 this._currentAgentId，让 handleConfigChange 更新

    // 处理配置变更
    await this.handleConfigChange();

    Logger.config("Agent 已切换", { agentId });
  }

  // 切换模型
  async switchModel(modelId: string) {
    Logger.config("切换 Model", { modelId });

    // 保存配置
    await this._configManager.setDefaultModel(modelId);
    // 不要提前更新 this._currentModel，让 handleConfigChange 更新
    Logger.debug("你好1");
    // 处理配置变更
    await this.handleConfigChange();
    Logger.debug("你好2");

    Logger.config("Model (真的么）已切换", { modelId });
  }

  // 刷新视图
  public refresh() {
    this.handleConfigChange().catch((err) => {
      Logger.error("刷新聊天视图失败:", err);
    });
  }

  // 获取 Webview HTML
  private getHtmlForWebview(webview: vscode.Webview, testMarkdownText: string): string {
    // 使用 loadMedia.ts 来加载 HTML
    let html = getHtmlForWebview(
      this._extensionPath,
      "chat_view.html",
      "chat_view.css",
      "chat_view.js"
    );

    // 注入测试 Markdown 文本
    html = html.replace(
      "let testMarkdownText = '';",
      `let testMarkdownText = ${JSON.stringify(testMarkdownText)};`
    );

    return html;
  }
}
