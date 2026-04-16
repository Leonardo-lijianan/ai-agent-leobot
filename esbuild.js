const esbuild = require("esbuild");

const production = process.argv.includes("--production");

// 添加时间戳
function log(message) {
  const timestamp = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  console.log(`[${timestamp}] ${message}`);
}

function error(message) {
  const timestamp = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
  console.error(`[${timestamp}] ❌ ${message}`);
}

async function main() {
  const isWatch = process.argv.includes("--watch") || process.env.VSCODE_WATCH === "true";

  log(`[esbuild] 开始构建... (监听模式：${isWatch ? "开启" : "关闭"})`);

  // 1. 编译前端代码（IIFE 格式，生产环境）
  const frontendCtx = await esbuild.context({
    entryPoints: ["webview/src/chat_view.ts", "webview/src/config_panel.ts"],
    bundle: true,
    format: "iife",
    minify: true, // ← 始终压缩
    minifyWhitespace: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    keepNames: false,
    sourcemap: false, // ← 不要 map
    sourcesContent: false, // ← 不要源码
    platform: "browser",
    target: "es2020",
    outdir: "webview/media/script",
    logLevel: "silent", // ← 禁用 esbuild 自带日志
    tsconfig: "webview/tsconfig.json",
    plugins: [esbuildProblemMatcherPlugin],
  });

  // 2. 后端扩展代码（CJS 格式，生产环境）
  const backendCtx = await esbuild.context({
    entryPoints: ["extension/src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: true, // ← 始终压缩
    minifyWhitespace: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    keepNames: false,
    sourcemap: false, // ← 不要 map
    sourcesContent: false, // ← 不要源码
    platform: "node",
    target: "node18",
    outfile: "dist/extension.cjs",
    external: ["vscode"],
    logLevel: "silent", // ← 禁用 esbuild 自带日志
    tsconfig: "extension/tsconfig.json",
    plugins: [esbuildProblemMatcherPlugin],
  });

  if (isWatch) {
    // 监听模式：使用 watch() 方法
    log("[esbuild] 启动前端监听...");
    await frontendCtx.watch();

    log("[esbuild] 启动后端监听...");
    await backendCtx.watch();

    log("[esbuild] 监听模式已启动，按 Ctrl+C 停止");
    // 保持进程运行，等待文件变化
    await new Promise(() => {});
  } else {
    // 非监听模式：构建一次后退出
    log("[esbuild] 开始构建前端...");
    await frontendCtx.rebuild();
    await frontendCtx.dispose();

    log("[esbuild] 开始构建后端...");
    await backendCtx.rebuild();
    await backendCtx.dispose();

    log("[esbuild] 构建完成！");
  }
}

const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        error(`✘ [ERROR] ${text}`);
        if (location === null) {
          return;
        }
        error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      log("[watch] build finished");
    });
  },
};

main().catch((e) => {
  error(e);
  process.exit(1);
});
