import * as vscode from 'vscode';
import { ChatViewProvider } from './chatView.js';
import { ConfigManager } from './configManager.js';
import { ModelConfigManager } from './modelConfigManager.js';
import { AgentConfigManager } from './agentConfigManager.js';
import { SkillManager } from './skills.js';
import { createModelAdapter } from './modelAdapter.js';
import { Logger } from './logger.js';
import { agentManager } from './agentManager.js';
import { ToolRegistry } from './toolRegistry.js';
import { mcpServer } from './mcp.js';
import { encrypt, decrypt, removeEncryptionKey } from './crypto.js';
import { ConfigPanel } from './configPanel.js';
import { chatHistoryManager } from './chatHistoryManager.js';

export function activate(context: vscode.ExtensionContext) {
  // 初始化日志系统
  Logger.initialize();
  Logger.info('AI Agent LeoBot 正在激活...');

  // 使用独立的 ModelConfigManager 管理模型配置
  const modelConfigManager = ModelConfigManager.getInstance();
  modelConfigManager.setContext(context);
  
  // 使用独立的 AgentConfigManager 管理 Agent 配置
  const agentConfigManager = AgentConfigManager.getInstance();
  agentConfigManager.setContext(context);
  
  // 保留 ConfigManager 用于其他配置（如果需要）
  const configManager = ConfigManager.getInstance();
  configManager.setContext(context);
  
  // 初始化工具注册表
  const toolRegistry = ToolRegistry.getInstance();
  toolRegistry.registerMCPTools(mcpServer.getTools());
  toolRegistry.registerSkills(SkillManager.getInstance().getSkills());
  Logger.info('工具注册表已初始化', { 
    mcpTools: mcpServer.getTools().length,
    skills: SkillManager.getInstance().getSkills().length
  });
  
  // 初始化 Agent 管理器
  agentManager.setAgentConfigManager(agentConfigManager);
  
  // 初始化聊天记录管理器
  chatHistoryManager.setContext(context);
  
  const skillManager = SkillManager.getInstance();
  const chatViewProvider = new ChatViewProvider(context.extensionPath, modelConfigManager);

  // 注册 Webview 提供者
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatViewProvider
    )
  );

  // 注册聊天命令
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-agent-leobot.chat', async () => {
      await vscode.commands.executeCommand('ai-agent-leobot-chat.focus');
    })
  );

  // 注册配置命令
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-agent-leobot.configure', async () => {
      await createConfigPanel(context, modelConfigManager, agentConfigManager);
    })
  );

  // 注册代码解释命令
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-agent-leobot.explain', async () => {
      await handleCodeExplanation(chatViewProvider, skillManager);
    })
  );

  // 注册代码优化命令
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-agent-leobot.optimize', async () => {
      await handleCodeOptimization(chatViewProvider, skillManager);
    })
  );

  // 注册清除聊天命令
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-agent-leobot.clearChat', () => {
      chatViewProvider.clearChat();
    })
  );

  // 注册刷新聊天视图命令
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-agent-leobot.refreshChatView', () => {
      // 触发聊天视图重新初始化
      chatViewProvider.refresh();
    })
  );

  Logger.success('所有命令已注册，扩展准备就绪');
}

/**
 * 创建配置面板
 */
async function createConfigPanel(
  context: vscode.ExtensionContext,
  modelConfigManager: ModelConfigManager,
  agentConfigManager: AgentConfigManager
) {
  Logger.config('创建配置面板');
  
  const panel = vscode.window.createWebviewPanel(
    'leoConfig',
    'AI Agent LeoBot 配置',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(context.extensionPath)]
    }
  );
  
  const path = await import('path');
  const htmlPath = vscode.Uri.file(
    path.join(context.extensionPath, 'media', 'configPanel.html')
  );
  
  const configPanel = new ConfigPanel(panel, modelConfigManager, agentConfigManager, context, htmlPath);
  configPanel.loadConfig();
  
  panel.onDidDispose(
    () => {
      configPanel.dispose();
    },
    null,
    context.subscriptions
  );
}

/**
 * 处理代码解释
 */
async function handleCodeExplanation(
  chatViewProvider: ChatViewProvider,
  skillManager: SkillManager
) {
  Logger.chat('请求代码解释');
  
  const fileInfo = await skillManager.executeSkill('get-active-file', {});
  
  if (!fileInfo) {
    vscode.window.showWarningMessage('请先打开一个文件');
    return;
  }

  const selectedText = fileInfo.selectedText;
  
  if (!selectedText) {
    vscode.window.showWarningMessage('请先选中要解释的代码');
    return;
  }

  const prompt = `请解释下面这段代码的作用、实现逻辑和关键点：

\`\`\`${fileInfo.language}
${selectedText}
\`\`\`

请用简洁清晰的中文解释。`;

  await chatViewProvider.sendMessage(prompt);
  Logger.success('代码解释请求已发送');
}

/**
 * 处理代码优化
 */
async function handleCodeOptimization(
  chatViewProvider: ChatViewProvider,
  skillManager: SkillManager
) {
  Logger.chat('请求代码优化');
  
  const fileInfo = await skillManager.executeSkill('get-active-file', {});
  
  if (!fileInfo) {
    vscode.window.showWarningMessage('请先打开一个文件');
    return;
  }

  const selectedText = fileInfo.selectedText;
  
  if (!selectedText) {
    vscode.window.showWarningMessage('请先选中要优化的代码');
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

  await chatViewProvider.sendMessage(prompt);
  Logger.success('代码优化请求已发送');
}



export function deactivate() {
  Logger.info('AI Agent LeoBot 已停用');
}
