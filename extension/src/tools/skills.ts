import * as vscode from "vscode";
import { Logger } from "../utils/Logger.js";
import { Skill } from "../types/shared_T.js";

/**
 * 获取当前活动编辑器文件信息的 Skill
 *
 * 注意：这是 VS Code 特定的功能，MCP 工具无法替代
 * MCP 工具提供通用的文件操作（read_file, write_file 等）
 * 但无法访问 VS Code 的编辑器状态
 */
export class GetActiveFileSkill implements Skill {
  name = "get-active-file";
  description = "获取当前活动编辑器的文件信息";
  inputSchema: {
    type: "object";
    properties: {};
    required: string[];
  } = {
    type: "object" as const,
    properties: {},
    required: [],
  };

  async execute(): Promise<{
    filePath: string;
    content: string;
    language: string;
    selectedText: string;
  } | null> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      return null;
    }

    const document = editor.document;
    const content = document.getText();
    const selection = editor.selection;
    const selectedText = selection.isEmpty ? "" : document.getText(selection);

    return {
      filePath: document.fileName,
      content,
      language: document.languageId,
      selectedText,
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
    // 只注册 VS Code 特定的 Skill
    // 文件操作功能已由 MCP 工具提供（read_file, write_file 等）
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
