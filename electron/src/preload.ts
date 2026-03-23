import { contextBridge, ipcRenderer } from "electron";

// 类型定义
export interface ElectronAPI {
  // 文件夹选择
  pickFolder: () => Promise<{ canceled: boolean; filePaths: string[] }>;

  // Electron Agent API
  agent: {
    enable: (enabled: boolean) => Promise<{ success: boolean; state?: AgentState; error?: string }>;
    status: () => Promise<{ success: boolean; state?: AgentState; error?: string }>;
    capture: () => Promise<{ success: boolean; dataUrl?: string; size?: { width: number; height: number }; error?: string }>;
    getWindowInfo: () => Promise<{ success: boolean; info?: WindowInfo; error?: string }>;
    windowControl: (action: WindowAction) => Promise<{ success: boolean; error?: string }>;
    setBounds: (bounds: Partial<Rectangle>) => Promise<{ success: boolean; bounds?: Rectangle; error?: string }>;
    executeJS: (script: string) => Promise<{ success: boolean; result?: unknown; error?: string }>;
    getScreenInfo: () => Promise<{ success: boolean; primary?: Display; displays?: Display[]; error?: string }>;
    triggerShortcut: (accelerator: string) => Promise<{ success: boolean; error?: string }>;
    menuCommand: (command: string) => Promise<{ success: boolean; error?: string }>;
    getMenuList: () => Promise<{ success: boolean; commands?: string[]; error?: string }>;
  };

  // 平台信息
  platform: string;
  versions: Record<string, string>;

  // 事件监听
  onAgentReady: (callback: (state: AgentState) => void) => () => void;
}

export interface AgentState {
  enabled: boolean;
  debugPort: number;
  autoScreenshot: boolean;
  recordActions: boolean;
}

export interface WindowInfo {
  id: number;
  title: string;
  bounds: Rectangle;
  isFocused: boolean;
  isVisible: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WindowAction = "minimize" | "maximize" | "restore" | "close" | "focus" | "show" | "hide";

export interface Display {
  id: number;
  bounds: Rectangle;
  workArea: Rectangle;
  scaleFactor: number;
  isPrimary: boolean;
}

// 暴露 API 到渲染进程
const api: ElectronAPI = {
  // 文件夹选择
  pickFolder: () =>
    ipcRenderer.invoke("show-open-dialog", { properties: ["openDirectory"] }),

  // Electron Agent API
  agent: {
    enable: (enabled: boolean) => ipcRenderer.invoke("agent:enable", enabled),
    status: () => ipcRenderer.invoke("agent:status"),
    capture: () => ipcRenderer.invoke("agent:capture"),
    getWindowInfo: () => ipcRenderer.invoke("agent:window-info"),
    windowControl: (action: WindowAction) => ipcRenderer.invoke("agent:window-control", action),
    setBounds: (bounds: Partial<Rectangle>) => ipcRenderer.invoke("agent:set-bounds", bounds),
    executeJS: (script: string) => ipcRenderer.invoke("agent:execute-js", script),
    getScreenInfo: () => ipcRenderer.invoke("agent:screen-info"),
    triggerShortcut: (accelerator: string) => ipcRenderer.invoke("agent:shortcut", accelerator),
    menuCommand: (command: string) => ipcRenderer.invoke("agent:menu-command", command),
    getMenuList: () => ipcRenderer.invoke("agent:menu-list"),
  },

  // 平台信息
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },

  // 事件监听 - Agent 就绪事件
  onAgentReady: (callback: (state: AgentState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: AgentState) => callback(state);
    ipcRenderer.on("agent:ready", handler);
    return () => {
      ipcRenderer.removeListener("agent:ready", handler);
    };
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);

// 类型声明，便于 TypeScript 使用
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
