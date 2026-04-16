import * as vscode from "vscode";
import { ChatViewProvider } from "./features/ChatViewProvider.js";
import { ConfigManager } from "./configManager.js";
import { ModelConfigManager } from "./managers/ModelConfigManager.js";
import { AgentConfigManager } from "./managers/AgentConfigManager.js";
import { GlobalConfigManager } from "./managers/GlobalConfigManager.js";
import { SkillManager } from "./tools/skills.js";
import { Logger } from "./utils/Logger.js";
import { agentManager } from "./managers/AgentManager.js";
import { ToolRegistry } from "./tools/ToolRegistry.js";
import { mcpServer } from "./tools/mcp.js";
import { ConfigPanel } from "./features/ConfigPanel.js";
import { chatHistoryManager } from "./managers/ChatHistoryManager.js";
import { ConfigMigrationTool } from "./utils/ConfigMigrationTool.js";

// 全局变量：跟踪配置面板实例
let configPanelInstance: ConfigPanel | null = null;
let configPanelDisposable: vscode.Disposable | null = null;

// 全局变量：ChatViewProvider 实例（用于跨视图通信）
let chatViewProviderInstance: ChatViewProvider | null = null;

/**
 * 获取 ChatViewProvider 实例
 */
export function getChatViewProvider(): ChatViewProvider | null {
  return chatViewProviderInstance;
}

export function activate(context: vscode.ExtensionContext) {
  // 初始化日志系统
  Logger.initialize();
  Logger.info("AI Agent LeoBot 正在激活...");

  // 使用独立的 ModelConfigManager 管理模型配置
  const modelConfigManager = ModelConfigManager.getInstance();
  modelConfigManager.setContext(context);

  // 使用独立的 AgentConfigManager 管理 Agent 配置
  const agentConfigManager = AgentConfigManager.getInstance();
  agentConfigManager.setContext(context);

  // 初始化 GlobalConfigManager 管理全局运行时配置
  const globalConfigManager = GlobalConfigManager.getInstance();
  globalConfigManager.setContext(context);

  // 检查并执行配置迁移
  const path = require("path");
  const modelConfigPath = path.join(context.globalStorageUri.fsPath, "modelConfig.json");
  const globalConfigPath = path.join(context.globalStorageUri.fsPath, "globalConfig.json");

  if (ConfigMigrationTool.needsMigration(modelConfigPath)) {
    Logger.info("检测到旧配置格式，开始迁移...");
    ConfigMigrationTool.migrate(modelConfigPath, globalConfigPath).then((success) => {
      if (success) {
        Logger.success("配置迁移成功！");
      } else {
        Logger.error("配置迁移失败，请手动处理");
      }
    });
  }

  // 保留 ConfigManager 用于其他配置（如果需要）
  const configManager = ConfigManager.getInstance();
  configManager.setContext(context);

  // 初始化工具注册表
  const toolRegistry = ToolRegistry.getInstance();
  toolRegistry.registerMCPTools(mcpServer.getTools());
  toolRegistry.registerSkills(SkillManager.getInstance().getSkills());
  Logger.info("工具注册表已初始化", {
    mcpTools: mcpServer.getTools().length,
    skills: SkillManager.getInstance().getSkills().length,
  });

  // 初始化 Agent 管理器
  agentManager.setAgentConfigManager(agentConfigManager);

  // 初始化聊天记录管理器
  chatHistoryManager.setContext(context);

  const skillManager = SkillManager.getInstance();
  chatViewProviderInstance = new ChatViewProvider(context.extensionPath, modelConfigManager);

  // 注册 Webview 提供者
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      // ChatViewProvider.viewType,
      "ai-agent-leobot-chat",
      chatViewProviderInstance
    )
  );

  // 注册聊天命令
  context.subscriptions.push(
    vscode.commands.registerCommand("ai-agent-leobot.chat", async () => {
      await vscode.commands.executeCommand("ai-agent-leobot-chat.focus");
    })
  );

  // 注册配置命令
  context.subscriptions.push(
    vscode.commands.registerCommand("ai-agent-leobot.configure", async () => {
      await createConfigPanel(context, modelConfigManager, agentConfigManager);
    })
  );

  // 注册代码解释命令
  context.subscriptions.push(
    vscode.commands.registerCommand("ai-agent-leobot.explain", async () => {
      await handleCodeExplanation();
    })
  );

  // 注册代码优化命令
  context.subscriptions.push(
    vscode.commands.registerCommand("ai-agent-leobot.optimize", async () => {
      await handleCodeOptimization();
    })
  );

  // 注册清除聊天命令
  context.subscriptions.push(
    vscode.commands.registerCommand("ai-agent-leobot.clearChat", () => {
      if (chatViewProviderInstance) {
        chatViewProviderInstance.clearChat();
      }
    })
  );

  // 注册刷新聊天视图命令
  context.subscriptions.push(
    vscode.commands.registerCommand("ai-agent-leobot.refreshChatView", () => {
      if (chatViewProviderInstance) {
        chatViewProviderInstance.refresh();
      }
    })
  );

  Logger.success("所有命令已注册，扩展准备就绪");
}

export function deactivate() {
  // 清理事件监听器
  agentManager.dispose();
  Logger.info("AI Agent LeoBot 已停用");
}

/**
 * 创建配置面板
 */
async function createConfigPanel(
  context: vscode.ExtensionContext,
  modelConfigManager: ModelConfigManager,
  agentConfigManager: AgentConfigManager
) {
  Logger.config("创建配置面板");

  // 检查是否已存在配置面板
  if (configPanelInstance) {
    Logger.config("配置面板已存在，将重用现有实例");
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "leoConfig",
    "AI Agent LeoBot 配置",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(context.extensionPath)],
    }
  );

  configPanelInstance = new ConfigPanel(panel, modelConfigManager, agentConfigManager, context);
  configPanelInstance.loadConfig();

  // 监听面板关闭事件
  configPanelDisposable = panel.onDidDispose(
    () => {
      configPanelInstance?.dispose();
      configPanelInstance = null;
      configPanelDisposable = null;
    },
    null,
    context.subscriptions
  );
}

/**
 * 处理代码解释
 */
async function handleCodeExplanation() {
  Logger.chat("请求代码解释");

  if (!chatViewProviderInstance) {
    vscode.window.showWarningMessage("聊天视图未初始化");
    return;
  }

  const skillManager = SkillManager.getInstance();
  const fileInfo = await skillManager.executeSkill("get-active-file", {});

  if (!fileInfo) {
    vscode.window.showWarningMessage("请先打开一个文件");
    return;
  }

  const selectedText = fileInfo.selectedText;

  if (!selectedText) {
    vscode.window.showWarningMessage("请先选中要解释的代码");
    return;
  }

  const prompt = `请解释下面这段代码的作用、实现逻辑和关键点：

\`\`\`${fileInfo.language}
${selectedText}
\`\`\`

请用简洁清晰的中文解释。`;

  await chatViewProviderInstance.sendMessage(prompt);
  Logger.success("代码解释请求已发送");
}

/**
 * 处理代码优化
 */
async function handleCodeOptimization() {
  Logger.chat("请求代码优化");

  if (!chatViewProviderInstance) {
    vscode.window.showWarningMessage("聊天视图未初始化");
    return;
  }

  const skillManager = SkillManager.getInstance();
  const fileInfo = await skillManager.executeSkill("get-active-file", {});

  if (!fileInfo) {
    vscode.window.showWarningMessage("请先打开一个文件");
    return;
  }

  const selectedText = fileInfo.selectedText;

  if (!selectedText) {
    vscode.window.showWarningMessage("请先选中要优化的代码");
    return;
  }

  const prompt = `请优化下面这段代码，改进其性能、可读性和最佳实践：

\`\`\`${fileInfo.language}
${selectedText}
\`\`\`

请提供：
1. 优化后的代码
2. 优化说明
3. 性能或可读性提升点`;

  await chatViewProviderInstance.sendMessage(prompt);
  Logger.success("代码优化请求已发送");
}
