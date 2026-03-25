/**
 * electron-builder afterPack hook
 * 使用 @electron/rebuild 重建原生模块（如 node-pty）
 */
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

/**
 * 查找 @electron/rebuild 模块
 */
function findElectronRebuild() {
  // 尝试多个可能的位置
  const possiblePaths = [
    // 相对于 electron 目录
    path.join(__dirname, "..", "node_modules", "@electron", "rebuild"),
    // 相对于工作区根目录
    path.join(__dirname, "..", "..", "node_modules", "@electron", "rebuild"),
  ];

  // 尝试使用 require.resolve
  try {
    const resolved = require.resolve("@electron/rebuild");
    possiblePaths.push(path.dirname(path.dirname(resolved)));
  } catch {
    // ignore
  }

  for (const modPath of possiblePaths) {
    if (fs.existsSync(modPath)) {
      console.log(`[rebuild] Found @electron/rebuild at: ${modPath}`);
      return require(modPath);
    }
  }

  // 尝试全局安装
  try {
    const globalPath = execSync("npm root -g", { encoding: "utf8" }).trim();
    const globalRebuild = path.join(globalPath, "@electron", "rebuild");
    if (fs.existsSync(globalRebuild)) {
      console.log(`[rebuild] Found @electron/rebuild globally`);
      return require(globalRebuild);
    }
  } catch {
    // ignore
  }

  return null;
}

exports.default = async function (context) {
  const rebuild = findElectronRebuild();

  if (!rebuild || !rebuild.rebuild) {
    console.error("[rebuild] ERROR: @electron/rebuild not found!");
    console.error("[rebuild] Please install: pnpm add -D @electron/rebuild in electron/");
    return;
  }

  const { appOutDir, packager } = context;

  // 获取 electron 版本
  let electronVersion = packager.config.electronVersion;
  if (!electronVersion) {
    try {
      const electronPkg = require(path.join(
        __dirname,
        "..",
        "node_modules",
        "electron",
        "package.json"
      ));
      electronVersion = electronPkg.version;
    } catch (err) {
      console.warn("[rebuild] Cannot read electron package.json:", err.message);
      const versionFile = path.join(appOutDir, "resources", "version");
      if (fs.existsSync(versionFile)) {
        electronVersion = fs.readFileSync(versionFile, "utf8").trim();
      }
    }
  }

  if (!electronVersion) {
    console.error("[rebuild] ERROR: Cannot determine electron version");
    return;
  }

  console.log(`[rebuild] Electron version: ${electronVersion}`);

  // 检查 server 目录
  const serverDir = path.join(appOutDir, "resources", "server");
  const modulesDir = path.join(serverDir, "node_modules");

  if (!fs.existsSync(modulesDir)) {
    console.error(`[rebuild] ERROR: node_modules not found at ${modulesDir}`);
    return;
  }

  // 检查 node-pty 是否存在
  const nodePtyPath = path.join(modulesDir, "node-pty");
  if (!fs.existsSync(nodePtyPath)) {
    console.error(`[rebuild] ERROR: node-pty not found at ${nodePtyPath}`);
    return;
  }

  console.log(`[rebuild] Rebuilding node-pty for electron=${electronVersion}`);

  try {
    await rebuild.rebuild({
      buildPath: serverDir,
      electronVersion,
      onlyModules: ["node-pty"],
      force: true,
    });

    // 验证重建结果
    const builtFiles = [];
    const searchDir = path.join(modulesDir, "node-pty");

    function findNodeFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findNodeFiles(fullPath);
        } else if (entry.name.endsWith(".node")) {
          builtFiles.push(fullPath);
        }
      }
    }

    findNodeFiles(searchDir);

    if (builtFiles.length === 0) {
      throw new Error("No .node files found after rebuild");
    }

    console.log(`[rebuild] Success! Built files:`);
    builtFiles.forEach(f => console.log(`  - ${path.relative(appOutDir, f)}`));

  } catch (err) {
    console.error("[rebuild] FAILED:", err.message);
    console.error(err.stack);
    // 原生模块重建失败应该终止构建
    throw new Error(`Native module rebuild failed: ${err.message}`);
  }
};
