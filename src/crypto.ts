import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import CryptoJS from 'crypto-js';

/**
 * 使用 VS Code SecretStorage 安全存储密钥
 */

const SECRET_KEY = 'leobot-encryption-key';

/**
 * 获取或生成加密密钥
 */
export async function getEncryptionKey(context: vscode.ExtensionContext): Promise<string> {
  let key = await context.secrets.get(SECRET_KEY);
  
  if (!key) {
    const bytes = randomBytes(32);
    key = bytes.toString('hex');
    await context.secrets.store(SECRET_KEY, key);
  }
  
  return key;
}

/**
 * 加密字符串
 */
export async function encrypt(text: string, context: vscode.ExtensionContext): Promise<string> {
  const key = await getEncryptionKey(context);
  return CryptoJS.AES.encrypt(text, key).toString();
}

/**
 * 解密字符串
 */
export async function decrypt(encryptedText: string, context: vscode.ExtensionContext): Promise<string> {
  const key = await getEncryptionKey(context);
  const bytes = CryptoJS.AES.decrypt(encryptedText, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * 删除存储的密钥
 */
export async function removeEncryptionKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_KEY);
}
