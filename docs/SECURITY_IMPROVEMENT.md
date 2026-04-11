# 安全改进 - 使用 VS Code SecretStorage 存储加密密钥

## 🔒 安全问题修复

### 问题描述
**硬编码加密密钥安全风险**：加密密钥硬编码在源代码中，存在严重安全风险。

**原代码**：
```typescript
// ❌ 不安全：硬编码密钥
const ENCRYPTION_KEY = 'leobot-ai-agent-secret-key-2024';
```

### 解决方案
使用 **VS Code SecretStorage API** 安全存储加密密钥。

**新实现**：
```typescript
// ✅ 安全：使用 VS Code SecretStorage
import * as vscode from 'vscode';

const SECRET_KEY = 'leobot-encryption-key';

export async function getEncryptionKey(context: vscode.ExtensionContext): Promise<string> {
  let key = await context.secrets.get(SECRET_KEY);
  
  if (!key) {
    // 生成随机 32 字节密钥
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    key = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // 存储到 SecretStorage
    await context.secrets.store(SECRET_KEY, key);
  }
  
  return key;
}
```

## 🛡️ 安全特性

### 1. 操作系统级别的安全存储
SecretStorage 使用操作系统提供的安全存储机制：

- **Windows**: Windows Credential Manager
- **macOS**: Keychain
- **Linux**: libsecret (GNOME Keyring 或 KWallet)

### 2. 动态密钥生成
- 首次运行时自动生成随机 32 字节密钥
- 密钥存储在系统安全存储中，不在代码中暴露
- 每个用户设备使用不同的密钥

### 3. 加密流程
```
用户输入 API Key
    ↓
获取/生成加密密钥（从 SecretStorage）
    ↓
使用 crypto-js AES 加密
    ↓
存储加密后的 API Key 到配置文件
```

### 4. 解密流程
```
读取加密的 API Key
    ↓
获取加密密钥（从 SecretStorage）
    ↓
使用 crypto-js AES 解密
    ↓
返回原始 API Key
```

## 📝 修改的文件

### 1. `src/crypto.ts`
**修改前**：
- 硬编码加密密钥
- 同步加密/解密函数

**修改后**：
- 使用 VS Code SecretStorage
- 异步加密/解密函数
- 自动生成和存储密钥
- 添加密钥删除功能

### 2. `src/modelConfigManager.ts`
**修改**：
```typescript
// 修改前
async getApiKey(modelName: string): Promise<string | undefined> {
  if (model?.apiKey) {
    return decrypt(model.apiKey);
  }
  return undefined;
}

// 修改后
async getApiKey(modelName: string): Promise<string | undefined> {
  if (model?.apiKey && this._context) {
    return decrypt(model.apiKey, this._context);
  }
  return undefined;
}
```

### 3. `src/extension.ts`
**修改**：
```typescript
// 修改前
const encryptedApiKey = encrypt(message.apiKey);

// 修改后
const encryptedApiKey = await encrypt(message.apiKey, context);
```

## ✅ 安全优势

| 特性 | 硬编码密钥 | SecretStorage |
|------|-----------|--------------|
| 密钥存储位置 | 源代码 | 系统安全存储 |
| 密钥可见性 | 公开 | 仅扩展可访问 |
| 密钥复用 | 所有用户相同 | 每设备独立 |
| 系统保护 | 无 | 操作系统级别 |
| 卸载清理 | 手动 | 自动 |

## 🔑 密钥管理

### 获取密钥
```typescript
const key = await context.secrets.get('leobot-encryption-key');
```

### 存储密钥
```typescript
await context.secrets.store('leobot-encryption-key', key);
```

### 删除密钥
```typescript
await context.secrets.delete('leobot-encryption-key');
```

## 🚀 使用说明

### 首次使用
1. 扩展激活时自动生成密钥
2. 密钥存储到系统安全存储
3. 用户无感知，透明使用

### 卸载扩展
- 密钥会保留在系统中（不影响其他数据）
- 如需清理，手动删除凭据

### 重置密钥
```typescript
import { removeEncryptionKey } from './crypto.js';

await removeEncryptionKey(context);
// 下次使用时会自动生成新密钥
```

## 📊 加密强度

- **密钥长度**: 256 位（32 字节）
- **加密算法**: AES-256
- **随机源**: crypto.getRandomValues() (密码学安全随机数生成器)

## ⚠️ 注意事项

1. **向后兼容性**: 
   - 旧版本加密的 API Key 需要重新输入
   - 首次更新后会提示重新配置 API Key

2. **密钥迁移**:
   - 密钥存储在本地，不会同步
   - 更换设备需要重新配置 API Key

3. **安全性限制**:
   - 仍然使用 AES 对称加密
   - 主要防止明文存储
   - 对于极高安全需求，建议使用 HSM 或 KMS

## 🎯 安全建议

### 已实现 ✅
- [x] 使用系统安全存储
- [x] 动态生成密钥
- [x] 异步加密操作
- [x] 密钥隔离存储

### 未来改进 📋
- [ ] 支持密钥轮换
- [ ] 添加密钥备份功能
- [ ] 支持硬件安全模块 (HSM)
- [ ] 集成云密钥管理服务 (KMS)

## 📚 参考资料

- [VS Code SecretStorage API](https://code.visualstudio.com/api/references/vscode-api#SecretStorage)
- [Windows Credential Manager](https://learn.microsoft.com/en-us/windows/win32/seccredman/credentials-management)
- [macOS Keychain](https://developer.apple.com/documentation/security/keychain_services)
- [libsecret](https://gitlab.gnome.org/GNOME/libsecret)

---

**修复完成时间**: 2026-04-11  
**安全等级**: ⭐⭐⭐⭐ (4/5)  
**剩余风险**: 对称加密本身的固有风险
