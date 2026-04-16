import { requestMap, receiveMap, responseData, responseMap } from "../types/messageHub_P.js";
import * as vscode from "vscode";
import { Logger } from "./Logger.js";

/**
 * 后端消息中心 - 用于处理前端请求和发送通知
 */
export class MessageHub {
  private static instance: MessageHub;

  // 请求处理器：存储每个请求类型的处理函数
  private requestHandlers: Map<
    keyof requestMap,
    (
      data: requestMap[keyof requestMap],
      webview: vscode.Webview
    ) => Promise<responseData<keyof responseMap>>
  > = new Map();

  // 跟踪每个 webview 的消息监听器
  private webviewListeners: Map<vscode.Webview, vscode.Disposable[]> = new Map();

  // 构造函数私有化，强制使用单例
  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): MessageHub {
    if (!MessageHub.instance) {
      MessageHub.instance = new MessageHub();
    }
    return MessageHub.instance;
  }

  /**
   * 注册请求处理器
   * @param type - 请求类型
   * @param handler - 处理函数
   * @returns Promise<responseData<K>>
   */
  registerRequestHandler<K extends keyof requestMap>(
    type: K,
    handler: (data: requestMap[K]) => Promise<responseData<K>>
  ): void {
    Logger.config("[MessageHub] registerRequestHandler", { type });

    // 存储处理器
    this.requestHandlers.set(type, handler as any);
  }

  /**
   * 确保 webview 的消息监听器已注册（只注册一次）
   * 需要在每个后端 webview 初始化时手动调用
   * @param webview - 要监听的 webview
   */
  ensureWebviewListener(webview: vscode.Webview): void {
    // 如果这个 webview 还没有监听器数组，创建一个，并注册统一的消息监听器
    if (!this.webviewListeners.has(webview)) {
      Logger.config("[MessageHub] 首次注册这个 webview，设置销毁监听");
      this.webviewListeners.set(webview, []);

      // 注册统一的消息监听器（只注册一次！）
      const disposable = webview.onDidReceiveMessage((message) => {
        this.handleMessage(message, webview);
      });
      this.webviewListeners.get(webview)!.push(disposable);

      // 自动监听 webview 销毁事件，清理监听器
      const webviewAny = webview as any;
      if (webviewAny.onDidDispose) {
        webviewAny.onDidDispose(() => {
          Logger.config("[MessageHub] webview 销毁，清理监听器", { webviewId: webviewAny.id });
          this.disposeWebviewListeners(webview);
        });
      }
    } else {
      Logger.config("[MessageHub] 这个 webview 已注册过，监听器数量:", {
        count: this.webviewListeners.get(webview)!.length,
      });
    }
  }

  /**
   * 清理指定 webview 的监听器
   * @param webview - 要清理的 webview
   */
  disposeWebviewListeners(webview: vscode.Webview): void {
    const disposables = this.webviewListeners.get(webview);
    if (disposables) {
      disposables.forEach((d) => d.dispose());
      this.webviewListeners.delete(webview);
    }
  }

  /**
   * 发送通知到指定 webview
   * @param webview - 目标 webview
   * @param type - 消息类型（对应 receiveMap 中的键）
   * @param data - 消息数据
   */
  sendToWebview<K extends keyof receiveMap>(
    webview: vscode.Webview,
    type: K,
    data: receiveMap[K]
  ): void {
    webview.postMessage({ type, data });
  }

  /**
   * 处理接收到的消息（需要在 webview 的 onDidReceiveMessage 中调用）
   */
  async handleMessage(message: any, webview: vscode.Webview): Promise<void> {
    const { type, data, requestId } = message;

    // 如果是请求（有 requestId），调用对应的处理器
    if (requestId && type) {
      const handler = this.requestHandlers.get(type as keyof requestMap);

      if (handler) {
        try {
          const response = await handler(data, webview);
          webview.postMessage({ type: "response", data: response, requestId });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "未知错误";
          webview.postMessage({
            type: "response",
            data: { success: false, error: errorMessage } as responseData<keyof responseMap>,
            requestId,
          });
        }
      } else {
        // 没有对应的处理器
        webview.postMessage({
          type: "response",
          data: { success: false, error: `未找到请求处理器：${type}` } as responseData<
            keyof responseMap
          >,
          requestId,
        });
      }
      return;
    }

    // 普通消息（无 requestId），目前没有处理
    Logger.info("[MessageHub] 收到普通消息:", { type, data });
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.requestHandlers.clear();
  }
}

// 导出单例实例
export const messageHub = MessageHub.getInstance();
