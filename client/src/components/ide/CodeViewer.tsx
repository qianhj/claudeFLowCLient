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
import { AlertCircle, Loader2, Save, Check } from "lucide-react";
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

// ── Theme override to match app's dark palette ──────────────────────────────
const appTheme = EditorView.theme({
  "&": {
    height: "100%",
    background: "#13111C",
    color: "#cbd5e1",
  },
  ".cm-scroller": {
    fontFamily:
      "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', 'Monaco', monospace",
    fontSize: "12.5px",
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
  ".cm-focused .cm-selectionBackground": {
    background: "rgba(124,58,237,0.3) !important",
  },
  ".cm-line": { padding: "0 16px 0 0" },
  ".cm-foldPlaceholder": {
    background: "rgba(124,58,237,0.2)",
    border: "none",
    color: "#a78bfa",
  },
  ".cm-tooltip": {
    background: "rgba(24,22,34,0.95)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "6px",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    background: "rgba(124,58,237,0.3)",
  },
});

// ── Main component ──────────────────────────────────────────────────────────
export default function CodeViewer() {
  const { openFilePath, openFileContent, fileLoading, fileError } = useFileStore();

  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const currentFileRef = useRef<string | null>(null);

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [cursor, setCursor] = useState({ line: 1, col: 1 });

  // Hold latest save fn in a ref so the keymap closure is never stale
  const saveRef = useRef<() => Promise<void>>();

  const handleSave = useCallback(async () => {
    if (!viewRef.current || !openFilePath || !isDirty) return;
    const content = viewRef.current.state.doc.toString();
    setSaving(true);
    setSaveError("");
    try {
      await api.writeFileContent(openFilePath, content);
      setIsDirty(false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 1500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      setTimeout(() => setSaveError(""), 4000);
    } finally {
      setSaving(false);
    }
  }, [openFilePath, isDirty]);

  // Keep saveRef in sync
  useEffect(() => {
    saveRef.current = handleSave;
  }, [handleSave]);

  // ── Cleanup editor when file path changes ─────────────────────────────────
  useEffect(() => {
    // When path changes, destroy editor so we create a new one for the new file
    if (currentFileRef.current !== openFilePath) {
      viewRef.current?.destroy();
      viewRef.current = null;
      currentFileRef.current = openFilePath;
      setIsDirty(false);
    }
  }, [openFilePath]);

  // ── Create editor when content is ready ───────────────────────────────────
  useEffect(() => {
    if (!editorRef.current || !openFileContent || !openFilePath) return;
    if (openFileContent.language === "image") return;
    if (viewRef.current) return; // Already created

    const langExt = getLanguageExtension(openFilePath);

    const view = new EditorView({
      state: EditorState.create({
        doc: openFileContent.content,
        extensions: [
          basicSetup,
          oneDark,
          appTheme,
          ...(langExt ? [langExt] : []),
          keymap.of([
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                saveRef.current?.();
                return true;
              },
            },
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) setIsDirty(true);
            if (update.selectionSet) {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              setCursor({ line: line.number, col: head - line.from + 1 });
            }
          }),
        ],
      }),
      parent: editorRef.current,
    });

    viewRef.current = view;

    // Focus editor
    requestAnimationFrame(() => view.focus());

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Create editor when content is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFileContent]);

  if (!openFilePath) return null;

  const isImage = openFileContent?.language === "image";
  const lang = openFileContent?.language ?? "";
  const lines = openFileContent?.lines ?? 0;
  const fileSize = openFileContent?.size ?? 0;
  const encoding = openFileContent?.encoding?.toUpperCase() ?? "UTF-8";

  return (
    <div className="flex flex-col h-full" style={{ background: "#13111C" }}>
      {/* Dirty / Save bar — only shown when there are unsaved changes */}
      {isDirty && (
        <div
          className="flex items-center justify-between px-3 py-1 flex-shrink-0 border-b border-amber-glow/20"
          style={{ background: "rgba(217,119,87,0.06)" }}
        >
          <span className="text-[11px] text-amber-glow/80 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-glow inline-block" />
            未保存的更改
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors text-white disabled:opacity-50"
            style={{ background: "rgba(217,119,87,0.3)" }}
          >
            {saving ? (
              <Loader2 size={11} className="animate-spin" />
            ) : saveOk ? (
              <Check size={11} className="text-emerald-ok" />
            ) : (
              <Save size={11} />
            )}
            {saving ? "保存中..." : saveOk ? "已保存" : "保存 (Ctrl+S)"}
          </button>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="px-3 py-1 text-xs text-rose-err border-b border-rose-err/10 flex-shrink-0"
          style={{ background: "rgba(239,68,68,0.05)" }}>
          保存失败: {saveError}
        </div>
      )}

      {/* Editor / content area */}
      <div className="flex-1 overflow-hidden relative">
        {fileLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-slate-500" />
          </div>
        ) : openFileContent && isImage ? (
          <div
            className="absolute inset-0 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.25)" }}
          >
            <img
              src={openFileContent.content}
              alt={openFilePath.split(/[/\\]/).pop()}
              className="max-w-full max-h-full object-contain rounded"
            />
          </div>
        ) : openFileContent ? (
          /* CodeMirror mounts here */
          <div ref={editorRef} className="h-full" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm p-4">
            <AlertCircle size={20} className="text-rose-400" />
            <span className="text-slate-400">无法加载文件内容</span>
            {fileError && (
              <span className="text-xs text-slate-500 text-center break-all max-w-xs">
                {fileError}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Status bar — VSCode-style footer */}
      {openFileContent && !fileLoading && (
        <div
          className="flex items-center justify-between px-3 py-1 border-t border-white/5 text-[10px] font-mono text-slate-500 flex-shrink-0"
          style={{ background: "rgba(0,0,0,0.3)" }}
        >
          <div className="flex items-center gap-3">
            <span>Ln {cursor.line}, Col {cursor.col}</span>
            {lines > 0 && <span>{lines} 行</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 capitalize">{isImage ? "图片" : lang}</span>
            <span>{encoding}</span>
            <span>
              {fileSize > 1024
                ? `${(fileSize / 1024).toFixed(1)} KB`
                : `${fileSize} B`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
