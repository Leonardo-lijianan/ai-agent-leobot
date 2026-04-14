import esbuild from 'esbuild';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// 添加时间戳
function log(message) {
  const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  console.log(`[${timestamp}] ${message}`);
}

function error(message) {
  const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  console.error(`[${timestamp}] ❌ ${message}`);
}

async function main() {
  log('[esbuild] 开始构建...');
  
  // 1. 先编译前端代码
  log('[esbuild] 编译前端代码...');
  try {
    execSync('npx tsc -p tsconfig.frontend.json', { stdio: 'inherit' });
    log('[esbuild] 前端代码编译完成');
  } catch (error) {
    error('[esbuild] 前端代码编译失败:', error.message);
    process.exit(1);
  }
  
  // 2. 前端脚本已经由 ConfigPanel 处理，不需要额外操作
  
  // 3. 后端扩展代码 - 打包到 dist/
  const backendCtx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    minifyWhitespace: production,
    minifyIdentifiers: production,
    minifySyntax: production,
    keepNames: false,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    target: 'node18',
    outfile: 'dist/extension.cjs',
    external: ['vscode'],
    logLevel: 'warning',
    plugins: [
      esbuildProblemMatcherPlugin
    ]
  });
  
  if (watch) {
    await backendCtx.watch();
  } else {
    await backendCtx.rebuild();
    await backendCtx.dispose();
  }
  
  log('[esbuild] 构建完成！');
}

const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd(result => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location == null) return;
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  }
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});
