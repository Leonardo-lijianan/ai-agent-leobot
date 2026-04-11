/**
 * 统一的日志工具类
 * 使用 VS Code OutputChannel 提供结构化的日志输出
 */
import * as vscode from 'vscode';

export class Logger {
  private static outputChannel: vscode.LogOutputChannel;
  private static prefix = '[LeoBot]';

  /**
   * 初始化 OutputChannel
   */
  static initialize() {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('LeoBot', { log: true });
    }
  }

  /**
   * 显示输出面板
   */
  static show() {
    this.outputChannel?.show();
  }

  /**
   * 隐藏输出面板
   */
  static hide() {
    this.outputChannel?.hide();
  }

  /**
   * 清空输出
   */
  static clear() {
    this.outputChannel?.clear();
  }

  /**
   * 信息日志
   */
  static info(message: string, data?: any) {
    if (data !== undefined) {
      this.outputChannel?.info(`${this.prefix} ${message}`, data);
    } else {
      this.outputChannel?.info(`${this.prefix} ${message}`);
    }
  }

  /**
   * 成功日志
   */
  static success(message: string, data?: any) {
    if (data !== undefined) {
      this.outputChannel?.info(`${this.prefix} [SUCCESS] ${message}`, data);
    } else {
      this.outputChannel?.info(`${this.prefix} [SUCCESS] ${message}`);
    }
  }

  /**
   * 错误日志
   */
  static error(message: string, error?: any) {
    this.outputChannel?.error(`${this.prefix} ${message}`, error);
  }

  /**
   * 错误日志并抛出异常
   */
  static errorAndThrow(message: string, error?: any): never {
    this.outputChannel?.error(`${this.prefix} ${message}`, error);
    throw new Error(message);
  }

  /**
   * 警告日志
   */
  static warn(message: string, data?: any) {
    if (data !== undefined) {
      this.outputChannel?.warn(`${this.prefix} ${message}`, data);
    } else {
      this.outputChannel?.warn(`${this.prefix} ${message}`);
    }
  }

  /**
   * 调试日志
   */
  static debug(message: string, data?: any) {
    if (data !== undefined) {
      this.outputChannel?.debug(`${this.prefix} ${message}`, data);
    } else {
      this.outputChannel?.debug(`${this.prefix} ${message}`);
    }
  }

  /**
   * API 相关日志
   */
  static api(action: string, provider: string, data?: any) {
    if (data !== undefined) {
      this.outputChannel?.info(`${this.prefix} [API:${provider}] ${action}`, data);
    } else {
      this.outputChannel?.info(`${this.prefix} [API:${provider}] ${action}`);
    }
  }

  /**
   * 配置相关日志
   */
  static config(action: string, data?: any) {
    if (data !== undefined) {
      this.outputChannel?.info(`${this.prefix} [CONFIG] ${action}`, data);
    } else {
      this.outputChannel?.info(`${this.prefix} [CONFIG] ${action}`);
    }
  }

  /**
   * 聊天相关日志
   */
  static chat(action: string, data?: any) {
    if (data !== undefined) {
      this.outputChannel?.info(`${this.prefix} [CHAT] ${action}`, data);
    } else {
      this.outputChannel?.info(`${this.prefix} [CHAT] ${action}`);
    }
  }
}
