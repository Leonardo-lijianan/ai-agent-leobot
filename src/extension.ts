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
  const htmlUri = panel.webview.asWebviewUri(htmlPath);
  panel.webview.html = await getHtmlForConfigPanel(htmlUri, modelConfigManager, context);
  
  // 面板创建完成后自动加载配置
  setTimeout(() => {
    loadConfig(panel, modelConfigManager, context);
  }, 100);
  
  // 监听 Webview 消息
  panel.webview.onDidReceiveMessage(
    async (message) => {
      Logger.debug(message.type)
      switch (message.type) {
        case 'loadConfig':
          await loadConfig(panel, modelConfigManager, context);
          break;
        case 'test':
          await testConnection(panel, message);
          break;
        case 'listModels':
          await listModels(panel, message);
          break;
        case 'saveModelConfig':
          await saveConfig(panel, message, modelConfigManager, context);
          break;
        case 'addAgent':
          await addNewAgent(panel, message, agentConfigManager, context, modelConfigManager);
          break;
      }
    },
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

/**
 * 获取配置面板 HTML
 */
async function getHtmlForConfigPanel(
  htmlUri: vscode.Uri,
  modelConfigManager: ModelConfigManager,
  context: vscode.ExtensionContext
): Promise<string> {
  const fs = await import('fs');
  const path = await import('path');
  const htmlPath = path.join(context.extensionPath, 'media', 'configPanel.html');
  let html = fs.readFileSync(htmlPath, 'utf-8');
  
  // 添加时间戳防止缓存
  const timestamp = Date.now();
  html = html.replace('<script>', `<script>
    console.log('[ConfigPanel] HTML 加载时间戳：${timestamp}');
  `);
  
  return html;
}

/**
 * 加载配置
 */
async function loadConfig(
  panel: vscode.WebviewPanel,
  modelConfigManager: ModelConfigManager,
  context: vscode.ExtensionContext
) {
  try {
    Logger.config('加载配置');
    
    const models = modelConfigManager.getModels();
    const defaultModel = modelConfigManager.getDefaultModel();
    const modelConfig = models.find(m => m.name === defaultModel) || models[0];
    const currentAgent = await modelConfigManager.getCurrentAgent();
    const agents = modelConfigManager.getAllAgents();
    const agentModels = modelConfigManager.getAgentModels();
    
    // 从配置文件读取 API Key（已解密）
    const apiKey = await modelConfigManager.getApiKey(defaultModel) || '';
    
    panel.webview.postMessage({
      type: 'loadConfig',
      config: {
        configName: modelConfig?.name || '', // 配置名称
        provider: modelConfig?.type || 'siliconflow',
        endpoint: modelConfig?.endpoint || '',
        apiKey: apiKey,
        modelName: modelConfig?.modelName || '', // 模型 ID
        agent: currentAgent
      }
    });
    
    // 发送 Agent 列表
    panel.webview.postMessage({
      type: 'agentList',
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name
      }))
    });
    
    // 发送模型列表
    panel.webview.postMessage({
      type: 'modelList',
      models: models.map(model => ({
        name: model.name,
        type: model.type,
        endpoint: model.endpoint,
        modelName: model.modelName
      }))
    });
    
    // 发送 Agent-模型关联
    panel.webview.postMessage({
      type: 'agentModelList',
      agentModels: agentModels
    });
    
    Logger.success('配置加载成功');
  } catch (error: any) {
    Logger.error('加载配置失败', error);
  }
}

/**
 * 测试连接
 */
async function testConnection(panel: vscode.WebviewPanel, message: any) {
  try {
    const providerType = message.provider === 'gemini' ? 'gemini' : 'openai';
    const apiKey = message.apiKey || '';
    const endpoint = message.endpoint || '';
    const model = message.modelName || '';
    
    Logger.info('[API] 测试连接', { 
      provider: message.provider,
      type: providerType,
      endpoint,
      model 
    });
    
    if (providerType === 'gemini') {
      // Gemini API 测试
      const { GoogleGenAI } = await import('@google/genai');
      const genAI = new GoogleGenAI({ apiKey });
      
      const response = await genAI.models.list();
      const models = (response as any).models || [];
      
      Logger.success('Gemini 连接测试成功', { modelsCount: models.length });
    } else {
      // OpenAI 兼容 API 测试
      const baseURL = endpoint || 'https://api.openai.com/v1';
      const testModel = model || 'deepseek-ai/DeepSeek-V3';
      
      Logger.debug('发送测试请求', { baseURL, model: testModel });
      
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        Logger.errorAndThrow(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      
      const data: any = await response.json();
      Logger.debug('测试响应', { 
        hasChoices: !!data.choices,
        content: data.choices?.[0]?.message?.content?.substring(0, 50)
      });
    }
    
    panel.webview.postMessage({
      type: 'testResult',
      success: true
    });
    
    Logger.success('连接测试成功');
  } catch (error: any) {
    Logger.error('连接测试失败', error);
    panel.webview.postMessage({
      type: 'testResult',
      success: false,
      error: error.message || '连接失败'
    });
  }
}

/**
 * 获取模型列表
 */
async function listModels(panel: vscode.WebviewPanel, message: any) {
  try {
    const providerType = message.providerType || 'openai';
    const apiKey = message.apiKey || '';
    const endpoint = message.endpoint || '';
    
    Logger.info('[API] 获取模型列表', { providerType, endpoint });
    
    if (providerType === 'gemini') {
      await listGeminiModels(panel, apiKey);
    } else {
      await listOpenAICompatibleModels(panel, apiKey, endpoint);
    }
  } catch (error: any) {
    Logger.error('获取模型列表失败', error);
    panel.webview.postMessage({
      type: 'listModelsResult',
      success: false,
      error: error.message || '获取模型列表失败'
    });
  }
}

/**
 * 获取 Gemini 模型列表
 */
async function listGeminiModels(panel: vscode.WebviewPanel, apiKey: string) {
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new GoogleGenAI({ apiKey });
    
    const response = await genAI.models.list();
    const models = (response as any).models || [];
    const generateModels = models.filter((model: any) => 
      model.supportedGenerationMethods?.includes('generateContent')
    );
    
    const top5 = generateModels.slice(0, 5);
    const modelList = top5.map((m: any) => m.name.replace('models/', '')).join('\n');
    
    Logger.success(`找到 ${top5.length} 个可用模型`);
    
    panel.webview.postMessage({
      type: 'listModelsResult',
      success: true,
      models: modelList || '没有找到支持 generateContent 的模型'
    });
  } catch (error: any) {
    const errorMsg = error.message || '';
    
    // Gemini 特有的错误处理
    if (errorMsg.includes('User location is not supported') || errorMsg.includes('FAILED_PRECONDITION')) {
      Logger.errorAndThrow('地理位置限制：您的所在地区无法直接访问 Google Gemini API。\n\n✅ 解决方案：使用 HTTP 代理\n\n配置方法：\n1. 确保已运行代理软件（如 Clash、Shadowsocks 等）\n2. 打开 VS Code 设置 (Ctrl+,)\n3. 搜索 "http.proxy"\n4. 输入代理地址，例如：\n   - Clash: http://127.0.0.1:7890\n   - Shadowsocks: http://127.0.0.1:10808\n   - V2Ray: http://127.0.0.1:10809\n5. 重新点击"查看可用模型"按钮\n\n💡 提示：如果没有代理，建议使用国内可访问的 API 服务（如硅基流动、OpenAI 等）');
    }
    
    throw error;
  }
}

/**
 * 获取 OpenAI 兼容 API 的模型列表（硅基流动、DeepSeek 等）
 */
async function listOpenAICompatibleModels(panel: vscode.WebviewPanel, apiKey: string, endpoint: string) {
  const baseURL = endpoint || 'https://api.openai.com/v1';
  
  Logger.info('请求模型列表', { baseURL, apiKeyLength: apiKey.length });
  
  try {
    const response = await fetch(`${baseURL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    Logger.debug('收到响应', { 
      status: response.status, 
      statusText: response.statusText,
      ok: response.ok 
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      Logger.errorAndThrow(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }
    
    const data: any = await response.json();
    Logger.debug('响应数据', { 
      hasData: !!data.data, 
      dataLength: data.data?.length,
      firstModel: data.data?.[0]?.id 
    });
    
    const models = data.data || [];
    
    // 取前 5 个模型
    const top5 = models.slice(0, 5);
    const modelList = top5.map((m: any) => m.id).join('\n');
    
    Logger.success(`找到 ${top5.length} 个可用模型`);
    
    panel.webview.postMessage({
      type: 'listModelsResult',
      success: true,
      models: modelList || '没有找到可用模型'
    });
  } catch (fetchError: any) {
    Logger.error('fetch 错误', {
      message: fetchError.message,
      name: fetchError.name,
      stack: fetchError.stack?.substring(0, 200),
      cause: fetchError.cause
    });
    Logger.errorAndThrow(`网络请求失败：${fetchError.message}`);
  }
}

/**
 * 保存配置
 */
async function saveConfig(
  panel: vscode.WebviewPanel,
  message: any,
  modelConfigManager: ModelConfigManager,
  context: vscode.ExtensionContext
) {
  try {
    Logger.config('保存配置', message);
    
    // 获取现有模型列表
    const models = modelConfigManager.getModels();
    Logger.config('获取现有模型', { count: models.length, models: models.map(m => m.name) });
    
    // 如果是新增模型
    if (message.isNewModel) {
      Logger.config('新增模型', { name: message.configName });
      const encryptedApiKey = await encrypt(message.apiKey, context);
      Logger.config('加密 API Key', { 
        original: message.apiKey.substring(0, 3) + '...', 
        encrypted: encryptedApiKey.substring(0, 20) + '...' 
      });
      const newModel: any = {
        name: message.configName, // 配置名称
        type: message.provider,
        endpoint: message.endpoint,
        apiKey: encryptedApiKey, // 加密后存储
        modelName: message.modelName || '' // 模型 ID
      };
      
      models.push(newModel);
      await modelConfigManager.updateModels(models);
      await modelConfigManager.setDefaultModel(message.configName);
      
      Logger.success('新增模型配置成功', { modelName: message.configName });
    } else {
      // 更新或新增模型配置
      Logger.config('更新或新增模型', { name: message.configName });
      const modelIndex = models.findIndex(m => m.name === message.configName);
      
      const encryptedApiKey = await encrypt(message.apiKey, context);
      Logger.config('加密 API Key', { 
        original: message.apiKey.substring(0, 3) + '...', 
        encrypted: encryptedApiKey.substring(0, 20) + '...' 
      });
      
      if (modelIndex !== -1) {
        // 更新现有模型
        models[modelIndex].endpoint = message.endpoint;
        models[modelIndex].apiKey = encryptedApiKey; // 加密后存储
        models[modelIndex].modelName = message.modelName || '';
        Logger.config('更新现有模型', { name: message.configName });
      } else {
        // 新增模型（配置文件中不存在）
        const newModel: any = {
          name: message.configName, // 配置名称
          type: message.provider,
          endpoint: message.endpoint,
          apiKey: encryptedApiKey, // 加密后存储
          modelName: message.modelName || ''
        };
        models.push(newModel);
        Logger.config('新增模型', { name: message.configName });
      }
      
      await modelConfigManager.updateModels(models);
      await modelConfigManager.setDefaultModel(message.configName);
      Logger.success('模型配置已保存', { modelName: message.configName });
    }
    
    // 保存 Agent 选择
    if (message.agent) {
      await modelConfigManager.setCurrentAgent(message.agent);
      agentManager.switchAgent(message.agent);
    }
    
    // 保存 Agent-模型关联
    if (message.agentModelMapping) {
      for (const [agentId, modelId] of Object.entries(message.agentModelMapping)) {
        const agent = agentManager.getAgent(agentId);
        if (agent) {
          await modelConfigManager.setAgentModel(agentId, agent.name, modelId as string);
        }
      }
    }
    
    Logger.success('配置保存成功');
    
    panel.webview.postMessage({
      type: 'saveResult',
      success: true,
      config: {
        provider: message.provider
      }
    });
  } catch (error: any) {
    Logger.error('保存配置失败', error);
    panel.webview.postMessage({
      type: 'saveResult',
      success: false,
      error: error.message || '保存失败'
    });
  }
}

/**
 * 新增 Agent
 */
async function addNewAgent(
  panel: vscode.WebviewPanel,
  message: any,
  agentConfigManager: AgentConfigManager,
  context: vscode.ExtensionContext,
  modelConfigManager: ModelConfigManager
) {
  try {
    Logger.config('新增 Agent', message.agent.id);
    
    const { agent } = message;
    
    // 验证 ID 是否已存在
    const existingAgent = agentManager.getAgent(agent.id);
    if (existingAgent) {
      Logger.errorAndThrow('Agent ID 已存在');
    }
    
    // 添加到配置文件
    await agentConfigManager.addAgent({
      id: agent.id,
      name: agent.name,
      description: agent.description || '',
      systemPrompt: agent.systemPrompt,
      tools: agent.tools || [],
      modelId: agent.modelId || ''
    });
    
    // 同步到内存中的 agentManager
    agentManager.registerAgent({
      id: agent.id,
      name: agent.name,
      description: agent.description || '',
      systemPrompt: agent.systemPrompt,
      tools: agent.tools || [],
      modelId: agent.modelId || ''
    });
    
    Logger.success('Agent 已添加', { id: agent.id, name: agent.name });
    
    panel.webview.postMessage({
      type: 'addAgentResult',
      success: true,
      agentName: agent.name
    });
    
    // 重新加载 Agent 列表
    setTimeout(async () => {
      await loadConfig(panel, modelConfigManager, context);
    }, 500);
    
  } catch (error: any) {
    Logger.error('新增 Agent 失败', error);
    panel.webview.postMessage({
      type: 'addAgentResult',
      success: false,
      error: error.message || '添加失败'
    });
  }
}

/**
 * 编辑模型配置
 */
async function editModelConfig(
  panel: vscode.WebviewPanel,
  message: any,
  modelConfigManager: ModelConfigManager,
  context: vscode.ExtensionContext
) {
  try {
    Logger.config('编辑模型配置', message.config.provider);
    
    const { config } = message;
    
    if (!config.apiKey) {
      Logger.errorAndThrow('请输入 API Key');
    }
    
    if (!config.endpoint) {
      Logger.errorAndThrow('请输入 API 端点');
    }
    
    // 获取现有模型列表
    const models = modelConfigManager.getModels();
    
    // 查找并更新现有模型，或添加新模型
    const modelIndex = models.findIndex(m => m.name === config.modelName);
    
    if (modelIndex !== -1) {
      // 更新现有模型
      models[modelIndex].endpoint = config.endpoint;
      models[modelIndex].apiKey = await encrypt(config.apiKey, context); // 加密后存储
      models[modelIndex].modelName = config.selectedModel || '';
    } else {
      // 添加新模型
      models.push({
        name: config.modelName,
        type: config.provider,
        endpoint: config.endpoint,
        apiKey: await encrypt(config.apiKey, context), // 加密后存储
        modelName: config.selectedModel || ''
      });
    }
    
    await modelConfigManager.updateModels(models);
    await modelConfigManager.setDefaultModel(config.modelName);
    
    Logger.success('模型配置已更新', { 
      provider: config.provider, 
      model: config.modelName 
    });
    
    panel.webview.postMessage({
      type: 'editModelResult',
      success: true,
      config: config
    });
    
  } catch (error: any) {
    Logger.error('编辑模型配置失败', error);
    panel.webview.postMessage({
      type: 'editModelResult',
      success: false,
      error: error.message || '更新失败'
    });
  }
}

export function deactivate() {
  Logger.info('AI Agent LeoBot 已停用');
}
