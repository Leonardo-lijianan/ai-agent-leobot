import { GoogleGenAI } from "@google/genai";
import { Logger } from "../utils/Logger";
import { Message, ModelConfig, ModelAdapter } from "../types";

export class GeminiAdapter implements ModelAdapter {
  modelId: string;
  protocolType: "gemini" = "gemini";
  private genAI: GoogleGenAI;
  private defaultModel: string;

  constructor(config: ModelConfig) {
    this.modelId = config.id;
    this.defaultModel = config.id || "gemini-1.5-pro";

    Logger.debug("Gemini 适配器初始化", {
      modelId: config.id,
      protocolType: config.protocolType,
      hasApiKey: !!config.apiKey,
      apiKeyLength: config.apiKey?.length || 0,
      model: this.defaultModel,
    });

    this.genAI = new GoogleGenAI({ apiKey: config.apiKey || "" });
  }

  async chat(messages: Message[], model?: string, enableTools: boolean = true): Promise<string> {
    try {
      const modelName = model || this.defaultModel;

      Logger.debug("Gemini 发送消息", {
        model: modelName,
        messageCount: messages.length,
      });

      // 分离 system instruction 和对话历史
      let systemInstruction = "";
      const chatHistory: { role: string; parts: { text: string }[] }[] = [];

      messages.forEach((msg, index) => {
        if (msg.role === "system") {
          systemInstruction += msg.content + "\n";
        } else {
          const geminiRole = msg.role === "user" ? "user" : "model";
          chatHistory.push({
            role: geminiRole,
            parts: [{ text: msg.content }],
          });
        }
      });

      // 获取最后一条用户消息
      const lastUserMessage = chatHistory.filter((m) => m.role === "user").pop();
      if (!lastUserMessage) {
        return "没有用户消息";
      }

      // 新版 API：直接调用 generateContent
      const response = await this.genAI.models.generateContent({
        model: modelName,
        contents: lastUserMessage.parts[0].text,
        config: {
          systemInstruction: systemInstruction || undefined,
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      });

      const text = response.text || "";
      Logger.debug("Gemini 响应", { text: text.substring(0, 100) + "..." });

      return text;
    } catch (error: any) {
      Logger.error("Gemini 调用失败", error);
      Logger.errorAndThrow(`Gemini API 调用失败：${error.message}`);
    }
  }
}
