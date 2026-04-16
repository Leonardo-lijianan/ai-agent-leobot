import path from "path";
import * as fs from "fs";
import { Logger } from "./Logger.js";

/**
 * 读取 HTML 文件并内联 CSS 和 JS
 * @param extensionPath 扩展路径
 * @param htmlFileName HTML 文件名
 * @param cssFileName CSS 文件名
 * @param jsFileName JS 文件名
 * @returns 内联后的 HTML 字符串
 */
export function getHtmlForWebview(
  extensionPath: string,
  htmlFileName: string,
  cssFileName?: string,
  jsFileName?: string
): string {
  const htmlPath = path.join(extensionPath, "webview", "media", htmlFileName);
  Logger.debug(`Loading HTML from: ${htmlPath}`);
  let html = fs.readFileSync(htmlPath, "utf-8");

  // 内联 CSS
  if (cssFileName) {
    const cssPath = path.join(extensionPath, "webview", "media", cssFileName);
    Logger.debug(`Loading CSS from: ${cssPath}`);
    const css = fs.readFileSync(cssPath, "utf-8");
    const cssTag = `<style>${css}</style>`;
    html = html.replace("</head>", cssTag + "</head>");
  }

  // 内联 JS（esbuild 已经打包好了）
  if (jsFileName) {
    const jsPath = path.join(extensionPath, "webview", "media", "script", jsFileName);
    Logger.debug(`Loading JS from: ${jsPath}`);
    const js = fs.readFileSync(jsPath, "utf-8");
    const jsTag = `<script>${js}</script>`;
    html = html.replace("</body>", jsTag + "</body>");
  }

  return html;
}

/**
 * 读取 Markdown 文件
 * @param extensionPath 扩展路径
 * @param mdFileName Markdown 文件名
 * @returns Markdown 字符串
 */
export function getMarkdownForWebview(extensionPath: string, mdFileName: string): string {
  const mdPath = path.join(extensionPath, "webview", "media", mdFileName);
  Logger.debug(`Loading Markdown from: ${mdPath}`);
  return fs.readFileSync(mdPath, "utf-8");
}

/**
 * 读取文件内容
 * @param extensionPath 扩展路径
 * @param fileName 文件名
 * @returns 文件内容字符串
 */
export function getFileContent(extensionPath: string, fileName: string): string {
  const filePath = path.join(extensionPath, "webview", "media", fileName);
  return fs.readFileSync(filePath, "utf-8");
}
