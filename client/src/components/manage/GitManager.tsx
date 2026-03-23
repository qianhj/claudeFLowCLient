import { useEffect, useState, useCallback } from "react";
import {
  GitBranch,
  GitCommit,
  GitMerge,
  Plus,
  RotateCcw,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileMinus,
  FileText,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useGitStore } from "../../stores/gitStore";
import { useUIStore } from "../../stores/uiStore";
import DiffViewer from "../ide/DiffViewer";

export default function GitManager() {
  const { projectPath } = useUIStore();
  const {
    status,
    commits,
    branches,
    currentBranch,
    loading,
    error,
    fetchStatus,
    fetchLog,
    fetchBranches,
    stageFiles,
    unstageFiles,
    commit,
    checkoutBranch,
    discardChanges,
    initRepo,
    clearError,
  } = useGitStore();

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [commitMessage, setCommitMessage] = useState("");
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [activeTab, setActiveTab] = useState<"changes" | "history" | "branches">("changes");
  const [viewingDiff, setViewingDiff] = useState<{ file: string; staged: boolean } | null>(null);
  const [diffContent, setDiffContent] = useState("");

  // Load data when project changes
  useEffect(() => {
    if (projectPath) {
      refresh();
    }
  }, [projectPath]);

  const refresh = useCallback(() => {
    if (!projectPath) return;
    fetchStatus(projectPath);
    fetchLog(projectPath, 20);
    fetchBranches(projectPath);
  }, [projectPath, fetchStatus, fetchLog, fetchBranches]);

  // Handle file selection
  const toggleFileSelection = (file: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  };

  const selectAll = (files: string[]) => {
    setSelectedFiles(new Set(files));
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  // Stage/unstage files
  const handleStage = async () => {
    if (!projectPath || selectedFiles.size === 0) return;
    const files = Array.from(selectedFiles);
    const success = await stageFiles(projectPath, files);
    if (success) {
      clearSelection();
    }
  };

  const handleUnstage = async () => {
    if (!projectPath || selectedFiles.size === 0) return;
    const files = Array.from(selectedFiles);
    const success = await unstageFiles(projectPath, files);
    if (success) {
      clearSelection();
    }
  };

  // Commit
  const handleCommit = async () => {
    if (!projectPath || !commitMessage.trim()) return;
    const success = await commit(projectPath, commitMessage);
    if (success) {
      setCommitMessage("");
      clearSelection();
    }
  };

  // Discard changes
  const handleDiscard = async () => {
    if (!projectPath || selectedFiles.size === 0) return;
    if (!confirm(`确定要放弃 ${selectedFiles.size} 个文件的更改吗？此操作不可恢复。`)) return;
    const files = Array.from(selectedFiles);
    const success = await discardChanges(projectPath, files);
    if (success) {
      clearSelection();
    }
  };

  // Create/checkout branch
  const handleCreateBranch = async () => {
    if (!projectPath || !newBranchName.trim()) return;
    const success = await checkoutBranch(projectPath, newBranchName.trim(), true);
    if (success) {
      setNewBranchName("");
      setShowNewBranch(false);
    }
  };

  const handleCheckoutBranch = async (branchName: string) => {
    if (!projectPath) return;
    await checkoutBranch(projectPath, branchName, false);
  };

  // View diff
  const handleViewDiff = async (file: string, staged: boolean) => {
    if (!projectPath) return;
    setViewingDiff({ file, staged });
    const { api } = await import("../../services/api");
    const { diff } = await api.getGitDiff(projectPath, file, staged);
    setDiffContent(diff);
  };

  // Initialize repo
  const handleInit = async () => {
    if (!projectPath) return;
    if (!confirm("确定要在此目录初始化 Git 仓库吗？")) return;
    await initRepo(projectPath);
  };

  if (!projectPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <GitBranch size={48} className="mb-4 opacity-50" />
        <p>请先选择项目目录</p>
      </div>
    );
  }

  if (!status?.isRepo) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <GitBranch size={48} className="mb-4 text-slate-500 opacity-50" />
        <p className="text-slate-400 mb-2 text-center">当前项目不是 Git 仓库</p>
        {status?.reason && (
          <p className="text-xs text-slate-600 mb-4 text-center break-all px-2">{status.reason}</p>
        )}
        {status?.checkedPath && (
          <p className="text-[10px] text-slate-700 mb-4 font-mono break-all px-2">路径：{status.checkedPath}</p>
        )}
        <button
          onClick={handleInit}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-glow/20 text-purple-bright hover:bg-purple-glow/30 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          初始化 Git 仓库
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <GitBranch size={18} className="text-purple-glow" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{status.branch}</span>
              {status.ahead > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-ok/20 text-emerald-ok">
                  ↑{status.ahead}
                </span>
              )}
              {status.behind > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-glow/20 text-amber-glow">
                  ↓{status.behind}
                </span>
              )}
            </div>
            {status.isClean ? (
              <span className="text-[10px] text-emerald-ok">工作区干净</span>
            ) : (
              <span className="text-[10px] text-amber-glow">有未提交的更改</span>
            )}
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          title="刷新"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {[
          { id: "changes", label: "更改", count: status.modified.length + status.staged.length + status.untracked.length },
          { id: "history", label: "历史", count: commits.length },
          { id: "branches", label: "分支", count: branches.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "text-white border-b-2 border-purple-glow"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.id ? "bg-white/10" : "bg-white/5"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mt-2 p-2 rounded-lg bg-rose-err/10 border border-rose-err/20 text-xs text-rose-err flex items-start gap-2">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "changes" && (
          <ChangesPanel
            status={status}
            selectedFiles={selectedFiles}
            onToggleFile={toggleFileSelection}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onStage={handleStage}
            onUnstage={handleUnstage}
            onDiscard={handleDiscard}
            onViewDiff={handleViewDiff}
            commitMessage={commitMessage}
            onCommitMessageChange={setCommitMessage}
            onCommit={handleCommit}
            loading={loading}
          />
        )}
        {activeTab === "history" && <HistoryPanel commits={commits} />}
        {activeTab === "branches" && (
          <BranchesPanel
            branches={branches}
            currentBranch={currentBranch}
            onCheckout={handleCheckoutBranch}
            onCreateBranch={handleCreateBranch}
            showNewBranch={showNewBranch}
            setShowNewBranch={setShowNewBranch}
            newBranchName={newBranchName}
            setNewBranchName={setNewBranchName}
            loading={loading}
          />
        )}
      </div>

      {/* Diff Modal */}
      {viewingDiff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-4xl h-[80vh] bg-obsidian-900 rounded-xl border border-white/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{viewingDiff.file}</span>
                {viewingDiff.staged && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-ok/20 text-emerald-ok">已暂存</span>
                )}
              </div>
              <button
                onClick={() => {
                  setViewingDiff(null);
                  setDiffContent("");
                }}
                className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {diffContent ? (
                <pre className="text-xs font-mono text-slate-300 whitespace-pre">{diffContent}</pre>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <Loader2 size={24} className="animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Changes Panel ──
interface ChangesPanelProps {
  status: {
    modified: string[];
    staged: string[];
    untracked: string[];
    conflicted: string[];
    isClean: boolean;
  };
  selectedFiles: Set<string>;
  onToggleFile: (file: string) => void;
  onSelectAll: (files: string[]) => void;
  onClearSelection: () => void;
  onStage: () => void;
  onUnstage: () => void;
  onDiscard: () => void;
  onViewDiff: (file: string, staged: boolean) => void;
  commitMessage: string;
  onCommitMessageChange: (msg: string) => void;
  onCommit: () => void;
  loading: boolean;
}

function ChangesPanel({
  status,
  selectedFiles,
  onToggleFile,
  onSelectAll,
  onClearSelection,
  onStage,
  onUnstage,
  onDiscard,
  onViewDiff,
  commitMessage,
  onCommitMessageChange,
  onCommit,
  loading,
}: ChangesPanelProps) {
  const unstagedFiles = [...status.modified, ...status.untracked, ...status.conflicted];
  const hasStaged = status.staged.length > 0;
  const hasUnstaged = unstagedFiles.length > 0;
  const hasSelection = selectedFiles.size > 0;

  return (
    <div className="p-3 space-y-4">
      {/* Staged files */}
      {hasStaged && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Check size={14} className="text-emerald-ok" />
              <span className="text-xs font-medium text-emerald-ok">已暂存 ({status.staged.length})</span>
            </div>
            {hasSelection && Array.from(selectedFiles).some((f) => status.staged.includes(f)) && (
              <button
                onClick={onUnstage}
                disabled={loading}
                className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
              >
                取消暂存
              </button>
            )}
          </div>
          <div className="space-y-1">
            {status.staged.map((file) => (
              <FileItem
                key={file}
                file={file}
                status="staged"
                selected={selectedFiles.has(file)}
                onToggle={() => onToggleFile(file)}
                onViewDiff={() => onViewDiff(file, true)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unstaged files */}
      {hasUnstaged && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-glow" />
              <span className="text-xs font-medium text-amber-glow">未暂存 ({unstagedFiles.length})</span>
            </div>
            {hasSelection && Array.from(selectedFiles).some((f) => unstagedFiles.includes(f)) && (
              <div className="flex items-center gap-1">
                <button
                  onClick={onStage}
                  disabled={loading}
                  className="text-[10px] px-2 py-1 rounded bg-emerald-ok/20 hover:bg-emerald-ok/30 text-emerald-ok transition-colors"
                >
                  暂存
                </button>
                <button
                  onClick={onDiscard}
                  disabled={loading}
                  className="text-[10px] px-2 py-1 rounded bg-rose-err/20 hover:bg-rose-err/30 text-rose-err transition-colors"
                >
                  放弃
                </button>
              </div>
            )}
          </div>
          <div className="space-y-1">
            {status.modified.map((file) => (
              <FileItem
                key={file}
                file={file}
                status="modified"
                selected={selectedFiles.has(file)}
                onToggle={() => onToggleFile(file)}
                onViewDiff={() => onViewDiff(file, false)}
              />
            ))}
            {status.untracked.map((file) => (
              <FileItem
                key={file}
                file={file}
                status="untracked"
                selected={selectedFiles.has(file)}
                onToggle={() => onToggleFile(file)}
              />
            ))}
            {status.conflicted.map((file) => (
              <FileItem
                key={file}
                file={file}
                status="conflicted"
                selected={selectedFiles.has(file)}
                onToggle={() => onToggleFile(file)}
              />
            ))}
          </div>
        </div>
      )}

      {/* No changes */}
      {status.isClean && (
        <div className="text-center py-8 text-slate-500">
          <Check size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">没有要提交的更改</p>
        </div>
      )}

      {/* Commit message */}
      {hasStaged && (
        <div className="pt-2 border-t border-white/5">
          <textarea
            value={commitMessage}
            onChange={(e) => onCommitMessageChange(e.target.value)}
            placeholder="输入提交信息..."
            className="w-full px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-glow/40 resize-none"
            rows={2}
          />
          <button
            onClick={onCommit}
            disabled={!commitMessage.trim() || loading}
            className="w-full mt-2 px-3 py-2 text-xs font-medium rounded-lg bg-purple-glow/20 text-purple-bright hover:bg-purple-glow/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 size={14} className="inline animate-spin mr-1" /> : null}
            提交
          </button>
        </div>
      )}
    </div>
  );
}

// ── File Item ──
function FileItem({
  file,
  status,
  selected,
  onToggle,
  onViewDiff,
}: {
  file: string;
  status: "staged" | "modified" | "untracked" | "conflicted";
  selected: boolean;
  onToggle: () => void;
  onViewDiff?: () => void;
}) {
  const icons = {
    staged: <Check size={12} className="text-emerald-ok" />,
    modified: <RotateCcw size={12} className="text-amber-glow" />,
    untracked: <Plus size={12} className="text-slate-400" />,
    conflicted: <AlertCircle size={12} className="text-rose-err" />,
  };

  const labels = {
    staged: "已暂存",
    modified: "已修改",
    untracked: "未跟踪",
    conflicted: "冲突",
  };

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
        selected ? "bg-purple-glow/10" : "hover:bg-white/5"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-purple-glow focus:ring-purple-glow/50"
      />
      <span className="flex-shrink-0">{icons[status]}</span>
      <span className="flex-1 truncate text-slate-300" title={file}>{file}</span>
      <span className={`text-[10px] ${
        status === "staged" ? "text-emerald-ok" :
        status === "modified" ? "text-amber-glow" :
        status === "conflicted" ? "text-rose-err" : "text-slate-500"
      }`}>
        {labels[status]}
      </span>
      {onViewDiff && (
        <button
          onClick={onViewDiff}
          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
          title="查看差异"
        >
          <FileText size={12} />
        </button>
      )}
    </div>
  );
}

// ── History Panel ──
function HistoryPanel({ commits }: { commits: import("../../stores/gitStore").GitCommit[] }) {
  if (commits.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <GitCommit size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂无提交历史</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {commits.map((commit) => (
        <div
          key={commit.hash}
          className="px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-glow/20 flex items-center justify-center">
              <GitCommit size={12} className="text-purple-glow" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate" title={commit.message}>
                {commit.message}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
                  {commit.shortHash}
                </span>
                <span className="text-[10px] text-slate-500">{commit.author}</span>
                <span className="text-[10px] text-slate-600">{commit.relativeDate}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Branches Panel ──
interface BranchesPanelProps {
  branches: import("../../stores/gitStore").GitBranch[];
  currentBranch: string | null;
  onCheckout: (branch: string) => void;
  onCreateBranch: () => void;
  showNewBranch: boolean;
  setShowNewBranch: (show: boolean) => void;
  newBranchName: string;
  setNewBranchName: (name: string) => void;
  loading: boolean;
}

function BranchesPanel({
  branches,
  currentBranch,
  onCheckout,
  onCreateBranch,
  showNewBranch,
  setShowNewBranch,
  newBranchName,
  setNewBranchName,
  loading,
}: BranchesPanelProps) {
  const localBranches = branches.filter((b) => !b.isRemote);

  return (
    <div className="p-3">
      {/* New branch button */}
      <button
        onClick={() => setShowNewBranch(!showNewBranch)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-lg border border-dashed border-white/20 text-slate-400 hover:text-white hover:border-white/40 transition-colors mb-3"
      >
        <Plus size={14} />
        新建分支
      </button>

      {/* New branch input */}
      {showNewBranch && (
        <div className="mb-3 flex items-center gap-2">
          <input
            type="text"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            placeholder="分支名称"
            className="flex-1 px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-glow/40"
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreateBranch();
              if (e.key === "Escape") setShowNewBranch(false);
            }}
          />
          <button
            onClick={onCreateBranch}
            disabled={!newBranchName.trim() || loading}
            className="p-2 rounded-lg bg-emerald-ok/20 text-emerald-ok hover:bg-emerald-ok/30 disabled:opacity-50 transition-colors"
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => setShowNewBranch(false)}
            className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Branch list */}
      <div className="space-y-1">
        {localBranches.map((branch) => (
          <div
            key={branch.name}
            className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
              branch.isCurrent ? "bg-purple-glow/10 border border-purple-glow/20" : "hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-2">
              <GitBranch size={14} className={branch.isCurrent ? "text-purple-glow" : "text-slate-500"} />
              <span className={`text-xs ${branch.isCurrent ? "text-white font-medium" : "text-slate-300"}`}>
                {branch.name}
              </span>
              {branch.isCurrent && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-glow/20 text-purple-bright">
                  当前
                </span>
              )}
            </div>
            {!branch.isCurrent && (
              <button
                onClick={() => onCheckout(branch.name)}
                disabled={loading}
                className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition-colors opacity-0 group-hover:opacity-100"
              >
                切换
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
