import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import RightPanel from "./RightPanel";
import ChatPanel from "../chat/ChatPanel";
import EditorArea from "../ide/EditorArea";
import HistoryModal from "../modals/HistoryModal";
import SettingsModal from "../modals/SettingsModal";
import FolderBrowserModal from "../modals/FolderBrowserModal";
import SkillBrowserModal from "../modals/SkillBrowserModal";
import CreateSkillModal from "../modals/CreateSkillModal";
import CommandPalette, { useCommandPalette } from "../modals/CommandPalette";
import { useSystemStore } from "../../stores/systemStore";
import { useFileStore } from "../../stores/fileStore";
import { useUIStore } from "../../stores/uiStore";
import { useDoubleEsc } from "../../hooks/useDoubleEsc";
import { MessageSquare, FileCode, FileText } from "lucide-react";

type MainView = "chat" | "editor" | "split";

export default function AppLayout() {
  const { loadClaudeInfo, loadAuthStatus, loadClaudeSettings } = useSystemStore();
  const { openFiles, activeFilePath } = useFileStore();
  const { selectedFilePath } = useUIStore();
  const [mainView, setMainView] = useState<MainView>("chat");
  const { isOpen: commandPaletteOpen, close: closeCommandPalette } = useCommandPalette();

  useEffect(() => {
    loadClaudeInfo();
    loadAuthStatus();
    loadClaudeSettings();
  }, [loadClaudeInfo, loadAuthStatus, loadClaudeSettings]);

  useDoubleEsc();

  // Auto-switch to editor when files are opened
  useEffect(() => {
    if (openFiles.length > 0 && mainView === "chat") {
      setMainView("editor");
    }
  }, [openFiles.length, mainView]);

  const showEditor = mainView === "editor" || mainView === "split";
  const showChat = mainView === "chat" || mainView === "split";

  return (
    <div className="h-screen flex overflow-hidden bg-obsidian-900">

      {/* ── 左侧栏：纯暗色，无光晕穿透 ── */}
      <Sidebar />

      {/* ── 中+右区域：光晕仅在这里（与参考样式保持一致）── */}
      <div className="relative flex-1 flex overflow-hidden min-w-0">
        {/* Ambient glow — solid color + blur，参考 bg-secondary-900/20 + bg-primary-900/10 */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div
            className="absolute rounded-full blur-[120px]"
            style={{
              top: "-10%", left: "-10%", width: "50%", height: "50%",
              background: "rgba(76, 29, 149, 0.20)",
            }}
          />
          <div
            className="absolute rounded-full blur-[100px]"
            style={{
              bottom: "-10%", right: "-10%", width: "40%", height: "40%",
              background: "rgba(112, 49, 35, 0.10)",
            }}
          />
        </div>

        {/* 内容列（z-10 覆盖在光晕之上）*/}
        <div className="relative z-10 flex flex-1 overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* View Switcher Tabs */}
            <div className="flex items-center border-b border-white/5 bg-[#0d0b18] flex-shrink-0">
              <button
                onClick={() => setMainView("editor")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors border-b-2
                  ${mainView === "editor"
                    ? "text-slate-200 border-b-purple-glow bg-[#13111C]"
                    : "text-slate-500 border-b-transparent hover:text-slate-300 hover:bg-white/5"
                  }`}
              >
                <FileCode size={14} />
                编辑器
                {openFiles.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-white/10 rounded-full">
                    {openFiles.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMainView("chat")}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors border-b-2
                  ${mainView === "chat"
                    ? "text-slate-200 border-b-purple-glow bg-[#13111C]"
                    : "text-slate-500 border-b-transparent hover:text-slate-300 hover:bg-white/5"
                  }`}
              >
                <MessageSquare size={14} />
                对话
              </button>
              {openFiles.length > 0 && (
                <button
                  onClick={() => setMainView("split")}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors border-b-2
                    ${mainView === "split"
                      ? "text-slate-200 border-b-purple-glow bg-[#13111C]"
                      : "text-slate-500 border-b-transparent hover:text-slate-300 hover:bg-white/5"
                    }`}
                >
                  分屏
                </button>
              )}

              {/* Active file indicator (when in editor mode) */}
              {mainView === "editor" && activeFilePath && (
                <div className="ml-auto flex items-center gap-2 px-4 text-xs text-slate-500">
                  <span className="truncate max-w-[300px] font-mono">
                    {activeFilePath}
                  </span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
              {showChat && (
                <div className={`${mainView === "split" ? "w-1/2" : "flex-1"} ${mainView === "split" ? "border-r border-white/5" : ""} flex flex-col min-w-0`}>
                  <ChatPanel />
                </div>
              )}
              {showEditor && (
                <div className={`${mainView === "split" ? "w-1/2" : "flex-1"} flex flex-col min-w-0`}>
                  <EditorArea />
                </div>
              )}
            </div>

            {/* ── Bottom Status Bar ── */}
            <div className="h-6 flex items-center justify-between px-3 border-t border-white/5 text-[11px] font-mono" style={{ background: "rgba(0,0,0,0.4)" }}>
              <div className="flex items-center gap-4">
                {/* Selected file indicator */}
                {selectedFilePath && (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <FileText size={11} className="text-amber-glow/70" />
                    <span className="truncate max-w-[400px]" title={selectedFilePath}>
                      {selectedFilePath}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 text-slate-500">
                {openFiles.length > 0 && (
                  <span>{openFiles.length} 个打开的文件</span>
                )}
                <span>HZ-CC Flow</span>
              </div>
            </div>
          </div>

          <RightPanel />
        </div>
      </div>

      {/* Global modals */}
      <HistoryModal />
      <SettingsModal />
      <FolderBrowserModal />
      <SkillBrowserModal />
      <CreateSkillModal />
    </div>
  );
}
