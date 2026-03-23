import { useState } from "react";
import { Share, Download, Link, Check, X } from "lucide-react";
import { useChatStore } from "../../stores/chatStore";

interface ShareConversationProps {
  onClose?: () => void;
}

export default function ShareConversation({ onClose }: ShareConversationProps) {
  const { messages, currentSessionId } = useChatStore();
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Export conversation as Markdown
  const handleExportMarkdown = () => {
    setExporting(true);

    const content = messages.map((msg) => {
      const role = msg.role === "user" ? "用户" : msg.role === "assistant" ? "Claude" : "系统";
      const time = new Date(msg.timestamp).toLocaleString("zh-CN");
      return `## ${role} (${time})\n\n${msg.content}\n`;
    }).join("\n---\n\n");

    const fullContent = `# 对话记录\n\n**会话 ID**: ${currentSessionId || "N/A"}\n**导出时间**: ${new Date().toLocaleString("zh-CN")}\n\n---\n\n${content}`;

    const blob = new Blob([fullContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${currentSessionId?.slice(0, 8) || "export"}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExporting(false);
  };

  // Export conversation as JSON
  const handleExportJSON = () => {
    setExporting(true);

    const exportData = {
      sessionId: currentSessionId,
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${currentSessionId?.slice(0, 8) || "export"}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExporting(false);
  };

  // Copy shareable summary to clipboard
  const handleCopySummary = async () => {
    const summary = messages.slice(0, 20).map((msg) => {
      const prefix = msg.role === "user" ? "用户: " : "Claude: ";
      return prefix + msg.content.slice(0, 200) + (msg.content.length > 200 ? "..." : "");
    }).join("\n\n");

    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0b18] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Share size={16} className="text-purple-bright" />
          <h3 className="text-sm font-medium text-slate-200">分享对话</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-slate-400">
            <X size={14} />
          </button>
        )}
      </div>

      {!hasMessages ? (
        <p className="text-xs text-slate-500 text-center py-4">当前没有对话内容可分享</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            共 {messages.length} 条消息
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportMarkdown}
              disabled={exporting}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
            >
              <Download size={14} />
              导出 Markdown
            </button>
            <button
              onClick={handleExportJSON}
              disabled={exporting}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
            >
              <Download size={14} />
              导出 JSON
            </button>
          </div>

          <button
            onClick={handleCopySummary}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium bg-purple-glow/10 border border-purple-glow/20 text-purple-bright hover:bg-purple-glow/20 transition-colors"
          >
            {copied ? <Check size={14} /> : <Link size={14} />}
            {copied ? "已复制到剪贴板" : "复制对话摘要"}
          </button>

          <p className="text-[10px] text-slate-500 text-center">
            云端分享链接功能开发中，目前支持导出为文件
          </p>
        </div>
      )}
    </div>
  );
}
