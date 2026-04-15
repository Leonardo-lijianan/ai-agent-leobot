import esbuild from 'esbuild';

const production = process.argv.includes('--production');

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
  
  // 1. 编译前端代码
  const frontendCtx = await esbuild.context({
    entryPoints: ['webview/src/*.ts'],
    bundle: false,
    format: 'cjs',
    minify: production,
    minifyWhitespace: production,
    minifyIdentifiers: production,
    minifySyntax: production,
    keepNames: false,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'browser',
    target: 'es2020',
    outdir: 'dist/webview/media/script',
    logLevel: 'warning',
    tsconfig: 'webview/tsconfig.json',
    plugins: [
      esbuildProblemMatcherPlugin
    ]
  });
  
  // 打包前端代码
  await frontendCtx.rebuild();
  await frontendCtx.dispose();
  
  // 3. 后端扩展代码 - 打包到 extension/dist/
  const backendCtx = await esbuild.context({
    entryPoints: ['extension/src/extension.ts'],
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
    tsconfig: 'extension/tsconfig.json',
    plugins: [
      esbuildProblemMatcherPlugin
    ]
  });
  
  // 打包后端代码
  await backendCtx.rebuild();
  await backendCtx.dispose();
  
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
