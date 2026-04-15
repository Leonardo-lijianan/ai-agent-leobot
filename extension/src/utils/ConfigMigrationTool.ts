import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './Logger.js';

/**
 * 配置迁移工具
 * 负责将旧配置文件格式迁移到新格式
 */
export class ConfigMigrationTool {
  /**
   * 检查是否需要迁移配置
   */
  static needsMigration(modelConfigPath: string): boolean {
    if (!fs.existsSync(modelConfigPath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(modelConfigPath, 'utf-8');
      const config = JSON.parse(content);
      
      // 检查是否包含需要迁移的字段
      const hasCurrentAgent = 'currentAgent' in config;
      const hasAgentModels = 'agentModels' in config;
      const hasAgentModeEnabled = 'agentModeEnabled' in config;
      
      return hasCurrentAgent || hasAgentModels || hasAgentModeEnabled;
    } catch (error: any) {
      Logger.error('检查配置迁移失败', error);
      return false;
    }
  }

  /**
   * 执行配置迁移
   * @param modelConfigPath modelConfig.json 路径
   * @param globalConfigPath globalConfig.json 路径
   * @returns 是否迁移成功
   */
  static async migrate(
    modelConfigPath: string,
    globalConfigPath: string
  ): Promise<boolean> {
    try {
      Logger.info('开始迁移配置文件...');
      
      // 读取 modelConfig.json
      if (!fs.existsSync(modelConfigPath)) {
        Logger.error('modelConfig.json 不存在，无法迁移');
        return false;
      }

      const modelConfigContent = fs.readFileSync(modelConfigPath, 'utf-8');
      const modelConfig = JSON.parse(modelConfigContent);

      // 提取需要迁移的字段
      const fieldsToMigrate: { [key: string]: any } = {};
      
      if ('currentAgent' in modelConfig) {
        fieldsToMigrate.currentAgent = modelConfig.currentAgent;
        Logger.info('迁移字段：currentAgent', { value: modelConfig.currentAgent });
      }
      
      if ('agentModels' in modelConfig) {
        fieldsToMigrate.agentModels = modelConfig.agentModels;
        Logger.info('迁移字段：agentModels', { count: modelConfig.agentModels?.length || 0 });
      }
      
      if ('agentModeEnabled' in modelConfig) {
        fieldsToMigrate.agentModeEnabled = modelConfig.agentModeEnabled;
        Logger.info('迁移字段：agentModeEnabled', { value: modelConfig.agentModeEnabled });
      }

      // 如果没有需要迁移的字段，直接返回
      if (Object.keys(fieldsToMigrate).length === 0) {
        Logger.info('没有需要迁移的字段');
        return true;
      }

      // 创建 globalConfig.json
      const globalConfigDir = path.dirname(globalConfigPath);
      if (!fs.existsSync(globalConfigDir)) {
        fs.mkdirSync(globalConfigDir, { recursive: true });
      }

      // 写入 globalConfig.json
      const globalConfig = {
        currentAgent: fieldsToMigrate.currentAgent || 'default',
        agentModels: fieldsToMigrate.agentModels || [],
        agentModeEnabled: fieldsToMigrate.agentModeEnabled !== undefined 
          ? fieldsToMigrate.agentModeEnabled 
          : true
      };

      fs.writeFileSync(globalConfigPath, JSON.stringify(globalConfig, null, 2), 'utf-8');
      Logger.info('创建 globalConfig.json', { path: globalConfigPath });

      // 从 modelConfig.json 删除已迁移的字段
      delete modelConfig.currentAgent;
      delete modelConfig.agentModels;
      delete modelConfig.agentModeEnabled;

      // 保存更新后的 modelConfig.json
      fs.writeFileSync(modelConfigPath, JSON.stringify(modelConfig, null, 2), 'utf-8');
      Logger.info('更新 modelConfig.json', { path: modelConfigPath });

      Logger.info('配置迁移完成！');
      return true;
    } catch (error: any) {
      Logger.error('配置迁移失败', error);
      return false;
    }
  }

  /**
   * 回滚配置迁移（用于测试或出错时恢复）
   * @param modelConfigPath modelConfig.json 路径
   * @param globalConfigPath globalConfig.json 路径
   * @returns 是否回滚成功
   */
  static async rollback(
    modelConfigPath: string,
    globalConfigPath: string
  ): Promise<boolean> {
    try {
      Logger.info('开始回滚配置文件...');
      
      // 读取 globalConfig.json
      if (!fs.existsSync(globalConfigPath)) {
        Logger.error('globalConfig.json 不存在，无法回滚');
        return false;
      }

      const globalConfigContent = fs.readFileSync(globalConfigPath, 'utf-8');
      const globalConfig = JSON.parse(globalConfigContent);

      // 读取 modelConfig.json
      if (!fs.existsSync(modelConfigPath)) {
        Logger.error('modelConfig.json 不存在，无法回滚');
        return false;
      }

      const modelConfigContent = fs.readFileSync(modelConfigPath, 'utf-8');
      const modelConfig = JSON.parse(modelConfigContent);

      // 将字段迁移回 modelConfig.json
      modelConfig.currentAgent = globalConfig.currentAgent || 'default';
      modelConfig.agentModels = globalConfig.agentModels || [];
      modelConfig.agentModeEnabled = globalConfig.agentModeEnabled !== undefined 
        ? globalConfig.agentModeEnabled 
        : true;

      // 保存更新后的 modelConfig.json
      fs.writeFileSync(modelConfigPath, JSON.stringify(modelConfig, null, 2), 'utf-8');
      Logger.info('恢复 modelConfig.json', { path: modelConfigPath });

      // 删除 globalConfig.json
      fs.unlinkSync(globalConfigPath);
      Logger.info('删除 globalConfig.json', { path: globalConfigPath });

      Logger.info('配置回滚完成！');
      return true;
    } catch (error: any) {
      Logger.error('配置回滚失败', error);
      return false;
    }
  }
}
