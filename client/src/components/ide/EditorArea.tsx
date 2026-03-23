import { useEffect, useRef, useState, useCallback } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { rust } from "@codemirror/lang-rust";
import { X, MoreHorizontal, FileText, GripVertical } from "lucide-react";
import { useFileStore } from "../../stores/fileStore";
import { api } from "../../services/api";

// ── Language detection ──────────────────────────────────────────────────────
function getLanguageExtension(filePath: string): Extension | null {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "js":
    case "jsx":
      return javascript({ jsx: true });
    case "ts":
      return javascript({ typescript: true });
    case "tsx":
      return javascript({ typescript: true, jsx: true });
    case "py":
      return python();
    case "css":
    case "scss":
    case "less":
      return css();
    case "html":
    case "htm":
      return html();
    case "json":
    case "jsonc":
      return json();
    case "md":
    case "mdx":
      return markdown();
    case "rs":
      return rust();
    default:
      return null;
  }
}

function getFileIcon(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const colors: Record<string, string> = {
    ts: "text-blue-400",
    tsx: "text-blue-400",
    js: "text-yellow-400",
    jsx: "text-yellow-400",
    py: "text-yellow-300",
    css: "text-sky-300",
    scss: "text-sky-300",
    html: "text-orange-400",
    json: "text-yellow-600",
    md: "text-slate-400",
    rs: "text-orange-400",
    go: "text-cyan-400",
  };
  return colors[ext] ?? "text-slate-500";
}

// ── Theme override ──────────────────────────────────────────────────────────
const appTheme = EditorView.theme({
  "&": {
    height: "100%",
    background: "#13111C",
    color: "#cbd5e1",
  },
  ".cm-scroller": {
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    fontSize: "13px",
    lineHeight: "1.65",
    overflow: "auto",
  },
  ".cm-content": { caretColor: "#a78bfa" },
  ".cm-cursor": { borderLeftColor: "#a78bfa" },
  ".cm-gutters": {
    background: "#13111C",
    borderRight: "1px solid rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.2)",
  },
  ".cm-activeLineGutter": { background: "rgba(124,58,237,0.08)" },
  ".cm-activeLine": { background: "rgba(124,58,237,0.06)" },
  ".cm-selectionBackground": { background: "rgba(124,58,237,0.25) !important" },
  ".cm-focused .cm-selectionBackground": { background: "rgba(124,58,237,0.3) !important" },
  ".cm-line": { padding: "0 16px 0 0" },
  ".cm-foldPlaceholder": {
    background: "rgba(124,58,237,0.2)",
    border: "none",
    color: "#a78bfa",
  },
});

// ── Single Editor Instance ──────────────────────────────────────────────────
interface EditorInstanceProps {
  filePath: string;
  content: string;
  isActive: boolean;
  onDirtyChange: (dirty: boolean) => void;
}

function EditorInstance({ filePath, content, isActive, onDirtyChange }: EditorInstanceProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialContentRef = useRef(content);

  useEffect(() => {
    if (!editorRef.current) return;

    const langExt = getLanguageExtension(filePath);

    const view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: [
          basicSetup,
          oneDark,
          appTheme,
          ...(langExt ? [langExt] : []),
          keymap.of([indentWithTab]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const dirty = update.state.doc.toString() !== initialContentRef.current;
              onDirtyChange(dirty);
            }
          }),
        ],
      }),
      parent: editorRef.current,
    });

    viewRef.current = view;

    if (isActive) {
      requestAnimationFrame(() => view.focus());
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [filePath]); // Recreate when filePath changes

  // Update focus when becoming active
  useEffect(() => {
    if (isActive && viewRef.current) {
      viewRef.current.focus();
    }
  }, [isActive]);

  return <div ref={editorRef} className="h-full w-full" style={{ display: isActive ? "block" : "none" }} />;
}

// ── Main Editor Area Component ──────────────────────────────────────────────
export default function EditorArea() {
  const {
    openFiles,
    activeFilePath,
    switchFile,
    closeFile,
    closeOtherFiles,
    closeAllFiles,
  } = useFileStore();

  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const tabsRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);

  const handleDirtyChange = useCallback((filePath: string, dirty: boolean) => {
    setDirtyFiles(prev => {
      const next = new Set(prev);
      if (dirty) next.add(filePath);
      else next.delete(filePath);
      return next;
    });
  }, []);

  const handleClose = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    closeFile(path);
    setDirtyFiles(prev => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (tabsRef.current) {
      tabsRef.current.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  if (openFiles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-600">
        <div className="text-center">
          <FileText size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm">从左侧文件树选择文件打开</p>
          <p className="text-xs mt-2 opacity-60">支持多标签编辑、Ctrl+S 保存</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#13111C]">
      {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-white/5 bg-[#0d0b18]">
        <div
          ref={tabsRef}
          className="flex-1 flex overflow-x-auto scrollbar-hide"
          onWheel={handleWheel}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {openFiles.map((file) => {
            const isActive = file.path === activeFilePath;
            const isDirty = dirtyFiles.has(file.path);
            const fileName = file.path.split(/[/\\]/).pop() || "";

            return (
              <div
                key={file.path}
                onClick={() => switchFile(file.path)}
                className={`group flex items-center gap-2 px-3 py-2 min-w-fit max-w-[200px] cursor-pointer
                  border-r border-white/5 transition-all select-none
                  ${isActive
                    ? "bg-[#13111C] text-slate-200 border-t-2 border-t-purple-glow"
                    : "bg-[#0d0b18] text-slate-500 hover:bg-[#1a1725] hover:text-slate-300"
                  }`}
              >
                <FileText size={14} className={getFileIcon(file.path)} />
                <span className="text-xs truncate flex-1 font-mono">{fileName}</span>

                {/* Close button - always visible on hover, dirty files show dot + close */}
                {isDirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-glow" />
                )}
                <button
                  onClick={(e) => handleClose(e, file.path)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
                  title={isDirty ? "关闭 (未保存的更改)" : "关闭"}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Tab Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(showMenu ? null : "actions")}
            className="px-2 py-2 text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <MoreHorizontal size={16} />
          </button>

          {showMenu === "actions" && (
            <div
              className="absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1 rounded-lg border border-white/10 shadow-xl"
              style={{ background: "rgba(24,22,34,0.98)" }}
            >
              <button
                onClick={() => {
                  if (activeFilePath) closeOtherFiles(activeFilePath);
                  setShowMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-white/8 transition-colors"
              >
                关闭其他标签
              </button>
              <button
                onClick={() => {
                  closeAllFiles();
                  setDirtyFiles(new Set());
                  setShowMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-white/8 transition-colors"
              >
                关闭所有标签
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Editor Content ──────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {openFiles.map((file) => {
          const isActive = file.path === activeFilePath;
          return (
            <div
              key={file.path}
              className="absolute inset-0"
              style={{ display: isActive ? "block" : "none" }}
            >
              {file.loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-pulse text-slate-500 text-sm">加载中...</div>
                </div>
              ) : file.error ? (
                <div className="h-full flex items-center justify-center text-rose-400">
                  <div className="text-center">
                    <p className="text-sm">无法加载文件</p>
                    <p className="text-xs text-slate-500 mt-1">{file.error}</p>
                  </div>
                </div>
              ) : file.content ? (
                <EditorInstance
                  filePath={file.path}
                  content={file.content.content}
                  isActive={isActive}
                  onDirtyChange={(dirty) => handleDirtyChange(file.path, dirty)}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ── Status Bar ──────────────────────────────────────────────────── */}
      {activeFilePath && (
        <div
          className="flex items-center justify-between px-3 py-1 border-t border-white/5 text-[10px] font-mono text-slate-500"
          style={{ background: "rgba(0,0,0,0.3)" }}
        >
          <div className="flex items-center gap-3">
            <span>{openFiles.find(f => f.path === activeFilePath)?.content?.language || "text"}</span>
          </div>
          <div className="flex items-center gap-3">
            {dirtyFiles.has(activeFilePath) && (
              <span className="text-amber-glow">未保存</span>
            )}
            <span>{openFiles.length} 个打开的文件</span>
          </div>
        </div>
      )}

      {/* Close menu on outside click */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(null)}
        />
      )}
    </div>
  );
}
