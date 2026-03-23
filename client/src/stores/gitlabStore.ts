import { create } from "zustand";
import { api } from "../services/api";

export interface GLProject {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  visibility: string;
  star_count: number;
  last_activity_at: string;
  default_branch: string;
  web_url: string;
  avatar_url: string | null;
}

export interface GLGroup {
  id: number;
  name: string;
  full_path: string;
  avatar_url: string | null;
  description: string;
}

export interface GLTreeItem {
  id: string;
  name: string;
  type: "tree" | "blob";
  path: string;
  mode: string;
}

export interface GLCommit {
  id: string;
  short_id: string;
  title: string;
  author_name: string;
  authored_date: string;
  committed_date: string;
  web_url: string;
}

export interface GLPipeline {
  id: number;
  status: string;
  ref: string;
  sha: string;
  created_at: string;
  updated_at: string;
  web_url: string;
}

export interface GLMergeRequest {
  id: number;
  iid: number;
  title: string;
  state: string;
  author: { name: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  web_url: string;
  source_branch: string;
  target_branch: string;
}

export interface GLIssue {
  id: number;
  iid: number;
  title: string;
  state: string;
  author: { name: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  web_url: string;
  labels: string[];
  assignee: { name: string } | null;
}

export interface GLBranch {
  name: string;
  default: boolean;
  merged: boolean;
  protected: boolean;
  commit: { id: string; short_id: string; title: string; committed_date: string };
}

interface GitLabState {
  // Config
  configured: boolean;
  gitlabUrl: string;
  configLoaded: boolean;

  // Navigation
  selectedGroupId: number | null;
  selectedProject: GLProject | null;
  projectTab: "files" | "commits" | "pipelines" | "mr" | "issues";

  // Data
  groups: GLGroup[];
  projects: GLProject[];
  projectSearch: string;
  treeItems: GLTreeItem[];
  treePath: string;
  treeBranch: string;
  branches: GLBranch[];
  commits: GLCommit[];
  pipelines: GLPipeline[];
  mergeRequests: GLMergeRequest[];
  issues: GLIssue[];
  mrFilter: "opened" | "closed" | "merged";
  issueFilter: "opened" | "closed";

  // File viewer
  fileContent: string | null;
  filePath: string | null;

  // Loading
  loading: boolean;
  treeLoading: boolean;
  detailLoading: boolean;
  error: string | null;

  // Actions
  loadConfig: () => Promise<void>;
  saveConfig: (url: string, token: string) => Promise<boolean>;
  loadGroups: () => Promise<void>;
  loadProjects: (search?: string) => Promise<void>;
  selectGroup: (groupId: number | null) => void;
  selectProject: (project: GLProject) => void;
  backToProjects: () => void;
  setProjectTab: (tab: GitLabState["projectTab"]) => void;
  setMrFilter: (f: "opened" | "closed" | "merged") => void;
  setIssueFilter: (f: "opened" | "closed") => void;
  loadTree: (path?: string, ref?: string) => Promise<void>;
  loadBranches: () => Promise<void>;
  loadCommits: (ref?: string) => Promise<void>;
  loadPipelines: () => Promise<void>;
  loadMergeRequests: () => Promise<void>;
  loadIssues: () => Promise<void>;
  loadFile: (filePath: string, ref?: string) => Promise<void>;
  closeFile: () => void;
  clearError: () => void;
  setProjectSearch: (s: string) => void;
}

export const useGitLabStore = create<GitLabState>()((set, get) => ({
  configured: false,
  gitlabUrl: "https://gitlab.com",
  configLoaded: false,
  selectedGroupId: null,
  selectedProject: null,
  projectTab: "files",
  groups: [],
  projects: [],
  projectSearch: "",
  treeItems: [],
  treePath: "",
  treeBranch: "",
  branches: [],
  commits: [],
  pipelines: [],
  mergeRequests: [],
  issues: [],
  mrFilter: "opened",
  issueFilter: "opened",
  fileContent: null,
  filePath: null,
  loading: false,
  treeLoading: false,
  detailLoading: false,
  error: null,

  loadConfig: async () => {
    try {
      const data = await api.getGitLabConfig();
      set({ configured: data.configured, gitlabUrl: data.url, configLoaded: true });
    } catch {
      set({ configLoaded: true });
    }
  },

  saveConfig: async (url, token) => {
    set({ loading: true, error: null });
    try {
      await api.saveGitLabConfig(url, token);
      set({ configured: !!token, gitlabUrl: url, loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  loadGroups: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.getGitLabGroups();
      set({ groups: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  loadProjects: async (search) => {
    const { selectedGroupId } = get();
    set({ loading: true, error: null });
    try {
      const data = await api.getGitLabProjects({
        group_id: selectedGroupId ?? undefined,
        search,
      });
      set({ projects: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  selectGroup: (groupId) => {
    set({ selectedGroupId: groupId, projects: [] });
    get().loadProjects(get().projectSearch);
  },

  selectProject: async (project) => {
    set({
      selectedProject: project,
      projectTab: "files",
      treeItems: [],
      treePath: "",
      treeBranch: project.default_branch || "HEAD",
      branches: [],
      commits: [],
      pipelines: [],
      mergeRequests: [],
      issues: [],
      fileContent: null,
      filePath: null,
    });
    // Load initial data in parallel
    const { loadTree, loadBranches } = get();
    await Promise.all([loadTree("", project.default_branch || "HEAD"), loadBranches()]);
  },

  backToProjects: () => {
    set({ selectedProject: null, fileContent: null, filePath: null });
  },

  setProjectTab: async (tab) => {
    set({ projectTab: tab });
    const { selectedProject, commits, pipelines, mergeRequests, issues } = get();
    if (!selectedProject) return;
    if (tab === "commits" && commits.length === 0) get().loadCommits();
    if (tab === "pipelines" && pipelines.length === 0) get().loadPipelines();
    if (tab === "mr" && mergeRequests.length === 0) get().loadMergeRequests();
    if (tab === "issues" && issues.length === 0) get().loadIssues();
  },

  setMrFilter: (f) => {
    set({ mrFilter: f, mergeRequests: [] });
    get().loadMergeRequests();
  },

  setIssueFilter: (f) => {
    set({ issueFilter: f, issues: [] });
    get().loadIssues();
  },

  loadTree: async (path = "", ref) => {
    const { selectedProject, treeBranch } = get();
    if (!selectedProject) return;
    set({ treeLoading: true, error: null });
    try {
      const usedRef = ref ?? treeBranch ?? selectedProject.default_branch ?? "HEAD";
      const data = await api.getGitLabTree(selectedProject.id, path, usedRef);
      const sorted = [...data].sort((a, b) => {
        if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      set({ treeItems: sorted, treePath: path, treeBranch: usedRef, treeLoading: false });
    } catch (err: any) {
      set({ error: err.message, treeLoading: false });
    }
  },

  loadBranches: async () => {
    const { selectedProject } = get();
    if (!selectedProject) return;
    try {
      const data = await api.getGitLabBranches(selectedProject.id);
      set({ branches: data });
    } catch {
      // non-critical
    }
  },

  loadCommits: async (ref) => {
    const { selectedProject, treeBranch } = get();
    if (!selectedProject) return;
    set({ detailLoading: true });
    try {
      const data = await api.getGitLabCommits(selectedProject.id, ref ?? treeBranch ?? "HEAD");
      set({ commits: data, detailLoading: false });
    } catch (err: any) {
      set({ error: err.message, detailLoading: false });
    }
  },

  loadPipelines: async () => {
    const { selectedProject } = get();
    if (!selectedProject) return;
    set({ detailLoading: true });
    try {
      const data = await api.getGitLabPipelines(selectedProject.id);
      set({ pipelines: data, detailLoading: false });
    } catch (err: any) {
      set({ error: err.message, detailLoading: false });
    }
  },

  loadMergeRequests: async () => {
    const { selectedProject, mrFilter } = get();
    if (!selectedProject) return;
    set({ detailLoading: true });
    try {
      const data = await api.getGitLabMergeRequests(selectedProject.id, mrFilter);
      set({ mergeRequests: data, detailLoading: false });
    } catch (err: any) {
      set({ error: err.message, detailLoading: false });
    }
  },

  loadIssues: async () => {
    const { selectedProject, issueFilter } = get();
    if (!selectedProject) return;
    set({ detailLoading: true });
    try {
      const data = await api.getGitLabIssues(selectedProject.id, issueFilter);
      set({ issues: data, detailLoading: false });
    } catch (err: any) {
      set({ error: err.message, detailLoading: false });
    }
  },

  loadFile: async (filePath, ref) => {
    const { selectedProject, treeBranch } = get();
    if (!selectedProject) return;
    set({ treeLoading: true, error: null });
    try {
      const data = await api.getGitLabFile(selectedProject.id, filePath, ref ?? treeBranch ?? "HEAD");
      set({ fileContent: data.decodedContent ?? data.content ?? "", filePath, treeLoading: false });
    } catch (err: any) {
      set({ error: err.message, treeLoading: false });
    }
  },

  closeFile: () => set({ fileContent: null, filePath: null }),

  clearError: () => set({ error: null }),

  setProjectSearch: (s) => set({ projectSearch: s }),
}));
