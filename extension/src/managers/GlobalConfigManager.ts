import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Logger } from "../utils/Logger.js";
import { GlobalConfigFile } from "../types/shared_T.js";

const CONFIG_FILE_NAME = "globalConfig.json";

/**
 * 全局运行时配置管理器
 * 管理全局运行时配置（currentAgent、agentModels、agentModeEnabled 等）
 */
export class GlobalConfigManager {
  private static instance: GlobalConfigManager;
  private configPath: string = "";
  private _context?: vscode.ExtensionContext;
  private _onDidChangeConfig = new vscode.EventEmitter<void>();
  public readonly onDidChangeConfig = this._onDidChangeConfig.event;

  private constructor() {}

  static getInstance(): GlobalConfigManager {
    if (!GlobalConfigManager.instance) {
      GlobalConfigManager.instance = new GlobalConfigManager();
    }
    return GlobalConfigManager.instance;
  }

  setContext(context: vscode.ExtensionContext) {
    this._context = context;
    // 使用 VS Code 的全局存储目录
    this.configPath = path.join(context.globalStorageUri.fsPath, CONFIG_FILE_NAME);
    Logger.config("GlobalConfigManager 初始化", { configPath: this.configPath });
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
      const defaultConfig: GlobalConfigFile = {
        currentAgent: "default",
        agentModeEnabled: true,
      };

      fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2), "utf-8");
      Logger.config("创建默认全局配置文件", { path: this.configPath });
    }
  }

  private readConfig(): GlobalConfigFile {
    this.ensureConfigFile();

    try {
      const content = fs.readFileSync(this.configPath, "utf-8");
      return JSON.parse(content);
    } catch (error: any) {
      Logger.error("读取全局配置文件失败", error);
      Logger.errorAndThrow(`配置文件损坏：${error.message}`);
    }
  }

  private writeConfig(config: GlobalConfigFile): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf-8");
      Logger.config("保存全局配置文件", { path: this.configPath });
    } catch (error: any) {
      Logger.errorAndThrow(`无法保存全局配置文件：${error.message}`);
    }
  }

  /**
   * 获取当前激活的 Agent ID
   */
  getCurrentAgent(): string {
    const config = this.readConfig();
    return config.currentAgent || "default";
  }

  /**
   * 设置当前激活的 Agent ID
   */
  async setCurrentAgent(agentId: string): Promise<void> {
    const config = this.readConfig();
    config.currentAgent = agentId;
    this.writeConfig(config);
    this._onDidChangeConfig.fire();
  }

  /**
   * 设置 Agent 与模型的关联配置
   */
  async setAgentModels(agentModels: { id: string; modelConfigId: string }[]): Promise<void> {
    const config = this.readConfig();
    this.writeConfig(config);
    this._onDidChangeConfig.fire();
  }

  /**
   * 检查是否启用 Agent 模式
   */
  isAgentModeEnabled(): boolean {
    const config = this.readConfig();
    return config.agentModeEnabled !== false; // 默认为 true
  }

  /**
   * 设置是否启用 Agent 模式
   */
  async setAgentModeEnabled(enabled: boolean): Promise<void> {
    const config = this.readConfig();
    config.agentModeEnabled = enabled;
    this.writeConfig(config);
    this._onDidChangeConfig.fire();
  }

  /**
   * 获取完整的运行时配置
   */
  getRuntimeConfig(): GlobalConfigFile {
    const config = this.readConfig();
    return {
      currentAgent: config.currentAgent || "default",
      agentModeEnabled: config.agentModeEnabled !== false,
    };
  }
}

// 导出单例
export const globalConfigManager = GlobalConfigManager.getInstance();
