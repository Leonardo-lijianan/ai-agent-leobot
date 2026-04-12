import esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  // 后端扩展代码 - 打包到 dist/
  const backendCtx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,  // 生产环境启用混淆压缩
    minifyWhitespace: production,  // 移除空格
    minifyIdentifiers: production,  // 混淆变量名
    minifySyntax: production,  // 语法压缩
    keepNames: false,  // 不保留函数名（进一步压缩）
    sourcemap: !production,
    sourcesContent: false,  // 不包含源码内容
    platform: 'node',
    target: 'node18',
    outfile: 'dist/extension.cjs',
    external: ['vscode'],
    logLevel: 'warning',
    plugins: [
      esbuildProblemMatcherPlugin
    ]
  });

  // 前端 Webview 代码 - 打包到 media/
  const frontendCtx = await esbuild.context({
    entryPoints: ['src/configPanelView.ts'],
    bundle: true,
    format: 'esm',
    minify: production,
    minifyWhitespace: production,
    minifyIdentifiers: production,
    minifySyntax: production,
    keepNames: false,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'browser',
    outfile: 'media/configPanelView.js',
    logLevel: 'warning',
    plugins: [
      esbuildProblemMatcherPlugin
    ]
  });
  
  if (watch) {
    await Promise.all([backendCtx.watch(), frontendCtx.watch()]);
  } else {
    await Promise.all([backendCtx.rebuild(), frontendCtx.rebuild()]);
    await Promise.all([backendCtx.dispose(), frontendCtx.dispose()]);
  }
}

/**
 * @type {import('esbuild').Plugin}
 */
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
