import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger.js';
import { Message } from './types.js';

const CHAT_HISTORY_DIR = 'chatHistories';

export class ChatHistoryManager {
  private static instance: ChatHistoryManager;
  private storageDir: string = '';
  private _context?: vscode.ExtensionContext;
  private _currentAgentId: string = 'default';
  private _currentModelId: string = '';
  private _chatHistory: Message[] = [];

  private constructor() {}

  static getInstance(): ChatHistoryManager {
    if (!ChatHistoryManager.instance) {
      ChatHistoryManager.instance = new ChatHistoryManager();
    }
    return ChatHistoryManager.instance;
  }

  setContext(context: vscode.ExtensionContext) {
    this._context = context;
    // 使用 VS Code 的全局存储目录
    this.storageDir = path.join(context.globalStorageUri.fsPath, CHAT_HISTORY_DIR);
    Logger.config('ChatHistoryManager 初始化', { storageDir: this.storageDir });
    
    // 确保目录存在
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    
    // 不加载默认聊天记录，等待 setCurrentContext 被调用后再加载
  }

  getContext(): vscode.ExtensionContext | undefined {
    return this._context;
  }

  /**
   * 设置当前的 Agent 和 Model
   */
  setCurrentContext(agentId: string, modelId: string): void {
    const agentChanged = agentId !== this._currentAgentId;
    const modelChanged = modelId !== this._currentModelId;
    
    this._currentAgentId = agentId;
    this._currentModelId = modelId;
    
    Logger.debug('切换聊天上下文', { 
      agentId, 
      modelId, 
      agentChanged, 
      modelChanged 
    });
    
    // 如果 Agent 或 Model 改变了，加载对应的聊天记录
    if (agentChanged || modelChanged) {
      this.loadChatHistory();
    }
  }

  /**
   * 获取当前 Agent ID
   */
  getCurrentAgentId(): string {
    return this._currentAgentId;
  }

  /**
   * 获取当前 Model ID
   */
  getCurrentModelId(): string {
    return this._currentModelId;
  }

  /**
   * 获取聊天记录文件路径
   */
  /**
   * 验证 ID 安全性并返回安全的文件名
   * @param id 待验证的 ID（agentId 或 modelId）
   * @param fieldName 字段名称，用于错误提示（'agentId' 或 'modelId'）
   * @returns 经过 basename 处理的安全 ID
   */
  private validateFileName(id: string, fieldName: string): string {
    // 1. 检查空值
    if (!id) {
      throw new Error(`${fieldName} is empty. Please call setCurrentContext() first.`);
    }
    
    // 2. 禁止路径分隔符（防止路径遍历）
    if (id.includes('/') || id.includes('\\') || id.includes('..')) {
      throw new Error(`Invalid ${fieldName}: ${id}. Contains path separators.`);
    }
    
    // 3. 禁止空字符和控制字符（ASCII 0-31）
    const controlCharRegex = /[\x00-\x1f]/;
    if (controlCharRegex.test(id)) {
      throw new Error(`Invalid ${fieldName}: Contains control characters.`);
    }
    
    // 4. 使用 path.basename 提取纯文件名（跨平台安全）
    const safeId = path.basename(id);
    
    // 5. 验证 basename 后的结果不包含 Windows 禁止字符
    // Windows 禁止：\ / : * ? " < > |
    const windowsInvalidChars = /[\\/:*?"<>|]/;
    if (windowsInvalidChars.test(safeId)) {
      throw new Error(`Invalid ${fieldName}: ${safeId}. Contains invalid characters for Windows.`);
    }
    
    // 6. 检查 Windows 保留文件名
    // CON, PRN, AUX, NUL, COM1-9, LPT1-9
    const windowsReservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
    if (windowsReservedNames.test(safeId)) {
      throw new Error(`Invalid ${fieldName}: ${safeId}. Windows reserved name.`);
    }
    
    return safeId;
  }

  private getHistoryFilePath(): string {
    // 按 Agent 和 Model 分离聊天记录
    // 文件名格式：{agentId}_{modelId}.json
    
    // 验证并获取安全的 agentId 和 modelId
    const safeAgentId = this.validateFileName(this._currentAgentId, 'agentId');
    const safeModelId = this.validateFileName(this._currentModelId, 'modelId');
    
    // 检查文件名长度（Windows 最大 255 字符）
    const fileName = `${safeAgentId}_${safeModelId}.json`;
    if (fileName.length > 255) {
      throw new Error(`Filename too long: ${fileName.length} characters (max 255).`);
    }
    
    return path.join(this.storageDir, fileName);
  }

  /**
   * 加载聊天记录
   */
  private loadChatHistory(): void {
    // 如果 modelId 为空，不加载聊天记录
    if (!this._currentModelId) {
      this._chatHistory = [];
      return;
    }
    
    const filePath = this.getHistoryFilePath();
    
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        this._chatHistory = JSON.parse(content);
        Logger.info('加载聊天记录', { 
          path: filePath,
          messageCount: this._chatHistory.length 
        });
      } else {
        this._chatHistory = [];
        Logger.debug('聊天记录文件不存在，创建空历史记录', { path: filePath });
      }
    } catch (error: any) {
      Logger.error('加载聊天记录失败', { path: filePath, error: error.message });
      this._chatHistory = [];
    }
  }

  /**
   * 保存聊天记录
   */
  private saveChatHistory(): void {
    // 如果 modelId 为空，不保存聊天记录
    if (!this._currentModelId) {
      return;
    }
    
    const filePath = this.getHistoryFilePath();
    
    try {
      const configDir = path.dirname(filePath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(filePath, JSON.stringify(this._chatHistory, null, 2), 'utf-8');
      Logger.debug('保存聊天记录', { 
        path: filePath,
        messageCount: this._chatHistory.length 
      });
    } catch (error: any) {
      Logger.error('保存聊天记录失败', { path: filePath, error: error.message });
    }
  }

  /**
   * 获取所有聊天记录
   */
  getHistory(): Message[] {
    return [...this._chatHistory];
  }

  /**
   * 添加消息
   */
  addMessage(message: Message): void {
    this._chatHistory.push(message);
    this.saveChatHistory();
  }

  /**
   * 添加多条消息
   */
  addMessages(messages: Message[]): void {
    this._chatHistory.push(...messages);
    this.saveChatHistory();
  }

  /**
   * 清空聊天记录
   */
  clearHistory(): void {
    this._chatHistory = [];
    this.saveChatHistory();
    Logger.info('清空聊天记录', { path: this.getHistoryFilePath() });
  }

  /**
   * 获取最后 N 条消息
   */
  getLastMessages(count: number): Message[] {
    return this._chatHistory.slice(-count);
  }

  /**
   * 删除最后一条消息
   */
  removeLastMessage(): void {
    if (this._chatHistory.length > 0) {
      this._chatHistory.pop();
      this.saveChatHistory();
      Logger.debug('删除最后一条消息', { path: this.getHistoryFilePath() });
    }
  }

  /**
   * 列出所有聊天记录文件
   */
  listAllHistories(): { agentId: string; modelId: string; messageCount: number }[] {
    try {
      if (!fs.existsSync(this.storageDir)) {
        return [];
      }

      const files = fs.readdirSync(this.storageDir);
      const histories: { agentId: string; modelId: string; messageCount: number }[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const fileName = file.replace('.json', '');
          const parts = fileName.split('_');
          if (parts.length >= 2) {
            const agentId = parts[0];
            const modelId = parts.slice(1).join('_'); // 支持 modelId 中包含下划线
            
            try {
              const filePath = path.join(this.storageDir, file);
              const content = fs.readFileSync(filePath, 'utf-8');
              const messages = JSON.parse(content);
              histories.push({
                agentId,
                modelId,
                messageCount: messages.length
              });
            } catch (error: any) {
              Logger.error('读取聊天记录失败', { file, error: error.message });
            }
          }
        }
      }

      return histories;
    } catch (error: any) {
      Logger.error('列出聊天记录失败', error);
      return [];
    }
  }

  /**
   * 删除指定 Agent 和 Model 的聊天记录
   */
  deleteHistory(agentId: string, modelId: string): void {
    const fileName = `${agentId}_${modelId}.json`;
    const filePath = path.join(this.storageDir, fileName);
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        Logger.info('删除聊天记录', { path: filePath });
      }
    } catch (error: any) {
      Logger.error('删除聊天记录失败', { path: filePath, error: error.message });
    }
  }
}

export const chatHistoryManager = ChatHistoryManager.getInstance();
