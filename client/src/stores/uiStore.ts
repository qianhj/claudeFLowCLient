import { create } from "zustand";

export type Theme = "dark" | "light" | "system";
type SidebarTab = "sessions" | "files" | "agents" | "extensions" | "settings";
export type LeftNavPanel = "files" | "search" | "checkpoints" | "git" | "gitlab";
export type RightSidebarTab = "monitor" | "extensions" | "agent";
export type RunMode = "default" | "plan" | "edit";

interface UIState {
  // Theme
  theme: Theme;
  effectiveTheme: "dark" | "light";

  // Left sidebar
  sidebarOpen: boolean;
  sidebarWidth: number;
  sidebarTab: SidebarTab;
  leftNavPanel: LeftNavPanel;

  // Right panel
  rightPanelOpen: boolean;
  rightPanelWidth: number;
  rightSidebarTab: RightSidebarTab;

  // Right-panel terminal (collapsed by default)
  terminalOpen: boolean;
  terminalHeight: number;

  // Connection + project
  wsConnected: boolean;
  projectPath: string;

  // Input run mode
  runMode: RunMode;

  // Modal visibility
  historyModalOpen: boolean;
  fileViewModalOpen: boolean;
  settingsModalOpen: boolean;
  settingsActiveTab: "model" | "environment";
  folderBrowserOpen: boolean;
  skillBrowserOpen: boolean;
  skillBrowserInitialSelection: { tab: "project" | "user" | "plugin"; name: string } | null;
  createSkillModalOpen: boolean;

  // Settings full page
  settingsPageOpen: boolean;

  // Extensions sub-tab (driven externally by slash commands)
  extensionsSubTab: "mcp" | "skills" | "plugins" | "memory" | "hooks" | "desktop";

  // Agent prefill (set by AgentManager "launch" button, consumed by InputBar)
  prefillInput: string;

  // File attach queue (set by FileTree, consumed by InputBar)
  fileAttachQueue: string[];

  // Selected file in tree (hover/selection indicator)
  selectedFilePath: string | null;

  // Editor selection (for sending to chat)
  editorSelection: { text: string; filePath: string; lineStart: number; lineEnd: number } | null;

  // Actions
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (w: number) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setLeftNavPanel: (panel: LeftNavPanel) => void;

  setRightPanelOpen: (open: boolean) => void;
  setRightPanelWidth: (w: number) => void;
  setRightSidebarTab: (tab: RightSidebarTab) => void;

  toggleTerminal: () => void;
  setTerminalOpen: (open: boolean) => void;
  setTerminalHeight: (h: number) => void;

  setWsConnected: (c: boolean) => void;
  setProjectPath: (p: string) => void;

  setRunMode: (mode: RunMode) => void;

  setHistoryModalOpen: (open: boolean) => void;
  setFileViewModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setSettingsActiveTab: (tab: "model" | "environment") => void;
  setFolderBrowserOpen: (open: boolean) => void;
  setSkillBrowserOpen: (open: boolean) => void;
  setSkillBrowserInitialSelection: (sel: { tab: "project" | "user" | "plugin"; name: string } | null) => void;
  setCreateSkillModalOpen: (open: boolean) => void;

  setSettingsPageOpen: (open: boolean) => void;

  setExtensionsSubTab: (tab: "mcp" | "skills" | "plugins" | "memory" | "hooks" | "desktop") => void;

  setPrefillInput: (text: string) => void;
  enqueueFileAttach: (path: string) => void;
  clearFileAttachQueue: () => void;
  setSelectedFilePath: (path: string | null) => void;
  setEditorSelection: (selection: { text: string; filePath: string; lineStart: number; lineEnd: number } | null) => void;
  clearEditorSelection: () => void;
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("hz_theme") as Theme) || "system";
}

function getEffectiveTheme(theme: Theme): "dark" | "light" {
  if (theme === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return theme;
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: getInitialTheme(),
  effectiveTheme: getEffectiveTheme(getInitialTheme()),

  sidebarOpen: true,
  sidebarWidth: 240,
  sidebarTab: "sessions",
  leftNavPanel: "files",

  rightPanelOpen: true,
  rightPanelWidth: 380,
  rightSidebarTab: "monitor",

  terminalOpen: false,
  terminalHeight: 260,

  wsConnected: false,
  projectPath: localStorage.getItem("hz_projectPath") || "",

  runMode: "default",

  historyModalOpen: false,
  fileViewModalOpen: false,
  settingsModalOpen: false,
  settingsActiveTab: "model",
  settingsPageOpen: false,
  folderBrowserOpen: false,
  skillBrowserOpen: false,
  skillBrowserInitialSelection: null,
  createSkillModalOpen: false,
  extensionsSubTab: "mcp",
  prefillInput: "",
  fileAttachQueue: [],
  selectedFilePath: null,
  editorSelection: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setLeftNavPanel: (panel) => set({ leftNavPanel: panel }),

  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setRightPanelWidth: (w) => set({ rightPanelWidth: w }),
  setRightSidebarTab: (tab) => set({ rightSidebarTab: tab }),

  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  setTerminalOpen: (open) => set({ terminalOpen: open }),
  setTerminalHeight: (h) => set({ terminalHeight: h }),

  setWsConnected: (c) => set({ wsConnected: c }),
  setProjectPath: (p) => {
    localStorage.setItem("hz_projectPath", p);
    set({ projectPath: p });
  },

  setRunMode: (mode) => set({ runMode: mode }),

  setHistoryModalOpen: (open) => set({ historyModalOpen: open }),
  setFileViewModalOpen: (open) => set({ fileViewModalOpen: open }),
  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),
  setSettingsActiveTab: (tab) => set({ settingsActiveTab: tab }),
  setSettingsPageOpen: (open) => set({ settingsPageOpen: open }),
  setFolderBrowserOpen: (open) => set({ folderBrowserOpen: open }),
  setSkillBrowserOpen: (open) => set({ skillBrowserOpen: open }),
  setSkillBrowserInitialSelection: (sel) => set({ skillBrowserInitialSelection: sel }),
  setCreateSkillModalOpen: (open) => set({ createSkillModalOpen: open }),
  setExtensionsSubTab: (tab) => set({ extensionsSubTab: tab }),

  setTheme: (theme) => {
    localStorage.setItem("hz_theme", theme);
    const effective = getEffectiveTheme(theme);
    document.documentElement.setAttribute("data-theme", effective);
    set({ theme, effectiveTheme: effective });
  },

  setPrefillInput: (text) => set({ prefillInput: text }),
  enqueueFileAttach: (path) => set((s) => ({ fileAttachQueue: [...s.fileAttachQueue, path] })),
  clearFileAttachQueue: () => set({ fileAttachQueue: [] }),
  setSelectedFilePath: (path) => set({ selectedFilePath: path }),
  setEditorSelection: (selection) => set({ editorSelection: selection }),
  clearEditorSelection: () => set({ editorSelection: null }),
}));

// Initialize theme on load
if (typeof window !== "undefined") {
  const store = useUIStore.getState();
  const effective = getEffectiveTheme(store.theme);
  document.documentElement.setAttribute("data-theme", effective);

  // Listen for system theme changes
  const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
  mediaQuery.addEventListener("change", (e) => {
    if (store.theme === "system") {
      const newEffective = e.matches ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", newEffective);
      useUIStore.setState({ effectiveTheme: newEffective });
    }
  });
}
