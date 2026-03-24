import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, MessageSquare, FileCode, Layout, Settings, Folder, GitBranch, Zap, Command } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useFileStore } from "../../stores/fileStore";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const {
    setSettingsPageOpen,
    setFolderBrowserOpen,
    sidebarTab,
    setSidebarTab,
    leftNavPanel,
    setLeftNavPanel,
  } = useUIStore();
  const { openFiles } = useFileStore();

  const commands = useMemo<CommandItem[]>(() => [
    // Sidebar commands
    {
      id: "sidebar-files",
      label: "显示文件树",
      description: "在左侧栏显示项目文件",
      icon: <Folder size={16} />,
      action: () => { setSidebarTab("files"); setLeftNavPanel("files"); onClose(); },
    },
    {
      id: "sidebar-sessions",
      label: "显示会话列表",
      description: "查看历史会话",
      icon: <MessageSquare size={16} />,
      action: () => { setSidebarTab("sessions"); onClose(); },
    },
    {
      id: "sidebar-agents",
      label: "显示 Agent 面板",
      description: "查看 Agent 管理",
      icon: <Zap size={16} />,
      action: () => { setSidebarTab("agents"); onClose(); },
    },
    {
      id: "sidebar-git",
      label: "显示 Git 面板",
      description: "查看版本控制状态",
      icon: <GitBranch size={16} />,
      action: () => { setSidebarTab("files"); setLeftNavPanel("git"); onClose(); },
    },
    // Settings
    {
      id: "open-settings",
      label: "打开设置",
      description: "配置应用和模型选项",
      icon: <Settings size={16} />,
      shortcut: "Ctrl+,",
      action: () => { setSettingsPageOpen(true); onClose(); },
    },
    {
      id: "open-folder",
      label: "打开文件夹",
      description: "选择项目目录",
      icon: <Folder size={16} />,
      shortcut: "Ctrl+O",
      action: () => { setFolderBrowserOpen(true); onClose(); },
    },
    // Skills
    {
      id: "run-skill-code-review",
      label: "运行代码审查",
      description: "使用 code-review skill 分析代码",
      icon: <Zap size={16} />,
      action: () => {
        // This would need to be implemented - trigger skill from command
        onClose();
      },
    },
  ], [setSettingsPageOpen, setFolderBrowserOpen, setSidebarTab, setLeftNavPanel, onClose]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          filteredCommands[selectedIndex]?.action();
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-[560px] max-w-[90vw] rounded-xl border border-white/10 shadow-2xl overflow-hidden"
        style={{ background: "rgba(24,22,34,0.98)" }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入命令..."
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-white/5 rounded">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div className="max-h-[320px] overflow-y-auto py-1">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              未找到命令
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                ref={(el) => { itemRefs.current[index] = el; }}
                onClick={() => cmd.action()}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  index === selectedIndex
                    ? "bg-purple-glow/20"
                    : "hover:bg-white/5"
                }`}
              >
                <span className="text-slate-400">{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm ${
                      index === selectedIndex ? "text-white" : "text-slate-300"
                    }`}
                  >
                    {cmd.label}
                  </div>
                  {cmd.description && (
                    <div className="text-[11px] text-slate-500 truncate">
                      {cmd.description}
                    </div>
                  )}
                </div>
                {cmd.shortcut && (
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-white/5 rounded">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 text-[10px] text-slate-500">
          <span>↑↓ 选择 · Enter 执行 · Esc 关闭</span>
          <span>{filteredCommands.length} 个命令</span>
        </div>
      </div>
    </div>
  );
}

// Hook to handle command palette shortcut
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) };
}
