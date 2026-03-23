import { create } from "zustand";
import type { FileNode, FileContent } from "../types/file";
import { api } from "../services/api";

interface OpenFile {
  path: string;
  content: FileContent | null;
  loading: boolean;
  error: string | null;
  dirty?: boolean; // unsaved changes
}

interface FileState {
  tree: FileNode | null;
  treeLoading: boolean;
  // Multi-tab editor state
  openFiles: OpenFile[];
  activeFilePath: string | null;
  modifiedFiles: Set<string>;
  searchQuery: string;
  searchResults: { path: string; type: string }[];

  loadTree: (projectPath: string) => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  switchFile: (filePath: string) => void;
  closeFile: (filePath: string) => void;
  closeAllFiles: () => void;
  closeOtherFiles: (keepPath: string) => void;
  updateFileContent: (filePath: string, content: string) => void;
  markFileDirty: (filePath: string, dirty: boolean) => void;
  markFileModified: (filePath: string) => void;
  searchFiles: (projectPath: string, query: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  tree: null,
  treeLoading: false,
  openFiles: [],
  activeFilePath: null,
  modifiedFiles: new Set(),
  searchQuery: "",
  searchResults: [],

  loadTree: async (projectPath) => {
    set({ treeLoading: true, tree: null });
    try {
      const tree = await api.getFileTree(projectPath);
      set({ tree, treeLoading: false });
    } catch {
      set({ treeLoading: false });
    }
  },

  openFile: async (filePath) => {
    const { openFiles } = get();

    // Check if already open
    const existing = openFiles.find(f => f.path === filePath);
    if (existing) {
      set({ activeFilePath: filePath });
      return;
    }

    // Add to list with loading state
    const newFile: OpenFile = {
      path: filePath,
      content: null,
      loading: true,
      error: null,
    };
    set({
      openFiles: [...openFiles, newFile],
      activeFilePath: filePath
    });

    // Load content
    try {
      const content = await api.getFileContent(filePath);
      set(state => ({
        openFiles: state.openFiles.map(f =>
          f.path === filePath
            ? { ...f, content, loading: false }
            : f
        )
      }));
    } catch (err) {
      set(state => ({
        openFiles: state.openFiles.map(f =>
          f.path === filePath
            ? { ...f, error: String(err), loading: false }
            : f
        )
      }));
    }
  },

  switchFile: (filePath) => {
    set({ activeFilePath: filePath });
  },

  closeFile: (filePath) => {
    const { openFiles, activeFilePath } = get();
    const newFiles = openFiles.filter(f => f.path !== filePath);

    // If closing active file, switch to another
    let newActive = activeFilePath;
    if (activeFilePath === filePath) {
      const idx = openFiles.findIndex(f => f.path === filePath);
      // Try previous tab, then next tab
      const fallback = openFiles[idx - 1] || openFiles[idx + 1];
      newActive = fallback?.path || null;
    }

    set({ openFiles: newFiles, activeFilePath: newActive });
  },

  closeAllFiles: () => {
    set({ openFiles: [], activeFilePath: null });
  },

  closeOtherFiles: (keepPath) => {
    const { openFiles } = get();
    set({
      openFiles: openFiles.filter(f => f.path === keepPath),
      activeFilePath: keepPath
    });
  },

  updateFileContent: (filePath, content) => {
    set(state => ({
      openFiles: state.openFiles.map(f =>
        f.path === filePath && f.content
          ? { ...f, content: { ...f.content, content } }
          : f
      )
    }));
  },

  markFileDirty: (filePath, dirty) => {
    set(state => ({
      openFiles: state.openFiles.map(f =>
        f.path === filePath ? { ...f, dirty } : f
      )
    }));
  },

  markFileModified: (filePath) => {
    const modified = new Set(get().modifiedFiles);
    modified.add(filePath);
    set({ modifiedFiles: modified });
  },

  searchFiles: async (projectPath, query) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    try {
      const { results } = await api.searchFiles(projectPath, query);
      set({ searchResults: results });
    } catch {
      set({ searchResults: [] });
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
}));
