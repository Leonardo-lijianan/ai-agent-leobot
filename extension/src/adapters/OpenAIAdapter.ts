import { Message, ModelConfig, ModelAdapter } from "../types";
import { Logger } from "../utils/Logger";
import { ToolRegistry } from "../tools/ToolRegistry.js";

import { OpenAI } from "openai";

export class OpenAIAdapter implements ModelAdapter {
  modelId: string;
  protocolType: "openai" | "anthropic" | "ollama" | "custom" = "openai";
  private client: OpenAI;
  private defaultModel: string;
  private toolRegistry: ToolRegistry;

  constructor(config: ModelConfig) {
    this.modelId = config.id;
    // 使用 modelId（真正的模型名称）而不是 id（配置的别名）
    this.defaultModel = config.modelId || config.id || "Qwen/Qwen3.5-122B-A10B";
    this.toolRegistry = ToolRegistry.getInstance();

    Logger.debug("OpenAI 适配器初始化", {
      modelId: config.id,
      protocolType: config.protocolType,
      endpoint: config.endpoint,
      hasApiKey: !!config.apiKey,
      apiKeyLength: config.apiKey?.length || 0,
      model: this.defaultModel,
    });

    this.client = new OpenAI({
      apiKey: config.apiKey || "",
      baseURL: config.endpoint || "https://api.siliconflow.cn/v1",
      dangerouslyAllowBrowser: false, // 必须是false!!!
    });
  }

  async chat(messages: Message[], model?: string, enableTools: boolean = true): Promise<string> {
    const TOOL_CALL_TIMEOUT = 30000; // 30 秒超时
    const MAX_TOOL_CALLS = 10; // 最多 10 个工具调用
    const MAX_RETRIES = 2; // 最多重试 2 次
    const MAX_ITERATIONS = 5; // 防止无限循环：最多 5 次工具调用循环
    let iterationCount = 0; // 当前循环次数

    try {
      const formattedMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      while (iterationCount < MAX_ITERATIONS) {
        iterationCount++;
        Logger.debug(`第 ${iterationCount} 次迭代`);

        // 从 ToolRegistry 获取所有工具
        const allTools = this.toolRegistry.listTools();
        Logger.debug("可用的工具", {
          tools: allTools.map((t) => `${t.name}(${t.source})`).join(", "),
          mcpCount: allTools.filter((t) => t.source === "mcp").length,
          skillCount: allTools.filter((t) => t.source === "skill").length,
        });

        const tools = enableTools
          ? allTools.map((tool) => ({
              type: "function" as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
              },
            }))
          : undefined;

        Logger.debug("启用工具", { enabled: enableTools });
        if (tools) {
          Logger.debug("工具列表", { tools: tools.map((t) => t.function.name).join(", ") });
        }

        // 准备请求参数
        const requestBody: any = {
          model: model || this.defaultModel,
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 2048,
        };

        if (tools) {
          requestBody.tools = tools;
        }

        Logger.debug("API 请求参数", {
          model: model || this.defaultModel,
          hasTools: !!tools,
          toolsCount: tools?.length || 0,
          messagesCount: formattedMessages.length,
          requestBodySize: JSON.stringify(requestBody).length,
        });

        // 打印完整的请求体 JSON（用于调试 400 错误）
        Logger.debug("=== 完整的请求体 JSON ===\n" + JSON.stringify(requestBody, null, 2));

        const response = await this.client.chat.completions.create(requestBody);

        Logger.debug("API 响应", {
          hasToolCalls: !!response.choices[0]?.message?.tool_calls,
          toolCallsCount: response.choices[0]?.message?.tool_calls?.length || 0,
          content: response.choices[0]?.message?.content?.substring(0, 100) + "...",
        });

        const choice = response.choices[0];

        // 如果没有工具调用，直接返回
        if (!choice?.message?.tool_calls || choice.message.tool_calls.length === 0) {
          Logger.debug("没有工具调用，返回最终结果");
          return choice?.message?.content || "没有响应内容";
        }

        // 有工具调用，执行工具
        const toolCalls = choice.message.tool_calls;
        Logger.debug(`需要执行 ${toolCalls.length} 个工具调用`);

        // 限制工具调用总数
        if (toolCalls.length > MAX_TOOL_CALLS) {
          Logger.warn(`工具调用数量过多 (${toolCalls.length})，只处理前 ${MAX_TOOL_CALLS} 个`);
        }

        const toolResults: any[] = [];

        for (let i = 0; i < Math.min(toolCalls.length, MAX_TOOL_CALLS); i++) {
          const toolCall = toolCalls[i];
          const toolName = toolCall.function.name;

          let toolArgs: any;
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch (error: any) {
            Logger.error(`解析工具参数失败 [${toolName}]`, error);
            toolResults.push({
              role: "tool" as const,
              content: `参数解析失败：${error.message}`,
              tool_call_id: toolCall.id,
            });
            continue;
          }

          Logger.debug(`调用工具：${toolName}`, toolArgs);

          // 带超时和重试的工具调用
          let result: any = null;
          let lastError: any = null;

          for (let retry = 0; retry <= MAX_RETRIES; retry++) {
            try {
              // 使用 Promise.race 实现超时
              result = await Promise.race([
                this.toolRegistry.executeTool(toolName, toolArgs),
                new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error(`工具调用超时 (${TOOL_CALL_TIMEOUT}ms)`)),
                    TOOL_CALL_TIMEOUT
                  )
                ),
              ]);
              Logger.debug(`工具 ${toolName} 执行成功`);
              break; // 成功则跳出重试循环
            } catch (error: any) {
              lastError = error;
              Logger.warn(`工具 ${toolName} 执行失败 (尝试 ${retry + 1}/${MAX_RETRIES + 1})`, {
                error: error.message,
              });

              if (retry < MAX_RETRIES) {
                // 等待一段时间后重试
                await new Promise((resolve) => setTimeout(resolve, 1000 * (retry + 1)));
              }
            }
          }

          // 添加工具执行结果
          if (result) {
            toolResults.push({
              role: "tool" as const,
              content: result.content?.[0]?.text || JSON.stringify(result),
              tool_call_id: toolCall.id,
            });
          } else {
            toolResults.push({
              role: "tool" as const,
              content: `工具执行失败：${lastError?.message || "未知错误"}`,
              tool_call_id: toolCall.id,
            });
            Logger.error(`工具 ${toolName} 最终执行失败`, lastError);
          }
        }

        // 将工具结果添加到消息历史中
        if (choice.message.content) {
          formattedMessages.push({
            role: choice.message.role,
            content: choice.message.content,
          });
        }
        formattedMessages.push(...toolResults);

        Logger.debug("工具执行完成，准备进行下一次迭代");
      }

      Logger.warn("达到最大迭代次数，返回当前结果");
      return "已达到最大工具调用次数限制，请继续提问或重新描述需求";
    } catch (error: any) {
      Logger.error("模型调用失败", {
        message: error.message,
        status: error.status,
        statusCode: error.statusCode,
        response: error.response,
        error: error.error,
        stack: error.stack,
      });

      // 尝试提取更详细的错误信息
      let errorMessage = error.message || "未知错误";

      if (error.response) {
        errorMessage = `API 响应错误：${JSON.stringify(error.response)}`;
      } else if (error.status) {
        errorMessage = `HTTP ${error.status}: ${errorMessage}`;
      } else if (error.statusCode) {
        errorMessage = `HTTP ${error.statusCode}: ${errorMessage}`;
      }

      Logger.errorAndThrow(`模型调用失败：${errorMessage}`);
    }
  }

  async *stream(messages: Message[], model?: string): AsyncIterable<string> {
    try {
      const formattedMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const stream = await this.client.chat.completions.create({
        model: model || this.defaultModel,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          yield content;
        }
      }
    } catch (error: any) {
      Logger.errorAndThrow(`流式调用失败：${error.message}`);
    }
  }
}
