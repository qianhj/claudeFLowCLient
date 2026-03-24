import { app, BrowserWindow, shell, Menu, ipcMain, dialog, globalShortcut, screen } from "electron";
import { fork, execSync, ChildProcess } from "child_process";
import { autoUpdater } from "electron-updater";
import path from "path";
import http from "http";
import fs from "fs";

const isDev = !app.isPackaged;
const PORT = 3001;

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

// ========== Electron Agent 集成 ==========
interface AgentState {
  enabled: boolean;
  debugPort: number;
  autoScreenshot: boolean;
  recordActions: boolean;
}

const agentState: AgentState = {
  enabled: true,
  debugPort: 9223,
  autoScreenshot: false,
  recordActions: false,
};

// ---------- 日志文件（生产模式） ----------
let logStream: fs.WriteStream | null = null;
function initLog(): void {
  if (isDev) return;
  try {
    const logDir = app.getPath("logs");
    fs.mkdirSync(logDir, { recursive: true });
    logStream = fs.createWriteStream(path.join(logDir, "server.log"), { flags: "a" });
    logStream.write(`\n--- App started ${new Date().toISOString()} ---\n`);
  } catch {
    // ignore log init failure
  }
}
function writeLog(line: string): void {
  const msg = `[${new Date().toISOString()}] ${line}\n`;
  process.stdout.write(msg);
  logStream?.write(msg);
}

// ---------- 启动后端进程（仅生产模式）----------
function killPort(port: number): void {
  try {
    if (process.platform === "win32") {
      execSync(
        `FOR /F "tokens=5" %a IN ('netstat -ano ^| findstr :${port}') DO taskkill /F /PID %a`,
        { shell: "cmd.exe", stdio: "ignore" }
      );
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: "ignore" });
    }
  } catch {
    // 端口未被占用，忽略
  }
}

function startServer(): void {
  const serverEntry = path.join(
    process.resourcesPath,
    "server",
    "dist",
    "index.js"
  );

  writeLog(`[main] resourcesPath = ${process.resourcesPath}`);
  writeLog(`[main] serverEntry   = ${serverEntry}`);
  writeLog(`[main] exists        = ${fs.existsSync(serverEntry)}`);

  const serverDir = path.dirname(serverEntry);
  const serverNodeModules = path.join(serverDir, "node_modules");

  serverProcess = fork(serverEntry, [], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
      ELECTRON_RESOURCES_PATH: process.resourcesPath,
      // server/node_modules 不在默认路径，需要显式指定
      NODE_PATH: serverNodeModules,
    },
    stdio: "pipe",
  });

  serverProcess.stdout?.on("data", (d) => writeLog(`[server] ${d.toString().trim()}`));
  serverProcess.stderr?.on("data", (d) => writeLog(`[server:err] ${d.toString().trim()}`));

  serverProcess.on("exit", (code) => {
    writeLog(`[server] exited with code ${code}`);
  });
}

// ---------- 轮询等待后端就绪 ----------
function waitForServer(maxRetries = 40, intervalMs = 500): Promise<void> {
  return new Promise((resolve, reject) => {
    let retries = 0;

    const check = () => {
      const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          writeLog("[main] server health check OK");
          resolve();
        } else {
          retry();
        }
      });
      req.on("error", retry);
      req.setTimeout(300, () => { req.destroy(); retry(); });
    };

    const retry = () => {
      retries++;
      if (retries >= maxRetries) {
        reject(new Error(`Backend did not start after ${maxRetries} retries`));
      } else {
        setTimeout(check, intervalMs);
      }
    };

    check();
  });
}

// ---------- 创建主窗口 ----------
async function createWindow(): Promise<void> {
  initLog();

  if (!isDev) {
    killPort(PORT);
    startServer();
    try {
      await waitForServer();
    } catch (err) {
      writeLog(`[main] ERROR: Backend failed to start: ${err}`);
      dialog.showErrorBox(
        "启动失败",
        `后端服务未能启动，请查看日志：\n${app.getPath("logs")}\\server.log\n\n错误：${err}`
      );
      app.quit();
      return;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "HZ CC Flow",
    backgroundColor: "#13111C",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: true,
    show: false,
  });

  const startUrl = isDev
    ? "http://localhost:5173"
    : `http://localhost:${PORT}`;

  writeLog(`[main] loading URL: ${startUrl}`);
  mainWindow.loadURL(startUrl);

  mainWindow.webContents.on("did-fail-load", (_e, code, desc) => {
    writeLog(`[main] did-fail-load: ${code} ${desc}`);
    dialog.showErrorBox("页面加载失败", `错误码：${code}\n${desc}\n\n请查看日志：${app.getPath("logs")}\\server.log`);
  });

  // 窗口准备好后再显示
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (isDev) {
      mainWindow?.webContents.openDevTools();
    } else {
      // 延迟 3 秒后检查更新，避免阻塞启动
      setupAutoUpdater();
      setTimeout(() => autoUpdater.checkForUpdates(), 3000);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // ========== Electron Agent 事件监听 ==========
  mainWindow.webContents.on("dom-ready", () => {
    if (agentState.enabled) {
      mainWindow?.webContents.send("agent:ready", agentState);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---------- 原生文件夹选择对话框（IPC） ----------
ipcMain.handle("show-open-dialog", async (_event, options) => {
  const win = mainWindow ?? BrowserWindow.getFocusedWindow();
  if (!win) return { canceled: true, filePaths: [] };
  return dialog.showOpenDialog(win, options);
});

// ========== Electron Agent IPC 接口 ==========

// 启用/禁用 Agent
ipcMain.handle("agent:enable", (_event, enabled: boolean) => {
  agentState.enabled = enabled;
  writeLog(`[agent] ${enabled ? "enabled" : "disabled"}`);
  return { success: true, state: agentState };
});

// 获取 Agent 状态
ipcMain.handle("agent:status", () => {
  return { success: true, state: agentState };
});

// 截图
ipcMain.handle("agent:capture", async () => {
  const win = mainWindow ?? BrowserWindow.getFocusedWindow();
  if (!win) return { success: false, error: "No window available" };

  try {
    const image = await win.webContents.capturePage();
    const dataUrl = image.toDataURL();
    writeLog("[agent] Screenshot captured");
    return { success: true, dataUrl, size: { width: image.getSize().width, height: image.getSize().height } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// 获取窗口信息
ipcMain.handle("agent:window-info", () => {
  const win = mainWindow ?? BrowserWindow.getFocusedWindow();
  if (!win) return { success: false, error: "No window available" };

  const bounds = win.getBounds();
  return {
    success: true,
    info: {
      id: win.id,
      title: win.getTitle(),
      bounds,
      isFocused: win.isFocused(),
      isVisible: win.isVisible(),
      isMinimized: win.isMinimized(),
      isMaximized: win.isMaximized(),
    },
  };
});

// 窗口控制
ipcMain.handle("agent:window-control", (_event, action: string) => {
  const win = mainWindow ?? BrowserWindow.getFocusedWindow();
  if (!win) return { success: false, error: "No window available" };

  switch (action) {
    case "minimize":
      win.minimize();
      break;
    case "maximize":
      win.maximize();
      break;
    case "restore":
      win.restore();
      break;
    case "close":
      win.close();
      break;
    case "focus":
      win.focus();
      break;
    case "show":
      win.show();
      break;
    case "hide":
      win.hide();
      break;
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
  return { success: true };
});

// 执行 JavaScript
ipcMain.handle("agent:execute-js", async (_event, script: string) => {
  const win = mainWindow ?? BrowserWindow.getFocusedWindow();
  if (!win) return { success: false, error: "No window available" };

  try {
    const result = await win.webContents.executeJavaScript(script);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// 设置窗口边界
ipcMain.handle("agent:set-bounds", (_event, bounds: Partial<Electron.Rectangle>) => {
  const win = mainWindow ?? BrowserWindow.getFocusedWindow();
  if (!win) return { success: false, error: "No window available" };

  win.setBounds(bounds);
  return { success: true, bounds: win.getBounds() };
});

// 获取屏幕信息
ipcMain.handle("agent:screen-info", () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const allDisplays = screen.getAllDisplays();
  return {
    success: true,
    primary: primaryDisplay,
    displays: allDisplays,
  };
});

// 模拟键盘快捷键
ipcMain.handle("agent:shortcut", (_event, accelerator: string) => {
  const win = mainWindow ?? BrowserWindow.getFocusedWindow();
  if (!win) return { success: false, error: "No window available" };

  // 通过 webContents 发送按键事件
  const parts = accelerator.split("+");
  const modifiers: Electron.InputEvent["modifiers"] = [];
  let key = "";

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (["ctrl", "control", "cmd", "command", "meta"].includes(lower)) {
      modifiers.push("ctrl");
    } else if (lower === "shift") {
      modifiers.push("shift");
    } else if (lower === "alt") {
      modifiers.push("alt");
    } else {
      key = part;
    }
  }

  const keyDownEvent: Electron.KeyboardInputEvent = {
    type: "keyDown",
    keyCode: key,
    modifiers,
  };
  const keyUpEvent: Electron.KeyboardInputEvent = {
    type: "keyUp",
    keyCode: key,
    modifiers,
  };

  win.webContents.sendInputEvent(keyDownEvent);
  win.webContents.sendInputEvent(keyUpEvent);

  return { success: true };
});

// 应用菜单（Agent 可以触发的菜单命令）
const agentMenuCommands: Record<string, () => void> = {
  "reload": () => {
    mainWindow?.webContents.reload();
  },
  "toggle-devtools": () => {
    mainWindow?.webContents.toggleDevTools();
  },
  "zoom-in": () => {
    const level = mainWindow?.webContents.getZoomLevel() ?? 0;
    mainWindow?.webContents.setZoomLevel(level + 0.5);
  },
  "zoom-out": () => {
    const level = mainWindow?.webContents.getZoomLevel() ?? 0;
    mainWindow?.webContents.setZoomLevel(level - 0.5);
  },
  "reset-zoom": () => {
    mainWindow?.webContents.setZoomLevel(0);
  },
};

ipcMain.handle("agent:menu-command", (_event, command: string) => {
  const handler = agentMenuCommands[command];
  if (handler) {
    handler();
    return { success: true };
  }
  return { success: false, error: `Unknown command: ${command}` };
});

// 获取可用菜单命令列表
ipcMain.handle("agent:menu-list", () => {
  return { success: true, commands: Object.keys(agentMenuCommands) };
});

// ---------- 去掉默认菜单栏 ----------
Menu.setApplicationMenu(null);

// ---------- 自动更新 ----------
function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    writeLog("[updater] Checking for update...");
  });

  autoUpdater.on("update-available", (info) => {
    writeLog(`[updater] Update available: ${info.version}`);
    const win = mainWindow ?? BrowserWindow.getFocusedWindow();
    const opts: Electron.MessageBoxOptions = {
      type: "info",
      title: "发现新版本",
      message: `新版本 ${info.version} 可用`,
      detail: `当前版本：${app.getVersion()}\n新版本：${info.version}\n\n是否立即下载？`,
      buttons: ["下载更新", "稍后"],
      defaultId: 0,
    };
    (win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts)).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate();
    });
  });

  autoUpdater.on("update-not-available", () => {
    writeLog("[updater] Already up to date");
  });

  autoUpdater.on("download-progress", (progress) => {
    const pct = Math.round(progress.percent);
    writeLog(`[updater] Downloading... ${pct}%`);
    mainWindow?.setProgressBar(progress.percent / 100);
  });

  autoUpdater.on("update-downloaded", () => {
    writeLog("[updater] Update downloaded");
    mainWindow?.setProgressBar(-1);
    const win = mainWindow ?? BrowserWindow.getFocusedWindow();
    const opts: Electron.MessageBoxOptions = {
      type: "info",
      title: "更新就绪",
      message: "新版本已下载完成",
      detail: "重启应用后将自动安装新版本。",
      buttons: ["立即重启", "稍后"],
      defaultId: 0,
    };
    (win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts)).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on("error", (err) => {
    writeLog(`[updater] Error: ${err.message}`);
    mainWindow?.setProgressBar(-1);
  });
}

// ---------- 应用生命周期 ----------
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  serverProcess?.kill();
  logStream?.end();
});
