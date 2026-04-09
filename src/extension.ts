import * as vscode from 'vscode';
import { ChatViewProvider } from './chatView';
import { ConfigManager } from './configManager';
import { SkillManager } from './skills';
import { createModelAdapter } from './modelAdapter';

export function activate(context: vscode.ExtensionContext) {
  console.log('AI Agent LeoBot 已激活！');

  const configManager = ConfigManager.getInstance();
  const skillManager = SkillManager.getInstance();

  const chatViewProvider = new ChatViewProvider(context.extensionPath, configManager);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatViewProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ai-agent-leobot.chat', async () => {
      await vscode.commands.executeCommand('ai-agent-leobot-chat.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ai-agent-leobot.configure', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'aiAgentLeoBot');
      
      const action = await vscode.window.showInformationMessage(
        '请在设置中配置你的 API Key',
        '打开设置',
        '稍后'
      );

      if (action === '打开设置') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'aiAgentLeoBot.models');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ai-agent-leobot.explain', async () => {
      await handleCodeExplanation(chatViewProvider, skillManager);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ai-agent-leobot.optimize', async () => {
      await handleCodeOptimization(chatViewProvider, skillManager);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ai-agent-leobot.clearChat', () => {
      chatViewProvider.clearChat();
    })
  );

  console.log('✅ 所有命令已注册，扩展准备就绪');
}

async function handleCodeExplanation(
  chatViewProvider: ChatViewProvider,
  skillManager: SkillManager
) {
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
}

async function handleCodeOptimization(
  chatViewProvider: ChatViewProvider,
  skillManager: SkillManager
) {
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
}

export function deactivate() {
  console.log('AI Agent LeoBot 已停用');
}
