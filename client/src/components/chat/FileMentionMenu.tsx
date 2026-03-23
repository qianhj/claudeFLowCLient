import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { File, FileCode2, FileText, Folder, Search, FileImage } from "lucide-react";
import { useFileStore } from "../../stores/fileStore";
import { useUIStore } from "../../stores/uiStore";
import type { FileNode } from "../../types/file";

export interface FileMention {
  path: string;
  name: string;
}

export interface FileMentionMenuHandle {
  handleKey: (key: string) => boolean;
}

interface FileMentionMenuProps {
  query: string;
  onSelect: (file: FileMention) => void;
  onDismiss: () => void;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "py":
    case "go":
    case "rs":
      return FileCode2;
    case "md":
    case "mdx":
    case "txt":
      return FileText;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return FileImage;
    default:
      return File;
  }
}

// Flatten file tree to get all file paths
function flattenFiles(node: FileNode, prefix = ""): { path: string; name: string }[] {
  const results: { path: string; name: string }[] = [];
  const currentPath = prefix ? `${prefix}/${node.name}` : node.name;

  if (node.type === "file") {
    results.push({ path: node.path, name: node.name });
  }

  if (node.children) {
    for (const child of node.children) {
      results.push(...flattenFiles(child, currentPath));
    }
  }

  return results;
}

export default forwardRef<FileMentionMenuHandle, FileMentionMenuProps>(
  function FileMentionMenu({ query, onSelect, onDismiss }, ref) {
    const projectPath = useUIStore((s) => s.projectPath);
    const tree = useFileStore((s) => s.tree);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Get all files from tree
    const allFiles = useMemo(() => {
      if (!tree) return [];
      return flattenFiles(tree);
    }, [tree]);

    // Filter files based on query
    const filteredFiles = useMemo(() => {
      const q = query.toLowerCase().trim();
      if (!q) return allFiles.slice(0, 20); // Show first 20 files if no query
      return allFiles.filter((f) => f.name.toLowerCase().includes(q));
    }, [allFiles, query]);

    // Reset selection when query changes
    useEffect(() => {
      setSelectedIndex(0);
    }, [query]);

    // Scroll selected item into view
    useEffect(() => {
      const el = itemRefs.current[selectedIndex];
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }, [selectedIndex]);

    // Keyboard navigation
    useImperativeHandle(ref, () => ({
      handleKey: (key: string) => {
        switch (key) {
          case "ArrowDown":
            setSelectedIndex((i) =>
              Math.min(i + 1, filteredFiles.length - 1)
            );
            return true;
          case "ArrowUp":
            setSelectedIndex((i) => Math.max(i - 1, 0));
            return true;
          case "Enter":
            if (filteredFiles[selectedIndex]) {
              onSelect(filteredFiles[selectedIndex]);
            }
            return true;
          case "Escape":
            onDismiss();
            return true;
          case "Backspace":
            if (query === "") {
              onDismiss();
              return true;
            }
            return false;
          default:
            return false;
        }
      },
    }));

    if (!projectPath) {
      return (
        <div className="absolute bottom-full left-0 mb-2 w-80 max-h-64 overflow-hidden rounded-xl border border-white/10 shadow-2xl z-50"
          style={{ background: "rgba(24,22,34,0.98)", backdropFilter: "blur(12px)" }}>
          <div className="p-4 text-sm text-slate-400 text-center">
            请先选择项目目录
          </div>
        </div>
      );
    }

    return (
      <div className="absolute bottom-full left-0 mb-2 w-80 max-h-64 overflow-hidden rounded-xl border border-white/10 shadow-2xl z-50"
        style={{ background: "rgba(24,22,34,0.98)", backdropFilter: "blur(12px)" }}>
        {/* Header */}
        <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
          <Search size={12} className="text-slate-500" />
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
            文件引用
          </span>
          <span className="text-[10px] text-slate-600 ml-auto">
            {filteredFiles.length} 个文件
          </span>
        </div>

        {/* File list */}
        <div className="overflow-y-auto max-h-48 py-1">
          {filteredFiles.length === 0 ? (
            <div className="px-3 py-4 text-sm text-slate-500 text-center">
              未找到匹配的文件
            </div>
          ) : (
            filteredFiles.map((file, index) => {
              const Icon = getFileIcon(file.name);
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={file.path}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  onClick={() => onSelect(file)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    isSelected ? "bg-purple-glow/20" : "hover:bg-white/5"
                  }`}>
                  <Icon size={14} className="text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${isSelected ? "text-white" : "text-slate-300"}`}>
                      {file.name}
                    </div>
                    <div className="text-[10px] text-slate-600 truncate font-mono">
                      {file.path.replace(projectPath, "").slice(1)}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-3 py-1.5 border-t border-white/5 text-[10px] text-slate-600 flex items-center justify-between">
          <span>↑↓ 选择 · Enter 确认 · Esc 关闭</span>
        </div>
      </div>
    );
  }
);
