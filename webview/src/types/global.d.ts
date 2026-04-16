// 全局类型声明 - 用于 CDN 加载的库
declare global {
  interface Window {
    markdownit: any;
    markdownitFootnote: any;
    markdownitTaskLists: any;
    DOMPurify: any;
  }
}

declare global {
  type configEnum = "global" | "model" | "agent";
  type protocolEnum = "openai" | "anthropic" | "ollama" | "gemini" | "custom";
}

export {};
