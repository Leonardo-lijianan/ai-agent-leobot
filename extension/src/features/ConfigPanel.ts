import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ModelConfigManager } from "../managers/ModelConfigManager.js";
import { GlobalConfigManager } from "../managers/GlobalConfigManager.js";
import { AgentConfigManager } from "../managers/AgentConfigManager.js";
import { agentManager } from "../managers/AgentManager.js";
import { Logger } from "../utils/Logger.js";
import { ModelConfig, AgentConfig } from "../types/shared_T.js";
import { ModelConfigData } from "../types/messageHub_P.js";
import { createModelAdapter } from "../adapters/modelAdapter.js";
import { getHtmlForWebview } from "../utils/loadMedia.js";
import { messageHub } from "../utils/messageHub.js";
import { getChatViewProvider } from "../extension.js";

export class ConfigPanel {
  private panel: vscode.WebviewPanel;
  private modelConfigManager: ModelConfigManager;
  private agentConfigManager: AgentConfigManager;
  private context: vscode.ExtensionContext;
  private readonly _extensionPath: string;

  constructor(
    panel: vscode.WebviewPanel,
    modelConfigManager: ModelConfigManager,
    agentConfigManager: AgentConfigManager,
    context: vscode.ExtensionContext
  ) {
    this.panel = panel;
    this.modelConfigManager = modelConfigManager;
    this.agentConfigManager = agentConfigManager;
    this.context = context;
    this._extensionPath = context.extensionPath;

    // 注册消息处理器
    this.setupMessageListeners();

    panel.webview.html = this.getHtmlForWebview();
  }

  private getHtmlForWebview(): string {
    // 使用 loadMedia.ts 来加载 HTML
    return getHtmlForWebview(
      this._extensionPath,
      "config_panel.html",
      "config_panel.css",
      "config_panel.js"
    );
  }

  private setupMessageListeners() {
    const webview = this.panel.webview;

    // 注册 webview 监听器（只注册一次）
    messageHub.ensureWebviewListener(webview);

    // 配置加载请求
    messageHub.registerRequestHandler("config:loadConfig", async (data) => {
      Logger.config("[ConfigPanel] 收到消息", data);
      return await this.handleLoadConfig(data.configType, data.id);
    });

    // 测试模型配置请求
    messageHub.registerRequestHandler("config:testModelConfig", async (data) => {
      Logger.config("[ConfigPanel] 收到消息", data);
      return await this.handleTestModelConfig(data.config);
    });

    // 添加配置请求
    messageHub.registerRequestHandler("config:addConfig", async (data) => {
      Logger.config("[ConfigPanel] 收到消息", data);
      return await this.handleAddConfig(data.configType, data.config);
    });

    // 修改配置请求
    messageHub.registerRequestHandler("config:changeConfig", async (data) => {
      Logger.config("[ConfigPanel] 收到消息", data);
      return await this.handleChangeConfig(data.configType, data.config);
    });

    // 删除配置请求
    messageHub.registerRequestHandler("config:deleteConfig", async (data) => {
      Logger.config("[ConfigPanel] 收到消息", data);
      return await this.handleDeleteConfig(data.configType, data.id);
    });

    // 获取可用模型列表请求
    messageHub.registerRequestHandler("config:listUsableModels", async (data) => {
      Logger.config("[ConfigPanel] 收到消息", data);
      return await this.handleListModels(data.provider, data.endpoint, data.apiKey);
    });

    // 获取配置路径请求
    messageHub.registerRequestHandler("config:getConfigPath", async () => {
      Logger.config("[ConfigPanel] 收到消息");
      return await this.handleGetConfigPath();
    });

    // 浏览配置路径请求
    messageHub.registerRequestHandler("config:browseConfigPath", async () => {
      Logger.config("[ConfigPanel] 收到消息");
      return await this.handleBrowseConfigPath();
    });

    // 迁移配置请求
    messageHub.registerRequestHandler("config:migrateConfig", async (data) => {
      Logger.config("[ConfigPanel] 收到消息", data);
      return await this.handleMigrateConfig(data.newPath);
    });

    // 添加配置请求（统一处理 model 和 agent）
    messageHub.registerRequestHandler("config:addConfig", async (data) => {
      Logger.config("[ConfigPanel] 收到消息", data);
      return await this.handleAddConfig(data.configType, data.config);
    });

    // 加载 Agent 列表请求
    messageHub.registerRequestHandler("config:loadAgentList", async () => {
      Logger.config("[ConfigPanel] 收到消息");
      return await this.handleLoadAgentList();
    });

    // 注册 listConfigs 请求处理器
    messageHub.registerRequestHandler("config:listConfigs", async (data) => {
      const configType = data.configType || "agent";
      if (configType === "agent") {
        const agents = agentManager.getAllAgents();
        return {
          success: true,
          data: {
            configs: agents.map((a: AgentConfig) => ({
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
        const models = this.modelConfigManager.getModels();
        return {
          success: true,
          data: {
            configs: models.map((m: ModelConfig) => ({
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
  }

  private async handleLoadConfig(configType: string, id: string) {
    try {
      Logger.config(`加载配置，类型：${configType} ID: ${id}`);

      if (configType === "model") {
        // 获取模型配置
        const config: ModelConfig = this.modelConfigManager.getModelById(id);
        Logger.config(`当前模型配置：${JSON.stringify(config)}`);
        // 不返回 API Key（前端不需要知道，也不显示）
        const configWithoutApiKey = { ...config };
        delete configWithoutApiKey.apiKey;
        return { success: true, data: { config: configWithoutApiKey } };
      } else if (configType === "agent") {
        // 获取 Agent 配置
        const config: AgentConfig = this.agentConfigManager.getAgentById(id);
        Logger.config(`当前 Agent 配置：${JSON.stringify(config)}`);
        return { success: true, data: { config } };
      }

      return { success: false, error: "未知的配置类型" };
    } catch (error: any) {
      Logger.error("获取配置失败", error);
      return { success: false, error: error.message || "获取配置失败" };
    }
  }

  private async handleAddConfig(configType: string, config: any) {
    try {
      Logger.config(`添加配置，类型：${configType} 配置：${JSON.stringify(config)}`);
      const chatViewProvider = getChatViewProvider();

      if (configType === "model") {
        // 添加或更新模型配置
        const models = this.modelConfigManager.getModels();
        const existingIndex = models.findIndex((m) => m.id === config.id);

        if (existingIndex !== -1) {
          // 更新现有模型
          models[existingIndex].protocolType = config.protocolType;
          models[existingIndex].endpoint = config.endpoint;
          models[existingIndex].modelId = config.modelId;
          // 如果有新的 API Key，需要加密后保存
          if (config.apiKey) {
            await this.modelConfigManager.updateApiKey(config.id, config.apiKey);
          } else {
            await this.modelConfigManager.updateModels(models);
          }
        } else {
          // 添加新模型 - 先保存不含 API Key 的配置
          const modelWithoutApiKey = { ...config };
          delete modelWithoutApiKey.apiKey; // 删除明文 API Key
          models.push(modelWithoutApiKey);
          await this.modelConfigManager.updateModels(models);

          // 然后再加密保存 API Key
          if (config.apiKey) {
            Logger.config("准备加密 API Key", {
              modelId: config.id,
              apiKeyLength: config.apiKey.length,
            });
            await this.modelConfigManager.updateApiKey(config.id, config.apiKey);
          } else {
            Logger.config("没有 API Key，跳过加密");
          }
        }

        // 通知 ChatView 更新模型下拉框
        if (chatViewProvider?.view) {
          messageHub.sendToWebview(chatViewProvider.view.webview, "config>updateList>chat", {
            listType: "model",
          });
          Logger.config("已发送更新模型列表通知到 ChatView");
        }
      } else if (configType === "agent") {
        // 添加 Agent 配置
        await this.agentConfigManager.addAgent(config);

        // 通知 ChatView 更新 Agent 下拉框
        if (chatViewProvider?.view) {
          messageHub.sendToWebview(chatViewProvider.view.webview, "config>updateList>chat", {
            listType: "agent",
          });
          Logger.config("已发送更新 Agent 列表通知到 ChatView");
        }
      }

      return { success: true, data: {} };
    } catch (error: any) {
      Logger.error("添加配置失败", error);
      return { success: false, error: error.message || "添加配置失败" };
    }
  }

  private async handleChangeConfig(configType: string, config: any) {
    try {
      Logger.config(`修改配置，类型：${configType} 配置：${JSON.stringify(config)}`);
      const chatViewProvider = getChatViewProvider();

      if (configType === "model") {
        // 修改模型配置 - 一次性获取并更新所有字段，避免竞态条件
        const models = this.modelConfigManager.getModels();
        const index = models.findIndex((m) => m.id === config.id);
        if (index !== -1) {
          // 更新非敏感字段
          models[index].protocolType = config.protocolType;
          models[index].endpoint = config.endpoint;
          models[index].modelId = config.modelId;

          // 如果有新 API 密钥，更新它（加密）
          if (config.apiKey && config.apiKey.trim() !== "") {
            if (!this.context) {
              Logger.error("Context 未初始化，无法加密 API Key");
              models[index].apiKey = config.apiKey; // 直接保存明文（兼容模式）
            } else {
              const { encrypt } = await import("../utils/crypto.js");
              Logger.config("加密 API Key", { modelId: config.id });
              const encryptedKey = await encrypt(config.apiKey, this.context);
              Logger.config("API Key 已加密", {
                modelId: config.id,
                encryptedLength: encryptedKey.length,
              });
              models[index].apiKey = encryptedKey;
            }
          }
          // 否则保持原有 API Key 不变（已加密）

          // 一次性保存所有更改
          await this.modelConfigManager.updateModels(models);
          Logger.config(`模型配置已更新：${config.id}`);

          if (chatViewProvider?.view) {
            messageHub.sendToWebview(chatViewProvider.view.webview, "config>updateList>chat", {
              listType: "model",
            });
            Logger.config("已发送更新 Agent 列表通知到 ChatView");
          }
        } else {
          Logger.error(`模型配置 ${config.id} 不存在，无法修改`);
          return { success: false, error: `模型配置 ${config.id} 不存在` };
        }
      } else if (configType === "agent") {
        // 修改 Agent 配置
        await this.agentConfigManager.updateAgent(config.id, config);
        Logger.config(`Agent 配置已更新：${config.id}`);

        // 通知 ChatView 更新 Agent 下拉框

        if (chatViewProvider?.view) {
          messageHub.sendToWebview(chatViewProvider.view.webview, "config>updateList>chat", {
            listType: "agent",
          });
          Logger.config("已发送更新 Agent 列表通知到 ChatView");
        }
      }

      return { success: true, data: {} };
    } catch (error: any) {
      Logger.error("修改配置失败", error);
      return { success: false, error: error.message || "修改配置失败" };
    }
  }

  private async handleDeleteConfig(configType: string, id: string) {
    try {
      Logger.config(`删除配置，类型：${configType} ID: ${id}`);

      // 使用 VSCode 原生确认对话框
      const confirmation = await vscode.window.showWarningMessage(
        `确定要删除${configType === "model" ? "模型" : "Agent"}配置 "${id}" 吗？`,
        { modal: true },
        "删除"
      );

      if (confirmation !== "删除") {
        return { success: false, error: "用户取消删除" };
      }

      if (configType === "model") {
        // 删除模型配置
        const models = this.modelConfigManager.getModels();
        const filteredModels = models.filter((m) => m.id !== id);
        await this.modelConfigManager.updateModels(filteredModels);
      } else if (configType === "agent") {
        // 删除 Agent 配置
        const agents = this.agentConfigManager.getAgents();
        const filteredAgents = agents.filter((a) => a.id !== id);
        await this.agentConfigManager.updateAgents(filteredAgents);
      }

      return { success: true, data: {} };
    } catch (error: any) {
      Logger.error("删除配置失败", error);
      return { success: false, error: error.message || "删除配置失败" };
    }
  }

  private async handleTestModelConfig(config: ModelConfigData) {
    try {
      Logger.config("测试模型配置:", config);

      if (config.protocolType === "gemini") {
        const { GoogleGenAI } = await import("@google/genai");
        const genAI = new GoogleGenAI({ apiKey: config.apiKey || "" });
        await genAI.models.list();
      } else {
        const baseURL = config.endpoint || "https://api.openai.com/v1";
        const url = `${baseURL}/chat/completions`;

        Logger.config("发送测试请求:", {
          url,
          model: config.modelId,
          hasApiKey: !!config.apiKey,
          apiKeyLength: config.apiKey?.length || 0,
        });

        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: config.modelId || "deepseek-ai/DeepSeek-V3",
            messages: [{ role: "user", content: "Hello" }],
            max_tokens: 10,
          }),
        });

        Logger.config("收到响应:", {
          status: response.status,
          statusText: response.statusText,
        });

        if (!response.ok) {
          let errorText = "";
          try {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              const errorJson = await response.json();
              errorText = JSON.stringify(errorJson, null, 2);
              Logger.error("API 返回错误响应:", errorJson);
            } else {
              errorText = await response.text();
              Logger.error("API 返回错误文本:", errorText);
            }
          } catch (readError: any) {
            Logger.error("读取错误响应体失败:", readError);
            errorText = `无法读取响应体：${readError.message}`;
          }

          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }
      }

      Logger.config("测试结果：成功");
      return { success: true, data: {} };
    } catch (error: any) {
      Logger.error("测试连接失败", error);
      return { success: false, error: error.message || "测试失败" };
    }
  }

  private async handleListModels(provider: string, endpoint: string, apiKey: string) {
    try {
      Logger.config("获取模型列表:", { provider, endpoint });

      let modelList: string[] = [];

      if (provider === "gemini") {
        const { GoogleGenAI } = await import("@google/genai");
        const genAI = new GoogleGenAI({ apiKey });
        const response = await genAI.models.list();
        const models = (response as any).models || [];
        const generateModels = models.filter((model: any) =>
          model.supportedGenerationMethods?.includes("generateContent")
        );
        const top5 = generateModels.slice(0, 5);
        modelList = top5.map((m: any) => m.name.replace("models/", ""));
      } else {
        const baseURL = endpoint || "https://api.openai.com/v1";
        const response = await fetch(`${baseURL}/models`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }

        const data: any = await response.json();
        const models = data.data || [];
        const top5 = models.slice(0, 5);
        modelList = top5.map((m: any) => m.id);
      }

      return { success: true, data: { usableModels: modelList } };
    } catch (error: any) {
      Logger.error("获取模型列表失败", error);
      return { success: false, error: error.message || "获取失败" };
    }
  }

  private async handleLoadAgentList() {
    try {
      await this.loadAgentModelList();
      return { success: true, data: {} };
    } catch (error: any) {
      Logger.error("加载 Agent 列表失败", error);
      return { success: false, error: error.message || "加载失败" };
    }
  }

  public async loadAgentModelList() {
    try {
      const agents = this.agentConfigManager.getAgents();
      const agentModels = agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        modelId: agent.modelConfigId || "",
      }));

      // 这个是发送给 ConfigPanel 自己的，应该改成事件通知
      // 但为了保持和前端兼容，暂时保留 sendToWebview
      // messageHub.sendToWebview(this.panel.webview, "config:agentModelList", agentModels);
    } catch (error: any) {
      Logger.error("加载 Agent 列表失败", error);
    }
  }

  public async loadConfig() {
    await this.loadAgentModelList();
  }

  /**
   * 获取当前配置路径
   */
  private async handleGetConfigPath() {
    try {
      const currentPath = this.agentConfigManager.getConfigFilePath();
      const configDir = currentPath.replace(/[^\\\/]*\.json$/, "");

      return { success: true, data: { path: configDir } };
    } catch (error: any) {
      Logger.error("获取配置路径失败", error);
      return { success: false, error: error.message || "获取失败" };
    }
  }

  /**
   * 浏览新的配置路径
   */
  private async handleBrowseConfigPath() {
    try {
      const result = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: "选择新的配置存储位置",
        title: "迁移 AI Agent 配置",
      });

      if (result && result.length > 0) {
        return { success: true, data: { path: result[0].fsPath, cancelled: false } };
      } else {
        return { success: true, data: { path: "", cancelled: true } };
      }
    } catch (error: any) {
      Logger.error("浏览路径失败", error);
      return { success: false, error: error.message || "浏览失败" };
    }
  }

  /**
   * 迁移配置文件
   */
  private async handleMigrateConfig(newPath: string) {
    try {
      if (!newPath) {
        throw new Error("未选择新的配置路径");
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "正在迁移配置文件...",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "准备迁移...", increment: 10 });

          const currentPath = this.agentConfigManager.getConfigFilePath();
          const currentDir = currentPath.replace(/[^\\\/]*\.json$/, "");

          const configFiles = ["agentConfig.json", "modelConfig.json", "globalConfig.json"];

          progress.report({ message: "检查目标目录...", increment: 20 });

          if (!fs.existsSync(newPath)) {
            fs.mkdirSync(newPath, { recursive: true });
          }

          progress.report({ message: "复制配置文件...", increment: 30 });

          for (const file of configFiles) {
            const sourceFile = path.join(currentDir, file);
            const targetFile = path.join(newPath, file);

            if (fs.existsSync(sourceFile)) {
              fs.copyFileSync(sourceFile, targetFile);
              Logger.info(`配置文件已复制：${file}`);
            }
          }

          progress.report({ message: "更新配置管理器...", increment: 20 });

          progress.report({ message: "迁移完成！", increment: 20 });
        }
      );

      vscode.window
        .showInformationMessage("配置文件迁移完成！请重启 VS Code 扩展生效。", "重启扩展")
        .then((selection) => {
          if (selection === "重启扩展") {
            vscode.commands.executeCommand("workbench.action.reloadWindow");
          }
        });

      return { success: true, data: {} };
    } catch (error: any) {
      Logger.error("迁移配置失败", error);
      return { success: false, error: error.message || "迁移失败" };
    }
  }

  public dispose() {
    this.panel.dispose();
  }
}
