import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger.js';

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
    }>;
    required?: string[];
  };
  handler: (args: any) => Promise<any>;
}

export interface MCPMessage {
  role: 'user' | 'assistant' | 'system';
  content: MCPContent[];
}

export type MCPContent = 
  | { type: 'text'; text: string }
  | { type: 'resource'; resource: { uri: string; text: string; mimeType?: string } }
  | { type: 'image'; data: string; mimeType: string };

export class MCPFileSystem {
  private workspaceRoot: string;

  constructor() {
    // 使用 VS Code 的 workspace API 获取当前打开的文件夹
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      // 获取第一个工作区文件夹
      this.workspaceRoot = workspaceFolders[0].uri.fsPath;
    } else {
      // 如果没有工作区，使用当前活动文件所在的目录
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        this.workspaceRoot = path.dirname(activeEditor.document.fileName);
      } else {
        // 最后使用用户主目录作为 fallback，而不是插件安装目录
        this.workspaceRoot = require('os').homedir();
        Logger.warn('未检测到工作区或活动文件，使用用户主目录', { path: this.workspaceRoot });
      }
    }
    Logger.debug('工作空间目录已设置', { path: this.workspaceRoot });
  }

  private resolvePath(filePath: string): string {
    const isRelative = !path.isAbsolute(filePath);
    if (isRelative) {
      const resolvedPath = path.join(this.workspaceRoot, filePath);
      Logger.debug('解析相对路径', { original: filePath, resolved: resolvedPath });
      return resolvedPath;
    }
    const resolvedPath = path.resolve(filePath);
    Logger.debug('解析绝对路径', { original: filePath, resolved: resolvedPath });
    return resolvedPath;
  }

  async readFile(filePath: string): Promise<string> {
    const resolvedPath = this.resolvePath(filePath);
    Logger.debug('读取文件', { path: resolvedPath });
    
    if (!fs.existsSync(resolvedPath)) {
      Logger.errorAndThrow(`文件不存在：${resolvedPath}`);
    }

    const stat = fs.statSync(resolvedPath);
    if (stat.isDirectory()) {
      Logger.errorAndThrow(`路径是目录而非文件：${resolvedPath}`);
    }

    return fs.readFileSync(resolvedPath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const resolvedPath = this.resolvePath(filePath);
    Logger.debug('写入文件', { path: resolvedPath });
    
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(resolvedPath, content, 'utf-8');
  }

  async listDirectory(dirPath: string): Promise<{ name: string; type: 'file' | 'directory'; size?: number }[]> {
    const resolvedPath = this.resolvePath(dirPath);
    Logger.debug('列出目录', { path: resolvedPath });

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      Logger.errorAndThrow(`路径是文件而非目录：${resolvedPath}`);
    }

    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
    const result = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(resolvedPath, entry.name);
        const stat = fs.statSync(entryPath);
        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' as const : 'file' as const,
          size: entry.isFile() ? stat.size : undefined
        };
      })
    );

    return result;
  }

  async searchFiles(pattern: string, basePath?: string): Promise<string[]> {
    const searchPath = basePath ? path.resolve(basePath) : this.workspaceRoot;
    Logger.debug('搜索文件', { path: searchPath, pattern });
    
    const results: string[] = [];
    const globPattern = new vscode.RelativePattern(searchPath, `**/${pattern}`);
    const files = await vscode.workspace.findFiles(globPattern, '**/node_modules/**');
    
    for (const file of files) {
      results.push(file.fsPath);
    }

    return results;
  }
}

export class MCPServer {
  private fileSystem: MCPFileSystem;
  private tools: Map<string, MCPTool> = new Map();

  constructor() {
    this.fileSystem = new MCPFileSystem();
    this.registerDefaultTools();
  }

  private registerDefaultTools() {
    this.registerTool({
      name: 'read_file',
      description: '读取本地文件内容',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '要读取的文件路径（相对于工作空间）'
          }
        },
        required: ['path']
      },
      handler: async (args: { path: string }) => {
        const content = await this.fileSystem.readFile(args.path);
        return {
          content: [{ type: 'text' as const, text: content }]
        };
      }
    });

    this.registerTool({
      name: 'write_file',
      description: '写入内容到本地文件',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '要写入的文件路径（相对于工作空间）'
          },
          content: {
            type: 'string',
            description: '要写入的文件内容'
          }
        },
        required: ['path', 'content']
      },
      handler: async (args: { path: string; content: string }) => {
        await this.fileSystem.writeFile(args.path, args.content);
        return {
          content: [{ type: 'text' as const, text: `文件已写入：${args.path}` }]
        };
      }
    });

    this.registerTool({
      name: 'list_directory',
      description: '列出目录内容',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '要列出的目录路径（相对于工作空间）'
          }
        },
        required: ['path']
      },
      handler: async (args: { path: string }) => {
        const entries = await this.fileSystem.listDirectory(args.path);
        const text = entries.map(e => `${e.type === 'directory' ? '📁' : '📄'} ${e.name}${e.size ? ` (${e.size} bytes)` : ''}`).join('\n');
        return {
          content: [{ type: 'text' as const, text: text || '目录为空' }]
        };
      }
    });

    this.registerTool({
      name: 'search_files',
      description: '搜索文件',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: '文件名匹配模式（支持通配符，如 *.ts）'
          },
          basePath: {
            type: 'string',
            description: '搜索的基础路径（可选，默认为工作空间根目录）'
          }
        },
        required: ['pattern']
      },
      handler: async (args: { pattern: string; basePath?: string }) => {
        const files = await this.fileSystem.searchFiles(args.pattern, args.basePath);
        const text = files.length > 0 ? files.join('\n') : '未找到匹配的文件';
        return {
          content: [{ type: 'text' as const, text: text }]
        };
      }
    });

    this.registerTool({
      name: 'insert_lines',
      description: '在文件的指定行之间插入内容（会实际修改文件）',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: '文件路径'
          },
          afterLine: {
            type: 'number',
            description: '在该行号之后插入（0 表示在文件开头插入）'
          },
          content: {
            type: 'string',
            description: '要插入的内容'
          }
        },
        required: ['filePath', 'afterLine', 'content']
      },
      handler: async (args: { filePath: string; afterLine: number; content: string }) => {
        const resolvedPath = this.fileSystem['resolvePath'](args.filePath);
        
        if (!fs.existsSync(resolvedPath)) {
          Logger.errorAndThrow(`文件不存在：${resolvedPath}`);
        }

        const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
        const lines = fileContent.split('\n');
        const totalLines = lines.length;

        if (args.afterLine < 0 || args.afterLine > totalLines) {
          Logger.errorAndThrow(`无效的行号：${args.afterLine}，文件总共有 ${totalLines} 行`);
        }

        // 在指定位置插入新行
        const newLines = [
          ...lines.slice(0, args.afterLine),
          args.content,
          ...lines.slice(args.afterLine)
        ];

        // 写回文件
        fs.writeFileSync(resolvedPath, newLines.join('\n'), 'utf-8');

        // 返回插入位置的上下文信息
        const beforeLine = args.afterLine > 0 ? lines[args.afterLine - 1].trim() : '(文件开头)';
        const afterLineText = args.afterLine < totalLines ? lines[args.afterLine].trim() : '(文件末尾)';

        return {
          content: [{ 
            type: 'text' as const, 
            text: `✅ 已成功在第 ${args.afterLine} 行后插入内容\n` +
                  `📍 插入位置：${beforeLine} | [插入点] | ${afterLineText}\n` +
                  `📝 插入内容：\n${args.content}\n` +
                  `💾 文件已保存：${resolvedPath}`
          }]
        };
      }
    });
  }

  registerTool(tool: MCPTool) {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取所有 MCP 工具（供 ToolRegistry 使用）
   */
  getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  listTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  async executeTool(name: string, args: any): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      Logger.errorAndThrow(`工具不存在：${name}`);
    }

    try {
      return await tool.handler(args);
    } catch (error: any) {
      Logger.errorAndThrow(`工具执行失败 [${name}]: ${error.message}`);
    }
  }

  getFileSystem(): MCPFileSystem {
    return this.fileSystem;
  }
}

export const mcpServer = new MCPServer();
