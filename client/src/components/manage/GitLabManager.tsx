import { useEffect, useState } from "react";
import {
  GitBranch, Folder, FileText, ChevronLeft, ChevronRight,
  RefreshCw, Search, ExternalLink, Loader2, AlertCircle, X,
  CheckCircle, XCircle, Clock, Play, GitMerge, CircleDot, Tag,
  Eye, EyeOff, Settings, User, Star, Calendar,
} from "lucide-react";
import { useGitLabStore } from "../../stores/gitlabStore";

export default function GitLabManager() {
  const {
    configured, configLoaded, selectedProject, loadConfig,
    error, clearError,
  } = useGitLabStore();

  useEffect(() => {
    if (!configLoaded) loadConfig();
  }, [configLoaded, loadConfig]);

  if (!configLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {error && (
        <div className="mx-3 mt-2 p-2 rounded-lg bg-rose-err/10 border border-rose-err/20 text-xs text-rose-err flex items-start gap-2 flex-shrink-0">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <span className="flex-1 break-all">{error}</span>
          <button onClick={clearError} className="text-slate-400 hover:text-white flex-shrink-0">
            <X size={13} />
          </button>
        </div>
      )}

      {!configured ? (
        <SetupView />
      ) : selectedProject ? (
        <ProjectDetailView />
      ) : (
        <ProjectsView />
      )}
    </div>
  );
}

// ── Setup View ──
function SetupView() {
  const { saveConfig, loading, gitlabUrl } = useGitLabStore();
  const [url, setUrl] = useState(gitlabUrl || "https://gitlab.com");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const handleSave = async () => {
    if (!token.trim()) return;
    await saveConfig(url.trim(), token.trim());
  };

  return (
    <div className="flex flex-col gap-4 p-4 flex-1">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
          <GitBranch size={15} className="text-orange-400" />
        </div>
        <div>
          <div className="text-sm font-medium text-white">连接 GitLab</div>
          <div className="text-[10px] text-slate-500">配置访问令牌以浏览工程目录</div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">GitLab URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://gitlab.com"
            className="w-full px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-glow/40"
          />
          <p className="text-[10px] text-slate-600 mt-1">自托管实例填写完整 URL，如 https://gitlab.example.com</p>
        </div>

        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Personal Access Token</label>
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 pr-8 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-glow/40"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
            >
              {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-1">
            需要 read_api 权限。在 GitLab → User Settings → Access Tokens 创建。
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!token.trim() || loading}
        className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Settings size={13} />}
        保存并连接
      </button>
    </div>
  );
}

// ── Projects View ──
function ProjectsView() {
  const {
    groups, projects, selectedGroupId, projectSearch, loading,
    loadGroups, loadProjects, selectGroup, selectProject, setProjectSearch,
    configured, saveConfig,
  } = useGitLabStore();
  const [searchInput, setSearchInput] = useState(projectSearch);
  const [showSettings, setShowSettings] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newToken, setNewToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const { gitlabUrl } = useGitLabStore();

  useEffect(() => {
    if (groups.length === 0) loadGroups();
    if (projects.length === 0) loadProjects();
  }, []);

  const handleSearch = (v: string) => {
    setSearchInput(v);
    setProjectSearch(v);
    loadProjects(v || undefined);
  };

  const handleGroupChange = (gid: number | null) => {
    selectGroup(gid);
  };

  const handleSaveSettings = async () => {
    if (await saveConfig(newUrl || gitlabUrl, newToken)) {
      setShowSettings(false);
      setNewToken("");
      loadProjects();
      loadGroups();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-orange-500/20 flex items-center justify-center">
            <GitBranch size={12} className="text-orange-400" />
          </div>
          <span className="text-xs font-medium text-white">GitLab</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { loadGroups(); loadProjects(searchInput || undefined); }}
            disabled={loading}
            className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            title="刷新"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => { setShowSettings(!showSettings); setNewUrl(gitlabUrl); setNewToken(""); }}
            className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            title="重新配置"
          >
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* Settings inline panel */}
      {showSettings && (
        <div className="p-3 border-b border-white/5 bg-white/3 flex-shrink-0 space-y-2">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="GitLab URL"
            className="w-full px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-glow/40"
          />
          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              placeholder="新的 Personal Access Token（留空保持不变）"
              className="w-full px-2 py-1.5 pr-7 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-glow/40"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1.5 text-slate-500 hover:text-slate-300"
            >
              {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveSettings}
              className="flex-1 px-2 py-1.5 text-[11px] rounded bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 transition-colors"
            >
              保存
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="flex-1 px-2 py-1.5 text-[11px] rounded bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-3 py-2 flex-shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-2 text-slate-500" />
          <input
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索工程..."
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-white/5 border border-white/5 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-glow/40"
          />
          {searchInput && (
            <button onClick={() => handleSearch("")} className="absolute right-2 top-2 text-slate-400 hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Group filter */}
      <div className="px-3 pb-2 flex-shrink-0">
        <select
          value={selectedGroupId ?? ""}
          onChange={(e) => handleGroupChange(e.target.value ? Number(e.target.value) : null)}
          className="w-full px-2 py-1.5 text-xs bg-white/5 border border-white/5 rounded-lg text-slate-300 focus:outline-none focus:border-purple-glow/40 appearance-none"
        >
          <option value="">所有工程（我参与的）</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.full_path}</option>
          ))}
        </select>
      </div>

      {/* Projects list */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-2 space-y-1">
        {loading && projects.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-slate-500" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">无工程</div>
        ) : (
          projects.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProject(p)}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded bg-orange-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-5 h-5 rounded" />
                  ) : (
                    <Folder size={12} className="text-orange-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-slate-200 truncate flex-1">{p.name}</span>
                    {p.visibility === "private" && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-slate-500 flex-shrink-0">私有</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{p.path_with_namespace}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
                      <Star size={9} />
                      {p.star_count}
                    </span>
                    <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
                      <Calendar size={9} />
                      {new Date(p.last_activity_at).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                </div>
                <ChevronRight size={12} className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-1" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Project Detail View ──
function ProjectDetailView() {
  const {
    selectedProject, projectTab, setProjectTab, backToProjects, treeBranch,
    branches, loadBranches, loadTree,
  } = useGitLabStore();

  if (!selectedProject) return null;

  const tabs: { id: typeof projectTab; label: string }[] = [
    { id: "files", label: "文件" },
    { id: "commits", label: "提交" },
    { id: "pipelines", label: "流水线" },
    { id: "mr", label: "MR" },
    { id: "issues", label: "Issues" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Project header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 flex-shrink-0">
        <button
          onClick={backToProjects}
          className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          title="返回工程列表"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-white truncate">{selectedProject.name}</div>
          <div className="text-[10px] text-slate-500 truncate">{selectedProject.path_with_namespace}</div>
        </div>
        <a
          href={selectedProject.web_url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          title="在 GitLab 中打开"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Branch selector (for files + commits) */}
      {(projectTab === "files" || projectTab === "commits") && branches.length > 0 && (
        <div className="px-3 py-1.5 border-b border-white/5 flex-shrink-0">
          <select
            value={treeBranch}
            onChange={(e) => {
              if (projectTab === "files") loadTree("", e.target.value);
            }}
            className="w-full px-2 py-1 text-[11px] bg-white/5 border border-white/5 rounded-md text-slate-300 focus:outline-none focus:border-purple-glow/40 appearance-none"
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}{b.default ? " (default)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/5 flex-shrink-0 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setProjectTab(t.id)}
            className={`px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              projectTab === t.id
                ? "text-white border-b-2 border-orange-400"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {projectTab === "files" && <FilesTab />}
        {projectTab === "commits" && <CommitsTab />}
        {projectTab === "pipelines" && <PipelinesTab />}
        {projectTab === "mr" && <MergeRequestsTab />}
        {projectTab === "issues" && <IssuesTab />}
      </div>
    </div>
  );
}

// ── Files Tab ──
function FilesTab() {
  const {
    treeItems, treePath, treeLoading, fileContent, filePath,
    loadTree, loadFile, closeFile, selectedProject,
  } = useGitLabStore();

  const pathParts = treePath ? treePath.split("/") : [];

  if (fileContent !== null) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 flex-shrink-0">
          <button
            onClick={closeFile}
            className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-[11px] text-slate-300 truncate flex-1">{filePath}</span>
          {selectedProject && (
            <a
              href={`${selectedProject.web_url}/-/blob/${useGitLabStore.getState().treeBranch}/${filePath}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
        <div className="flex-1 overflow-auto p-3">
          <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-all leading-relaxed">
            {fileContent}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Breadcrumb */}
      {treePath && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/5 flex-shrink-0 flex-wrap">
          <button
            onClick={() => loadTree("")}
            className="text-[10px] text-orange-400 hover:text-orange-300 transition-colors"
          >
            根目录
          </button>
          {pathParts.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-[10px] text-slate-600">/</span>
              <button
                onClick={() => loadTree(pathParts.slice(0, i + 1).join("/"))}
                className="text-[10px] text-orange-400 hover:text-orange-300 transition-colors"
              >
                {part}
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 p-1">
        {treeLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-slate-500" />
          </div>
        ) : treeItems.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">空目录</div>
        ) : (
          <div className="space-y-0.5">
            {treePath && (
              <button
                onClick={() => {
                  const parent = pathParts.slice(0, -1).join("/");
                  loadTree(parent);
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs text-slate-400 hover:bg-white/5 transition-colors"
              >
                <Folder size={13} className="text-slate-500" />
                <span>..</span>
              </button>
            )}
            {treeItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.type === "tree") loadTree(item.path);
                  else loadFile(item.path);
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-white/5 transition-colors text-left"
              >
                {item.type === "tree" ? (
                  <Folder size={13} className="text-orange-400 flex-shrink-0" />
                ) : (
                  <FileText size={13} className="text-slate-400 flex-shrink-0" />
                )}
                <span className={`truncate ${item.type === "tree" ? "text-slate-200" : "text-slate-300"}`}>
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Commits Tab ──
function CommitsTab() {
  const { commits, detailLoading, loadCommits } = useGitLabStore();

  useEffect(() => {
    if (commits.length === 0) loadCommits();
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <span className="text-[11px] text-slate-400">提交历史</span>
        <button
          onClick={() => loadCommits()}
          disabled={detailLoading}
          className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white"
        >
          <RefreshCw size={12} className={detailLoading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
        {detailLoading && commits.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-slate-500" />
          </div>
        ) : commits.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">无提交记录</div>
        ) : (
          commits.map((c) => (
            <a
              key={c.id}
              href={c.web_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group block"
            >
              <div className="w-5 h-5 rounded-full bg-purple-glow/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <GitBranch size={10} className="text-purple-glow" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-slate-200 truncate">{c.title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-white/5 text-slate-400">{c.short_id}</span>
                  <span className="text-[10px] text-slate-500">{c.author_name}</span>
                  <span className="text-[10px] text-slate-600">
                    {new Date(c.authored_date).toLocaleDateString("zh-CN")}
                  </span>
                </div>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}

// ── Pipelines Tab ──
const PIPELINE_STATUS: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  success: { icon: <CheckCircle size={12} />, color: "text-emerald-ok", label: "成功" },
  failed: { icon: <XCircle size={12} />, color: "text-rose-err", label: "失败" },
  running: { icon: <Loader2 size={12} className="animate-spin" />, color: "text-blue-400", label: "运行中" },
  pending: { icon: <Clock size={12} />, color: "text-amber-glow", label: "等待" },
  canceled: { icon: <X size={12} />, color: "text-slate-400", label: "已取消" },
  skipped: { icon: <Play size={12} />, color: "text-slate-500", label: "已跳过" },
};

function PipelinesTab() {
  const { pipelines, detailLoading, loadPipelines } = useGitLabStore();

  useEffect(() => {
    if (pipelines.length === 0) loadPipelines();
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <span className="text-[11px] text-slate-400">CI/CD 流水线</span>
        <button
          onClick={loadPipelines}
          disabled={detailLoading}
          className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white"
        >
          <RefreshCw size={12} className={detailLoading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
        {detailLoading && pipelines.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-slate-500" />
          </div>
        ) : pipelines.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">无流水线记录</div>
        ) : (
          pipelines.map((p) => {
            const st = PIPELINE_STATUS[p.status] ?? { icon: <Clock size={12} />, color: "text-slate-400", label: p.status };
            return (
              <a
                key={p.id}
                href={p.web_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <span className={st.color}>{st.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-200 font-mono">#{p.id}</span>
                    <span className={`text-[10px] ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <GitBranch size={9} />
                      {p.ref}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {new Date(p.created_at).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                </div>
                <ExternalLink size={10} className="text-slate-600 flex-shrink-0" />
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Merge Requests Tab ──
function MergeRequestsTab() {
  const { mergeRequests, mrFilter, detailLoading, setMrFilter, loadMergeRequests } = useGitLabStore();

  useEffect(() => {
    if (mergeRequests.length === 0) loadMergeRequests();
  }, []);

  const filterOpts: { id: typeof mrFilter; label: string }[] = [
    { id: "opened", label: "开放" },
    { id: "merged", label: "已合并" },
    { id: "closed", label: "已关闭" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 flex-shrink-0">
        {filterOpts.map((f) => (
          <button
            key={f.id}
            onClick={() => setMrFilter(f.id)}
            className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
              mrFilter === f.id
                ? "bg-orange-500/20 text-orange-300"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={loadMergeRequests}
          disabled={detailLoading}
          className="ml-auto p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white"
        >
          <RefreshCw size={12} className={detailLoading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
        {detailLoading && mergeRequests.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-slate-500" />
          </div>
        ) : mergeRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">无 Merge Request</div>
        ) : (
          mergeRequests.map((mr) => (
            <a
              key={mr.id}
              href={mr.web_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="flex items-start gap-2">
                <GitMerge size={13} className={
                  mr.state === "merged" ? "text-purple-glow" :
                  mr.state === "opened" ? "text-emerald-ok" : "text-slate-500"
                } />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-slate-200 truncate">
                    <span className="text-slate-500 mr-1">!{mr.iid}</span>
                    {mr.title}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                      <User size={9} />
                      {mr.author.name}
                    </span>
                    <span className="text-[10px] text-slate-600 flex items-center gap-1">
                      <GitBranch size={9} />
                      {mr.source_branch} → {mr.target_branch}
                    </span>
                  </div>
                </div>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}

// ── Issues Tab ──
function IssuesTab() {
  const { issues, issueFilter, detailLoading, setIssueFilter, loadIssues } = useGitLabStore();

  useEffect(() => {
    if (issues.length === 0) loadIssues();
  }, []);

  const filterOpts: { id: typeof issueFilter; label: string }[] = [
    { id: "opened", label: "开放" },
    { id: "closed", label: "已关闭" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 flex-shrink-0">
        {filterOpts.map((f) => (
          <button
            key={f.id}
            onClick={() => setIssueFilter(f.id)}
            className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
              issueFilter === f.id
                ? "bg-orange-500/20 text-orange-300"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={loadIssues}
          disabled={detailLoading}
          className="ml-auto p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white"
        >
          <RefreshCw size={12} className={detailLoading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
        {detailLoading && issues.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-slate-500" />
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">无 Issue</div>
        ) : (
          issues.map((issue) => (
            <a
              key={issue.id}
              href={issue.web_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="flex items-start gap-2">
                <CircleDot size={13} className={issue.state === "opened" ? "text-emerald-ok" : "text-slate-500"} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-slate-200 truncate">
                    <span className="text-slate-500 mr-1">#{issue.iid}</span>
                    {issue.title}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                      <User size={9} />
                      {issue.author.name}
                    </span>
                    {issue.assignee && (
                      <span className="text-[10px] text-slate-500">→ {issue.assignee.name}</span>
                    )}
                    {issue.labels.slice(0, 2).map((l) => (
                      <span key={l} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400 flex items-center gap-0.5">
                        <Tag size={8} />
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
