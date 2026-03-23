/**
 * electron-builder afterPack hook
 * 使用 @electron/rebuild 重建原生模块（如 node-pty）
 */
const path = require("path");
const fs = require("fs");

exports.default = async function (context) {
  let rebuild;
  try {
    rebuild = require("@electron/rebuild").rebuild;
  } catch {
    console.warn("[rebuild] @electron/rebuild not found, skipping native module rebuild.");
    console.warn("[rebuild] To enable: pnpm add -D @electron/rebuild in electron/");
    return;
  }

  const { appOutDir, packager } = context;

  // 从安装的 electron 包中获取版本号
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
    } catch {
      // fallback: read from electron dist/version file
      const versionFile = path.join(appOutDir, "resources", "version");
      if (fs.existsSync(versionFile)) {
        electronVersion = fs.readFileSync(versionFile, "utf8").trim();
      }
    }
  }

  if (!electronVersion) {
    console.warn("[rebuild] Cannot determine electron version, skipping native rebuild");
    return;
  }

  const modulesDir = path.join(appOutDir, "resources", "node_modules");
  if (!fs.existsSync(modulesDir)) {
    console.log("[rebuild] No node_modules in resources, skipping");
    return;
  }

  console.log(`[rebuild] Rebuilding native modules, electron=${electronVersion}`);
  try {
    await rebuild({
      buildPath: modulesDir,
      electronVersion,
      onlyModules: ["node-pty"],
    });
    console.log("[rebuild] Done.");
  } catch (err) {
    console.warn("[rebuild] Failed (non-fatal):", err.message);
  }
};
