import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ModelConfig, ModelConfigFile } from "../types/shared_T.js";
import { Logger } from "../utils/Logger.js";
import { encrypt, decrypt } from "../utils/crypto.js";
import { GlobalConfigManager } from "./GlobalConfigManager.js";

const CONFIG_FILE_NAME = "modelConfig.json";

export class ModelConfigManager {
  private static instance: ModelConfigManager;
  private configPath: string = "";
  private _context?: vscode.ExtensionContext;
  private _onDidChangeConfig = new vscode.EventEmitter<void>();
  public readonly onDidChangeConfig = this._onDidChangeConfig.event;

  private constructor() {}

  static getInstance(): ModelConfigManager {
    if (!ModelConfigManager.instance) {
      ModelConfigManager.instance = new ModelConfigManager();
    }
    return ModelConfigManager.instance;
  }

  setContext(context: vscode.ExtensionContext) {
    this._context = context;
    // 使用 VS Code 的全局存储目录（用户数据目录）
    // Windows: %APPDATA%\Code\User\globalStorage\your-extension-id\
    this.configPath = path.join(context.globalStorageUri.fsPath, CONFIG_FILE_NAME);
    Logger.config("ModelConfigManager 初始化", { configPath: this.configPath });
  }

  getContext(): vscode.ExtensionContext | undefined {
    return this._context;
  }

  private ensureConfigFile(): void {
    const configDir = path.dirname(this.configPath);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (!fs.existsSync(this.configPath)) {
      const defaultConfig: ModelConfigFile = {
        models: [
          {
            id: "硅基流动",
            protocolType: "openai",
            endpoint: "https://api.siliconflow.cn/v1",
            apiKey: "",
            modelId: "Qwen/Qwen3.5-122B-A10B",
          },
        ],
        defaultModel: "硅基流动",
        // ✅ currentAgent、agentModels、agentModeEnabled 已迁移到 GlobalConfigManager
      };

      fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2), "utf-8");
      Logger.config("创建默认配置文件", { path: this.configPath });
    }
  }

  private readConfig(): ModelConfigFile {
    this.ensureConfigFile();

    try {
      const content = fs.readFileSync(this.configPath, "utf-8");
      return JSON.parse(content);
    } catch (error: any) {
      Logger.error("读取配置文件失败", error);
      Logger.errorAndThrow(`配置文件损坏：${error.message}`);
    }
  }

  private writeConfig(config: ModelConfigFile): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf-8");
      Logger.config("保存配置文件", { path: this.configPath });
    } catch (error: any) {
      Logger.errorAndThrow(`无法保存配置文件：${error.message}`);
    }
  }

  getModels(): ModelConfig[] {
    const config = this.readConfig();
    return config.models || [];
  }

  async updateModels(models: ModelConfig[]): Promise<void> {
    const config = this.readConfig();
    config.models = models;
    this.writeConfig(config);
    this._onDidChangeConfig.fire();
  }

  getDefaultModel(): string {
    const config = this.readConfig();
    return config.defaultModel || "硅基流动";
  }

  async setDefaultModel(modelName: string): Promise<void> {
    const config = this.readConfig();
    config.defaultModel = modelName;
    this.writeConfig(config);
    this._onDidChangeConfig.fire();
  }

  async getApiKey(modelName: string): Promise<string | undefined> {
    const models = this.getModels();
    const model = models.find((m) => m.id === modelName);

    if (model?.apiKey) {
      if (!this._context) {
        Logger.error("Context 未初始化，无法解密 API Key");
        return model.apiKey; // 返回加密文本（兼容模式）
      }
      try {
        return await decrypt(model.apiKey, this._context);
      } catch (error: any) {
        Logger.error("解密 API Key 失败", error);
        return model.apiKey; // 解密失败则返回原文（兼容旧数据）
      }
    }
    return undefined;
  }

  async updateApiKey(modelName: string, apiKey: string): Promise<void> {
    const models = this.getModels();
    const modelIndex = models.findIndex((m) => m.id === modelName);

    if (modelIndex !== -1) {
      if (!this._context) {
        Logger.error("Context 未初始化，无法加密 API Key");
        models[modelIndex].apiKey = apiKey; // 直接保存明文（兼容模式）
      } else {
        Logger.config("加密 API Key", { modelName, contextExists: true });
        const encryptedKey = await encrypt(apiKey, this._context);
        Logger.config("API Key 已加密", { modelName, encryptedLength: encryptedKey.length });
        models[modelIndex].apiKey = encryptedKey;
      }
      await this.updateModels(models);
    } else {
      Logger.error("找不到模型", { modelName });
    }
  }

  getModelById(id: string): ModelConfig {
    const models = this.getModels();
    const model = models.find((m) => m.id === id);
    if (!model) {
      Logger.errorAndThrow(`找不到模型配置: ${id}`);
    }
    return model;
  }

  async getCurrentAgentAndModel(): Promise<{
    agentModeEnabled: boolean;
    currentAgent: string;
    defaultModel: string;
  }> {
    // ✅ 从 GlobalConfigManager 获取运行时配置
    const globalConfigManager = GlobalConfigManager.getInstance();
    const config = this.readConfig();
    return {
      agentModeEnabled: globalConfigManager.isAgentModeEnabled(),
      currentAgent: globalConfigManager.getCurrentAgent(),
      defaultModel: config.defaultModel || "硅基流动",
    };
  }

  getConfigFilePath(): string {
    return this.configPath;
  }
}
