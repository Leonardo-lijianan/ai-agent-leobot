import OpenAI from 'openai';
import { ModelConfig, Message } from './types';
import { mcpServer } from './mcp';

export interface ModelAdapter {
  name: string;
  type: 'openai' | 'anthropic' | 'ollama' | 'custom';
  chat(messages: Message[], model?: string, tools?: boolean): Promise<string>;
  stream?(messages: Message[], model?: string): AsyncIterable<string>;
}

export class OpenAIAdapter implements ModelAdapter {
  name: string;
  type: 'openai' | 'anthropic' | 'ollama' | 'custom' = 'openai';
  private client: OpenAI;
  private defaultModel: string;

  constructor(config: ModelConfig) {
    this.name = config.name;
    this.defaultModel = config.model || 'deepseek-ai/DeepSeek-V3';
    
    console.log('[OpenAIAdapter] 初始化配置:', {
      name: config.name,
      type: config.type,
      endpoint: config.endpoint,
      hasApiKey: !!config.apiKey,
      apiKeyLength: config.apiKey?.length || 0,
      model: this.defaultModel
    });
    
    this.client = new OpenAI({
      apiKey: config.apiKey || '',
      baseURL: config.endpoint || 'https://api.siliconflow.cn/v1',
      dangerouslyAllowBrowser: true
    });
  }

  async chat(messages: Message[], model?: string, enableTools: boolean = true): Promise<string> {
    const TOOL_CALL_TIMEOUT = 30000; // 30 秒超时
    const MAX_TOOL_CALLS = 10; // 最多 10 个工具调用
    const MAX_RETRIES = 2; // 最多重试 2 次

    try {
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const mcpTools = mcpServer.listTools();
      console.log('🟢 [MCP] 可用的工具:', mcpTools.map(t => t.name).join(', '));
      
      const tools = enableTools ? mcpTools.map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      })) : undefined;

      console.log('🟢 [MCP] 启用工具:', enableTools);
      if (tools) {
        console.log('🟢 [MCP] 工具列表:', tools.map(t => t.function.name).join(', '));
      }

      const response = await this.client.chat.completions.create({
        model: model || this.defaultModel,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 2048,
        tools: tools
      });

      console.log('🟢 [MCP] API 响应:', {
        hasToolCalls: !!response.choices[0]?.message?.tool_calls,
        toolCallsCount: response.choices[0]?.message?.tool_calls?.length || 0,
        content: response.choices[0]?.message?.content?.substring(0, 100) + '...'
      });

      const choice = response.choices[0];
      
      if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
        const toolCalls = choice.message.tool_calls;

        // 限制工具调用总数
        if (toolCalls.length > MAX_TOOL_CALLS) {
          console.warn(`⚠️ [MCP] 工具调用数量过多 (${toolCalls.length})，只处理前 ${MAX_TOOL_CALLS} 个`);
        }

        const toolResults: any[] = [];

        for (let i = 0; i < Math.min(toolCalls.length, MAX_TOOL_CALLS); i++) {
          const toolCall = toolCalls[i];
          const toolName = toolCall.function.name;
          
          let toolArgs: any;
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch (error: any) {
            console.error(`🔴 [MCP] 解析工具参数失败 [${toolName}]:`, error);
            toolResults.push({
              role: 'tool' as const,
              content: `参数解析失败：${error.message}`,
              tool_call_id: toolCall.id
            });
            continue;
          }
          
          console.log(`🟢 [MCP] 调用工具：${toolName}`, toolArgs);
          
          // 带超时和重试的工具调用
          let result: any = null;
          let lastError: any = null;
          
          for (let retry = 0; retry <= MAX_RETRIES; retry++) {
            try {
              // 使用 Promise.race 实现超时
              result = await Promise.race([
                mcpServer.executeTool(toolName, toolArgs),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error(`工具调用超时 (${TOOL_CALL_TIMEOUT}ms)`)), TOOL_CALL_TIMEOUT)
                )
              ]);
              console.log(`🟢 [MCP] 工具 ${toolName} 执行成功`);
              break; // 成功则跳出重试循环
            } catch (error: any) {
              lastError = error;
              console.warn(`⚠️ [MCP] 工具 ${toolName} 执行失败 (尝试 ${retry + 1}/${MAX_RETRIES + 1}):`, error.message);
              
              if (retry < MAX_RETRIES) {
                // 等待一段时间后重试
                await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
              }
            }
          }

          // 添加工具执行结果
          if (result) {
            toolResults.push({
              role: 'tool' as const,
              content: result.content[0]?.text || JSON.stringify(result),
              tool_call_id: toolCall.id
            });
          } else {
            toolResults.push({
              role: 'tool' as const,
              content: `工具执行失败：${lastError?.message || '未知错误'}`,
              tool_call_id: toolCall.id
            });
            console.error(`🔴 [MCP] 工具 ${toolName} 最终执行失败:`, lastError);
          }
        }

        const finalResponse = await this.client.chat.completions.create({
          model: model || this.defaultModel,
          messages: [
            ...formattedMessages,
            choice.message,
            ...toolResults
          ],
          temperature: 0.7,
          max_tokens: 2048
        });

        return finalResponse.choices[0]?.message?.content || '工具调用完成，但没有返回内容';
      }

      return choice?.message?.content || '没有响应内容';
    } catch (error: any) {
      throw new Error(`模型调用失败：${error.message}`);
    }
  }

  async *stream(messages: Message[], model?: string): AsyncIterable<string> {
    try {
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const stream = await this.client.chat.completions.create({
        model: model || this.defaultModel,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }
    } catch (error: any) {
      throw new Error(`流式调用失败：${error.message}`);
    }
  }
}

export function createModelAdapter(config: ModelConfig): ModelAdapter {
  switch (config.type) {
    case 'openai':
    case 'custom':
      return new OpenAIAdapter(config);
    case 'anthropic':
      // TODO: 实现 Anthropic 适配器
      throw new Error('Anthropic 适配器尚未实现');
    case 'ollama':
      // TODO: 实现 Ollama 适配器
      throw new Error('Ollama 适配器尚未实现');
    default:
      return new OpenAIAdapter(config);
  }
}
