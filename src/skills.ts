import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger.js';
import { Skill } from './types.js';

export class FileReadSkill implements Skill {
  name = 'file-read';
  description = '读取文件内容';
  inputSchema: {
    type: 'object';
    properties: {
      filePath: { type: 'string'; description: '要读取的文件路径' }
    };
    required: string[];
  } = {
    type: 'object' as const,
    properties: {
      filePath: { type: 'string', description: '要读取的文件路径' }
    },
    required: ['filePath']
  };

  async execute(input: { filePath: string }): Promise<string> {
    const filePath = input.filePath;
    
    if (!filePath) {
      Logger.errorAndThrow('未提供文件路径');
    }

    if (!fs.existsSync(filePath)) {
      Logger.errorAndThrow(`文件不存在：${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  }
}

export class FileWriteSkill implements Skill {
  name = 'file-write';
  description = '写入文件内容';
  inputSchema: {
    type: 'object';
    properties: {
      filePath: { type: 'string'; description: '要写入的文件路径' };
      content: { type: 'string'; description: '要写入的内容' };
    };
    required: string[];
  } = {
    type: 'object' as const,
    properties: {
      filePath: { type: 'string', description: '要写入的文件路径' },
      content: { type: 'string', description: '要写入的内容' }
    },
    required: ['filePath', 'content']
  };

  async execute(input: { filePath: string; content: string }): Promise<void> {
    const { filePath, content } = input;
    
    if (!filePath) {
      Logger.errorAndThrow('未提供文件路径');
    }

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

export class GetActiveFileSkill implements Skill {
  name = 'get-active-file';
  description = '获取当前活动编辑器的文件信息';
  inputSchema: {
    type: 'object';
    properties: {};
    required: string[];
  } = {
    type: 'object' as const,
    properties: {},
    required: []
  };

  async execute(): Promise<{ filePath: string; content: string; language: string; selectedText: string } | null> {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
      return null;
    }

    const document = editor.document;
    const content = document.getText();
    const selection = editor.selection;
    const selectedText = selection.isEmpty ? '' : document.getText(selection);

    return {
      filePath: document.fileName,
      content,
      language: document.languageId,
      selectedText
    };
  }
}

export class SkillManager {
  private static instance: SkillManager;
  private skills: Map<string, Skill> = new Map();

  private constructor() {
    this.registerDefaultSkills();
  }

  static getInstance(): SkillManager {
    if (!SkillManager.instance) {
      SkillManager.instance = new SkillManager();
    }
    return SkillManager.instance;
  }

  private registerDefaultSkills() {
    this.register(new FileReadSkill());
    this.register(new FileWriteSkill());
    this.register(new GetActiveFileSkill());
  }

  register(skill: Skill) {
    this.skills.set(skill.name, skill);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * 获取所有 Skill（供 ToolRegistry 使用）
   */
  getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  async executeSkill(name: string, input: any): Promise<any> {
    const skill = this.get(name);
    
    if (!skill) {
      Logger.errorAndThrow(`Skill 不存在：${name}`);
    }

    return await skill.execute(input);
  }
}
