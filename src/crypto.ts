import * as vscode from 'vscode';

/**
 * 使用 VS Code SecretStorage 安全存储密钥
 * SecretStorage 使用操作系统级别的安全存储：
 * - Windows: Windows Credential Manager
 * - macOS: Keychain
 * - Linux: libsecret (GNOME Keyring 或 KWallet)
 */

const SECRET_KEY = 'leobot-encryption-key';

/**
 * 获取或生成加密密钥
 * 如果密钥不存在，则生成一个新的随机密钥并存储
 */
export async function getEncryptionKey(context: vscode.ExtensionContext): Promise<string> {
  let key = await context.secrets.get(SECRET_KEY);
  
  if (!key) {
    // 生成一个随机的 32 字节密钥
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

/**
 * 加密字符串
 * 注意：这是一个简单的加密实现，主要用于防止明文存储
 * 对于更高的安全性，建议使用专门的密钥管理服务
 */
export async function encrypt(text: string, context: vscode.ExtensionContext): Promise<string> {
  const key = await getEncryptionKey(context);
  
  // 使用 CryptoJS 进行加密
  const CryptoJS = await import('crypto-js');
  const encrypted = CryptoJS.AES.encrypt(text, key).toString();
  return encrypted;
}

/**
 * 解密字符串
 */
export async function decrypt(encryptedText: string, context: vscode.ExtensionContext): Promise<string> {
  const key = await getEncryptionKey(context);
  
  const CryptoJS = await import('crypto-js');
  const bytes = CryptoJS.AES.decrypt(encryptedText, key);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  return decrypted;
}

/**
 * 删除存储的密钥（用于重置或卸载）
 */
export async function removeEncryptionKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_KEY);
}
