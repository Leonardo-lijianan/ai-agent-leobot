import { ModelConfig, ModelAdapter } from "../types.js";
import { Logger } from "../utils/Logger.js";
import { GeminiAdapter } from "./GeminiAdapter.js";
import { OpenAIAdapter } from "./OpenAIAdapter.js";

export function createModelAdapter(config: ModelConfig): ModelAdapter {
  switch (config.protocolType) {
    case "openai":
      return new OpenAIAdapter(config);
    case "custom":
      return new OpenAIAdapter(config);
    case "gemini":
      return new GeminiAdapter(config);
    case "anthropic":
      // TODO: 实现 Anthropic 适配器
      Logger.errorAndThrow("Anthropic 适配器尚未实现");
    case "ollama":
      // TODO: 实现 Ollama 适配器
      Logger.errorAndThrow("Ollama 适配器尚未实现");
    default:
      return new OpenAIAdapter(config);
  }
}
