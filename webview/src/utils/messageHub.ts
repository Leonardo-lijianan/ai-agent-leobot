import { requestMap, receiveMap, responseData, responseMap } from "../types/messageHub_P.js";

declare function acquireVsCodeApi(): any;

/**
 * 前端消息中心 - 用于与后端 VSCode 扩展通信
 */
class MessageHub {
  private static instance: MessageHub;
  private vscode: any;
  private handlers: Map<keyof receiveMap, Set<(data: any) => void>> = new Map();
  private requestCallbacks: Map<string, (response: responseData<keyof responseMap>) => void> =
    new Map();

  private constructor() {
    // 获取 VSCode API
    this.vscode = acquireVsCodeApi();

    // 监听来自后端的响应
    window.addEventListener("message", (event) => {
      const message = event.data;
      this.handleResponse(message);
    });
  }

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
   * 发送消息到后端
   * @param type - 消息类型（对应 requestMap 中的键）
   * @param data - 消息数据
   */
  // send<K extends keyof requestMap>(type: K, data?: requestMap[K]): void {
  //   this.vscode.postMessage({ type, data });
  // }
  // 先没有必要让前端私信后端 2026/04/18

  /**
   * 监听后端发送的消息
   * @param type - 消息类型（对应 receiveMap 中的键）
   * @param handler - 处理函数
   * @returns 取消订阅函数
   */
  on<K extends keyof receiveMap>(type: K, handler: (data: receiveMap[K]) => void): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // 返回取消订阅函数
    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(type);
        }
      }
    };
  }

  /**
   * 发送请求到后端并等待响应
   * @param type - 消息类型（对应 requestMap 中的键）
   * @param data - 请求数据
   * @returns Promise<responseData<K>> 响应数据
   */
  request<K extends keyof requestMap>(type: K, data?: requestMap[K]): Promise<responseData<K>> {
    return new Promise<responseData<K>>((resolve) => {
      // 生成唯一 ID
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // 注册回调
      this.requestCallbacks.set(requestId, (response: responseData<K>) => {
        resolve(response as responseData<K>);
      });

      // 发送请求
      this.vscode.postMessage({ type, data, requestId });

      // 设置超时
      setTimeout(() => {
        const callback = this.requestCallbacks.get(requestId);
        if (callback) {
          this.requestCallbacks.delete(requestId);
          resolve({ success: false, error: `请求超时：${type}` } as responseData<K>);
        }
      }, 30000); // 30 秒超时
    });
  }

  /**
   * 处理接收到的响应
   */
  private handleResponse(message: { type: string; data?: any; requestId?: string }) {
    // 优先处理响应消息（带 requestId）
    if (message.requestId && message.type === "response") {
      const callback = this.requestCallbacks.get(message.requestId);
      if (callback) {
        callback(message.data as responseData<keyof responseMap>);
        this.requestCallbacks.delete(message.requestId);
      }
      return;
    }

    // 处理普通事件消息
    const handlers = this.handlers.get(message.type as keyof receiveMap);
    if (handlers) {
      handlers.forEach((handler) => handler(message.data));
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.handlers.clear();
  }
}

// 导出单例实例
export const messageHub = MessageHub.getInstance();
