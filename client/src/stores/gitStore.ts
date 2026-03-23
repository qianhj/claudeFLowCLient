import { create } from "zustand";
import { api } from "../services/api";

export interface GitStatus {
  isRepo: boolean;
  reason?: string;
  checkedPath?: string;
  branch: string | null;
  ahead: number;
  behind: number;
  modified: string[];
  staged: string[];
  untracked: string[];
  conflicted: string[];
  isClean: boolean;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  relativeDate: string;
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

interface GitState {
  // Data
  status: GitStatus | null;
  commits: GitCommit[];
  branches: GitBranch[];
  currentBranch: string | null;
  diff: string;

  // Loading states
  loading: boolean;
  error: string | null;

  // Actions
  fetchStatus: (projectPath: string) => Promise<void>;
  fetchLog: (projectPath: string, limit?: number) => Promise<void>;
  fetchBranches: (projectPath: string) => Promise<void>;
  fetchDiff: (projectPath: string, file?: string, staged?: boolean) => Promise<void>;

  stageFiles: (projectPath: string, files: string[]) => Promise<boolean>;
  unstageFiles: (projectPath: string, files: string[]) => Promise<boolean>;
  commit: (projectPath: string, message: string) => Promise<boolean>;
  checkoutBranch: (projectPath: string, branch: string, create?: boolean) => Promise<boolean>;
  discardChanges: (projectPath: string, files: string[]) => Promise<boolean>;
  initRepo: (projectPath: string) => Promise<boolean>;

  clearError: () => void;
}

export const useGitStore = create<GitState>()((set, get) => ({
  status: null,
  commits: [],
  branches: [],
  currentBranch: null,
  diff: "",
  loading: false,
  error: null,

  fetchStatus: async (projectPath: string) => {
    if (!projectPath) return;
    set({ loading: true, error: null });
    try {
      const status = await api.getGitStatus(projectPath);
      set({ status, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to fetch status", loading: false });
    }
  },

  fetchLog: async (projectPath: string, limit = 50) => {
    if (!projectPath) return;
    set({ loading: true, error: null });
    try {
      const { commits } = await api.getGitLog(projectPath, limit);
      set({ commits, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to fetch log", loading: false });
    }
  },

  fetchBranches: async (projectPath: string) => {
    if (!projectPath) return;
    set({ loading: true, error: null });
    try {
      const { branches, current } = await api.getGitBranches(projectPath);
      set({ branches, currentBranch: current, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to fetch branches", loading: false });
    }
  },

  fetchDiff: async (projectPath: string, file?: string, staged = false) => {
    if (!projectPath) return;
    set({ loading: true, error: null });
    try {
      const { diff } = await api.getGitDiff(projectPath, file, staged);
      set({ diff, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to fetch diff", loading: false });
    }
  },

  stageFiles: async (projectPath: string, files: string[]) => {
    if (!projectPath || !files.length) return false;
    set({ loading: true, error: null });
    try {
      await api.gitAdd(projectPath, files);
      // Refresh status after staging
      await get().fetchStatus(projectPath);
      set({ loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message || "Failed to stage files", loading: false });
      return false;
    }
  },

  unstageFiles: async (projectPath: string, files: string[]) => {
    if (!projectPath || !files.length) return false;
    set({ loading: true, error: null });
    try {
      await api.gitUnstage(projectPath, files);
      await get().fetchStatus(projectPath);
      set({ loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message || "Failed to unstage files", loading: false });
      return false;
    }
  },

  commit: async (projectPath: string, message: string) => {
    if (!projectPath || !message.trim()) return false;
    set({ loading: true, error: null });
    try {
      await api.gitCommit(projectPath, message);
      // Refresh after commit
      await Promise.all([
        get().fetchStatus(projectPath),
        get().fetchLog(projectPath),
      ]);
      set({ loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message || "Failed to commit", loading: false });
      return false;
    }
  },

  checkoutBranch: async (projectPath: string, branch: string, create = false) => {
    if (!projectPath || !branch) return false;
    set({ loading: true, error: null });
    try {
      await api.gitCheckout(projectPath, branch, create);
      await Promise.all([
        get().fetchStatus(projectPath),
        get().fetchBranches(projectPath),
      ]);
      set({ loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message || "Failed to checkout branch", loading: false });
      return false;
    }
  },

  discardChanges: async (projectPath: string, files: string[]) => {
    if (!projectPath || !files.length) return false;
    set({ loading: true, error: null });
    try {
      await api.gitDiscard(projectPath, files);
      await get().fetchStatus(projectPath);
      set({ loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message || "Failed to discard changes", loading: false });
      return false;
    }
  },

  initRepo: async (projectPath: string) => {
    if (!projectPath) return false;
    set({ loading: true, error: null });
    try {
      await api.gitInit(projectPath);
      await get().fetchStatus(projectPath);
      set({ loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message || "Failed to init repository", loading: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
