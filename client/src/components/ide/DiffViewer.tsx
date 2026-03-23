import { useState, useCallback } from "react";
import {
  GitBranch,
  ChevronLeft,
  ChevronRight,
  Check,
  Minus,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { api } from "../../services/api";

interface DiffHunk {
  oldStart: number;
  newStart: number;
  lines: { type: "add" | "remove" | "context"; content: string; lineNo: number }[];
}

export interface DiffData {
  filePath: string;
  oldContent: string;
  newContent: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

interface Props {
  diff: DiffData;
  onApplied?: () => void;
  onRejected?: () => void;
}

// Reconstruct new content from diff hunks
function reconstructContent(hunks: DiffHunk[]): string {
  const lines: string[] = [];
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === "add" || line.type === "context") {
        lines.push(line.content);
      }
    }
  }
  return lines.join("\n");
}

export default function DiffViewer({ diff, onApplied, onRejected }: Props) {
  const [currentHunk, setCurrentHunk] = useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [applied, setApplied] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [error, setError] = useState("");

  const handleApply = useCallback(async () => {
    setIsApplying(true);
    setError("");
    try {
      const content = reconstructContent(diff.hunks);
      await api.writeFileContent(diff.filePath, content);
      setApplied(true);
      onApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "应用失败");
    } finally {
      setIsApplying(false);
    }
  }, [diff, onApplied]);

  const handleReject = useCallback(async () => {
    setIsRejecting(true);
    setError("");
    try {
      // Reject means keep old content
      await api.writeFileContent(diff.filePath, diff.oldContent);
      setRejected(true);
      onRejected?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "拒绝失败");
    } finally {
      setIsRejecting(false);
    }
  }, [diff, onRejected]);

  if (applied) {
    return (
      <div className="border border-emerald-500/30 rounded-lg overflow-hidden my-2 bg-emerald-500/5">
        <div className="flex items-center gap-2 px-3 py-2">
          <Check size={14} className="text-emerald-400" />
          <span className="text-xs text-emerald-400">
            已应用修改: {diff.filePath.split(/[/\\]/).pop()}
          </span>
        </div>
      </div>
    );
  }

  if (rejected) {
    return (
      <div className="border border-slate-500/30 rounded-lg overflow-hidden my-2 bg-slate-500/5">
        <div className="flex items-center gap-2 px-3 py-2">
          <X size={14} className="text-slate-400" />
          <span className="text-xs text-slate-400">
            已拒绝修改: {diff.filePath.split(/[/\\]/).pop()}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden my-2" style={{ background: "rgba(19,17,28,0.8)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5" style={{ background: "rgba(13,11,24,0.6)" }}>
        <div className="flex items-center gap-2 min-w-0">
          <GitBranch size={13} className="text-purple-bright flex-shrink-0" />
          <span className="text-xs font-mono text-slate-200 truncate">
            {diff.filePath.split(/[/\\]/).pop()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-emerald-400">
            +{diff.additions}
          </span>
          <span className="text-[10px] font-mono text-rose-400">
            -{diff.deletions}
          </span>
        </div>
      </div>

      {/* Diff lines */}
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-xs font-mono">
          <tbody>
            {diff.hunks.map((hunk, hIdx) => (
              <HunkView key={hIdx} hunk={hunk} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 text-xs text-rose-400 border-t border-rose-500/20 bg-rose-500/5">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-white/5" style={{ background: "rgba(13,11,24,0.4)" }}>
        <div className="flex items-center gap-2">
          <button
            onClick={handleApply}
            disabled={isApplying || isRejecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
          >
            {isApplying ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Check size={12} />
            )}
            应用
          </button>
          <button
            onClick={handleReject}
            disabled={isApplying || isRejecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors disabled:opacity-50"
          >
            {isRejecting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <X size={12} />
            )}
            拒绝
          </button>
        </div>

        {diff.hunks.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentHunk(Math.max(0, currentHunk - 1))}
              disabled={currentHunk === 0}
              className="p-1 rounded hover:bg-white/10 text-slate-400 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[10px] text-slate-500">
              {currentHunk + 1}/{diff.hunks.length}
            </span>
            <button
              onClick={() => setCurrentHunk(Math.min(diff.hunks.length - 1, currentHunk + 1))}
              disabled={currentHunk === diff.hunks.length - 1}
              className="p-1 rounded hover:bg-white/10 text-slate-400 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function HunkView({ hunk }: { hunk: DiffHunk }) {
  return (
    <>
      {hunk.lines.map((line, idx) => (
        <tr
          key={idx}
          className={
            line.type === "add"
              ? "bg-emerald-500/5"
              : line.type === "remove"
                ? "bg-rose-500/5"
                : ""
          }
        >
          <td className="w-8 text-right pr-2 select-none text-slate-600 border-r border-white/5">
            {line.lineNo}
          </td>
          <td className="w-5 text-center select-none">
            {line.type === "add" ? (
              <Plus size={10} className="inline text-emerald-400" />
            ) : line.type === "remove" ? (
              <Minus size={10} className="inline text-rose-400" />
            ) : null}
          </td>
          <td
            className={`px-2 py-0.5 whitespace-pre ${
              line.type === "add"
                ? "text-emerald-300"
                : line.type === "remove"
                  ? "text-rose-300"
                  : "text-slate-300"
            }`}
          >
            {line.content}
          </td>
        </tr>
      ))}
    </>
  );
}

// Helper to create DiffData from old/new content for use by other components
export function createDiff(
  filePath: string,
  oldContent: string,
  newContent: string
): DiffData {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  let additions = 0;
  let deletions = 0;
  const lines: DiffHunk["lines"] = [];

  // Simple line-by-line diff
  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      lines.push({ type: "context", content: oldLine || "", lineNo: i + 1 });
    } else {
      if (oldLine !== undefined) {
        lines.push({ type: "remove", content: oldLine, lineNo: i + 1 });
        deletions++;
      }
      if (newLine !== undefined) {
        lines.push({ type: "add", content: newLine, lineNo: i + 1 });
        additions++;
      }
    }
  }

  return {
    filePath,
    oldContent,
    newContent,
    additions,
    deletions,
    hunks: [{ oldStart: 1, newStart: 1, lines }],
  };
}
