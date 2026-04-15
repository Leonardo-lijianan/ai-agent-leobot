import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Message, ModelConfig, ModelAdapter } from "../types.js";
import { ModelConfigManager } from "../managers/ModelConfigManager.js";
import { GlobalConfigManager } from "../managers/GlobalConfigManager.js";
import { createModelAdapter } from "../adapters/modelAdapter.js";
import { agentManager } from "../managers/AgentManager.js";
import { Logger } from "../utils/Logger.js";
import { chatHistoryManager } from "../managers/ChatHistoryManager.js";
import { getHtmlForWebview, getMarkdownForWebview } from "../utils/loadMedia.js";

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "ai-agent-leobot-chat";
  private _view?: vscode.WebviewView;
  private _messages: Message[] = [];
  private _modelAdapter: ModelAdapter | null = null;
  private _currentModel: string = "";
  private _currentAgentId: string = "default";
  private _agentModeEnabled: boolean = true;
  private _systemPromptAdded = false;
  private readonly _globalConfigManager: GlobalConfigManager;

  constructor(
    private readonly _extensionPath: string,
    private readonly _configManager: ModelConfigManager
  ) {
    // 初始化全局配置管理器
    this._globalConfigManager = GlobalConfigManager.getInstance();

    // 监听配置变化事件，自动处理配置变更
    this._configManager.onDidChangeConfig(() => {
      Logger.info("检测到模型配置变化，更新配置");
      this.handleConfigChange();
    });
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(this._extensionPath)],
    };

    // 加载 Markdown 测试文本
    let testMarkdownText = "# Markdown 测试文本\n\n加载中...";
    try {
      testMarkdownText = getMarkdownForWebview(this._extensionPath, "test_markdown.md");
    } catch (error) {
      console.error("加载 Markdown 测试文件失败:", error);
    }

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview, testMarkdownText);

    this._setupWebviewMessageListener();
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
    return this._configManager.getModelByName(modelConfigId) || null;
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

    // 更新 UI 显示当前模型和 Agent 信息
    this.sendModelLoadedMessage(modelConfig, true);

    console.log("模型适配器初始化成功", {
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

  // 发送模型加载完成消息
  private sendModelLoadedMessage(modelConfig: any, sendMessage: boolean) {
    if (sendMessage && this._view) {
      this._view.webview.postMessage({
        type: "modelLoaded",
        model: {
          id: modelConfig.id,
          modelId: modelConfig.modelId || "",
          protocolType: modelConfig.protocolType,
          agentMode: this._agentModeEnabled,
          agentId: this._currentAgentId,
          agentName: agentManager.getAgent(this._currentAgentId)?.name || "默认助手",
        },
      });
    }
  }

  // 初始化模型（完整流程）
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
      console.error("模型配置不存在", { model: modelConfigId });
      this._view?.webview.postMessage({
        type: "error",
        content: `模型 "${modelConfigId}" 配置不存在，请检查配置`,
      });
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

    if (agentChanged || modelChanged) {
      // Agent 或模型变更，需要重新初始化
      if (modelChanged) {
        // 模型变更，需要更新上下文和适配器
        this.loadChatContext(modelConfigId);
        const modelConfig = this.loadModelConfig(modelConfigId);
        if (modelConfig) {
          await this.createModelAdapter(modelConfig);
        } else {
          console.error("模型配置不存在", { model: modelConfigId });
          this._view?.webview.postMessage({
            type: "error",
            content: `模型 "${modelConfigId}" 配置不存在，请检查配置`,
          });
        }
      } else {
        // 只有 Agent 变更，更新上下文
        this.loadChatContext(modelConfigId);
        // 发送模型加载消息以更新 UI
        const modelConfig = this.loadModelConfig(modelConfigId);
        if (modelConfig) {
          this.sendModelLoadedMessage(modelConfig, true);
        }
      }

      // 发送更新后的配置信息
      await this.sendConfigMessage();
      // 发送更新后的聊天记录
      await this.sendChatHistoryMessage();
    }
  }

  // 设置 Webview 消息监听器
  private _setupWebviewMessageListener() {
    this._view?.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "send":
          await this.handleSendMessage(message.content);
          break;
        case "ready":
          // 前端已准备好，初始化模型并发送配置
          await this.initializeModel();
          await this.sendConfigMessage();
          await this.sendChatHistoryMessage();
          break;
        case "toggleAgentMode":
          await this.toggleAgentMode(message.enabled);
          break;
        case "switchConfig":
          // 切换配置（Agent或模型）
          if (message.type === "agent") {
            await this.switchAgent(message.id);
          } else if (message.type === "model") {
            await this.switchModel(message.id);
          }
          break;
        case "addConfig":
        case "changeConfig":
        case "deleteConfig":
          // 配置操作，触发配置变更处理
          await this.handleConfigChange();
          break;
        case "openConfig":
          console.log("⚙️ 收到 openConfig 消息");
          await vscode.commands.executeCommand("ai-agent-leobot.configure");
          break;
      }
    });
  }

  // 发送配置消息
  private async sendConfigMessage() {
    if (!this._view) {
      return;
    }

    try {
      // 获取配置
      const agentConfig = this._globalConfigManager.getRuntimeConfig();
      const modelConfig = await this._configManager.getCurrentAgentAndModel();

      // 获取所有 Agent
      const agents = agentManager.getAllAgents();

      // 获取所有 Models
      const models = this._configManager.getModels();

      // 发送配置信息
      this._view.webview.postMessage({
        type: "configLoaded",
        config: {
          agentModeEnabled: agentConfig.agentModeEnabled,
          currentAgent: agentConfig.currentAgent,
          defaultModel: modelConfig.defaultModel,
        },
      });

      // 发送 Agent 列表
      this._view.webview.postMessage({
        type: "agentList",
        agents: agents.map((a) => ({
          id: a.id,
          name: a.name,
        })),
      });

      // 发送 Model 列表
      this._view.webview.postMessage({
        type: "modelList",
        models: models.map((m) => ({
          name: m.id,
          modelId: m.modelId || "",
          protocolType: m.protocolType,
        })),
      });

      console.log("已发送配置信息到前端", {
        agentModeEnabled: agentConfig.agentModeEnabled,
        currentAgent: agentConfig.currentAgent,
        defaultModel: modelConfig.defaultModel,
        agentsCount: agents.length,
        modelsCount: models.length,
      });
    } catch (error: any) {
      console.error("发送配置信息失败", error);
    }
  }

  // 处理发送消息
  private async handleSendMessage(content: string) {
    if (!this._modelAdapter) {
      this._view?.webview.postMessage({
        type: "error",
        content: "模型未初始化，请检查配置",
      });
      return;
    }

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
        console.log("已添加 Agent System Prompt", {
          agentId: this._currentAgentId,
          agentName: agent.name,
        });
      }
    }

    try {
      // 只在 Agent 模式下启用工具
      const enableTools = this._agentModeEnabled;
      const response = await this._modelAdapter.chat(messagesToSend, undefined, enableTools);

      const assistantMessage: Message = {
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      };
      this._messages.push(assistantMessage);
      // 保存到持久化存储
      chatHistoryManager.addMessage(assistantMessage);

      this._view?.webview.postMessage({
        type: "response",
        message: assistantMessage,
      });
    } catch (error: any) {
      this._view?.webview.postMessage({
        type: "error",
        content: error.message || "调用失败，请检查 API Key 和网络连接",
      });
      // 失败时移除最后一条用户消息
      this._messages.pop();
      chatHistoryManager.removeLastMessage();
    }
  }

  // 发送聊天历史消息
  private async sendChatHistoryMessage() {
    this._view?.webview.postMessage({
      type: "history",
      messages: this._messages,
    });
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
    this._view?.webview.postMessage({
      type: "clear",
    });
  }

  // 切换 Agent 模式
  async toggleAgentMode(enabled: boolean) {
    // 保存配置
    await this._globalConfigManager.setAgentModeEnabled(enabled);
    this._agentModeEnabled = enabled;
    this._systemPromptAdded = false;

    // 处理配置变更
    await this.handleConfigChange();

    console.log("Agent 模式已切换", { enabled });
  }

  // 切换 Agent
  async switchAgent(agentId: string) {
    console.log("切换 Agent", { agentId });

    // 保存配置
    await this._globalConfigManager.setCurrentAgent(agentId);
    this._currentAgentId = agentId;
    this._systemPromptAdded = false;

    // 处理配置变更
    await this.handleConfigChange();

    console.log("Agent 已切换", { agentId });
  }

  // 切换模型
  async switchModel(modelId: string) {
    console.log("切换 Model", { modelId });

    // 保存配置
    await this._configManager.setDefaultModel(modelId);
    this._systemPromptAdded = false;

    // 处理配置变更
    await this.handleConfigChange();

    console.log("Model 已切换", { modelId });
  }

  // 刷新视图
  public refresh() {
    this.handleConfigChange().catch((err) => {
      console.error("刷新聊天视图失败:", err);
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
