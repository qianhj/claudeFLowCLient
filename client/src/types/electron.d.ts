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

export interface ElectronAPI {
  pickFolder: () => Promise<{ canceled: boolean; filePaths: string[] }>;
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
  platform: string;
  versions: Record<string, string>;
  onAgentReady: (callback: (state: AgentState) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
