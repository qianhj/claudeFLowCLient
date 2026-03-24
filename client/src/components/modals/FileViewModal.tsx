import { X, FileText } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useFileStore } from "../../stores/fileStore";
import CodeViewer from "../ide/CodeViewer";

export default function FileViewModal() {
  const { fileViewModalOpen, setFileViewModalOpen } = useUIStore();
  const { activeFilePath, closeFile } = useFileStore();

  if (!fileViewModalOpen || !activeFilePath) return null;

  const fileName = activeFilePath.split(/[/\\]/).pop() || "";

  const handleClose = () => {
    setFileViewModalOpen(false);
    if (activeFilePath) closeFile(activeFilePath);
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="modal-content glass-panel rounded-2xl w-full max-w-5xl flex flex-col shadow-2xl shadow-black/60" style={{ height: "85vh" }}>
        {/* VSCode-style tab bar */}
        <div className="flex items-center border-b border-white/5 flex-shrink-0" style={{ background: "rgba(0,0,0,0.3)" }}>
          {/* Single tab */}
          <div className="flex items-center gap-2 px-4 py-2 border-r border-white/5 border-b-2 border-b-purple-glow/60 min-w-0 max-w-xs">
            <FileText size={13} className="text-amber-glow flex-shrink-0" />
            <span className="text-xs text-slate-200 truncate font-mono">{fileName}</span>
          </div>
          {/* Path breadcrumb */}
          <span className="text-[10px] text-slate-600 truncate px-3 font-mono flex-1 min-w-0">
            {activeFilePath}
          </span>
          {/* Close */}
          <button
            onClick={handleClose}
            className="p-2 mr-1 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Editor fills remaining space */}
        <div className="flex-1 overflow-hidden">
          <CodeViewer />
        </div>
      </div>
    </div>
  );
}

