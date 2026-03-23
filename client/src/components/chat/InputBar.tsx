import { useState, useRef, useCallback, useEffect } from "react";
import { Square, Paperclip, ArrowUp, Sparkles, Wrench, ShieldAlert, Code } from "lucide-react";
import { useChatStore } from "../../stores/chatStore";
import { useConfigStore } from "../../stores/configStore";
import { useUIStore, type RunMode } from "../../stores/uiStore";
import { useSystemStore } from "../../stores/systemStore";
import { wsService } from "../../services/websocket";
import { api } from "../../services/api";
import SlashCommandMenu, { type SlashCommandMenuHandle, type SlashCommand } from "./SlashCommandMenu";
import FileMentionMenu, { type FileMentionMenuHandle, type FileMention } from "./FileMentionMenu";
import AttachmentPreview from "./AttachmentPreview";
import type { Attachment } from "../../types/claude";

const RUN_MODES: { id: RunMode; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "plan",    label: "Plan" },
  { id: "edit",    label: "Edit" },
];

const ACCEPTED_FILE_TYPES = "image/*,.txt,.md,.json,.js,.ts,.jsx,.tsx,.py,.css,.html,.xml,.yaml,.yml,.toml,.csv,.sh,.bat,.rs,.go,.java,.c,.cpp,.h,.hpp,.rb,.php,.sql,.log,.cfg,.ini,.env";
const MAX_ATTACHMENTS = 5;

export default function InputBar() {
  const [text, setText] = useState("");
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [fileMentions, setFileMentions] = useState<FileMention[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slashMenuRef = useRef<SlashCommandMenuHandle>(null);
  const mentionMenuRef = useRef<FileMentionMenuHandle>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const statusText = useChatStore((s) => s.statusText);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const pendingPermCount = useChatStore((s) => s.pendingPermissions.size);
  const pendingFork = useChatStore((s) => s.pendingFork);
  const model = useConfigStore((s) => s.model);
  const effort = useConfigStore((s) => s.effort);
  const apiKey = useConfigStore((s) => s.apiKey);
  const { runMode, setRunMode, setSettingsPageOpen, projectPath, prefillInput, setPrefillInput, fileAttachQueue, clearFileAttachQueue, editorSelection, clearEditorSelection } = useUIStore();
  const { claudeInfo } = useSystemStore();

  const notInstalled = !claudeInfo?.installed;
  const noProject = !projectPath;

  // Listen for Agent launch prefill
  useEffect(() => {
    if (prefillInput) {
      setText(prefillInput);
      setPrefillInput("");
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [prefillInput, setPrefillInput]);

  // Consume file attach queue from FileTree
  useEffect(() => {
    if (fileAttachQueue.length === 0) return;
    setAttachments((prev) => {
      const remaining = MAX_ATTACHMENTS - prev.length;
      if (remaining <= 0) return prev;
      const toAdd = fileAttachQueue.slice(0, remaining).map((filePath) => {
        const name = filePath.replace(/\\/g, "/").split("/").pop() ?? filePath;
        return {
          id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name,
          type: "text/plain",
          size: 0,
          serverPath: filePath,
        };
      });
      return [...prev, ...toAdd];
    });
    clearFileAttachQueue();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [fileAttachQueue.length, clearFileAttachQueue]);

  const cycleRunMode = () => {
    const idx = RUN_MODES.findIndex((m) => m.id === runMode);
    setRunMode(RUN_MODES[(idx + 1) % RUN_MODES.length].id);
  };

  const [uploadError, setUploadError] = useState("");

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !projectPath) return;

    const remaining = MAX_ATTACHMENTS - attachments.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;

    setUploading(true);
    setUploadError("");
    try {
      const results: Attachment[] = [];
      for (const file of toUpload) {
        const meta = await api.uploadAttachment(file, projectPath);
        const previewUrl = file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined;
        results.push({ ...meta, previewUrl });
      }
      setAttachments((prev) => [...prev, ...results]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "上传失败";
      setUploadError(msg);
      console.error("[attachment upload]", err);
      // Auto-clear error after 5s
      setTimeout(() => setUploadError(""), 5000);
    } finally {
      setUploading(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [attachments.length, projectPath]);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
    if (projectPath) {
      api.deleteAttachment(id, projectPath).catch(() => {});
    }
  }, [projectPath]);

  const handleSend = useCallback(() => {
    const prompt = text.trim();
    if (!prompt || isStreaming || notInstalled || noProject) return;

    // Combine uploaded attachments with file mentions
    const allAttachments = [...attachments];

    // Add file mentions that aren't already in attachments
    for (const mention of fileMentions) {
      if (!allAttachments.some((a) => a.serverPath === mention.path)) {
        allAttachments.push({
          id: `mention_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: mention.name,
          type: "text/plain",
          size: 0,
          serverPath: mention.path,
        });
      }
    }

    const currentAttachments = allAttachments.length > 0 ? allAttachments : undefined;
    const attachmentPaths = currentAttachments?.map((a) => a.serverPath).filter(Boolean) as string[] | undefined;

    useChatStore.getState().addUserMessage(prompt, currentAttachments);

    // If pendingFork is set, this message triggers a session fork
    const forkInfo = useChatStore.getState().pendingFork;
    wsService.send("send_message", {
      prompt, model, effort, runMode,
      apiKey: apiKey || undefined,
      sessionId: forkInfo?.sessionId || currentSessionId || undefined,
      forkSession: forkInfo ? true : undefined,
      attachmentPaths: attachmentPaths?.length ? attachmentPaths : undefined,
    });
    // Clear pendingFork — will be fully resolved on session_init with new ID
    if (forkInfo) {
      useChatStore.getState().clearPendingFork();
    }

    // Instant feedback: start streaming lifecycle immediately (don't wait for session_init)
    useChatStore.getState().startStreaming();
    if (prompt.startsWith("/compact")) {
      useChatStore.getState().setStatusText("正在压缩上下文...");
    }

    setText("");
    // Release blob URLs
    for (const a of attachments) {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    }
    setAttachments([]);
    setFileMentions([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [text, isStreaming, model, effort, runMode, notInstalled, noProject, currentSessionId, pendingFork, attachments, fileMentions]);

  const handleAbort = useCallback(() => wsService.send("abort", {}), []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!projectPath || attachments.length >= MAX_ATTACHMENTS) return;
    const imageItem = Array.from(e.clipboardData.items).find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const meta = await api.uploadAttachment(file, projectPath);
      const previewUrl = URL.createObjectURL(file);
      setAttachments((prev) => [...prev, { ...meta, previewUrl }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "上传失败";
      setUploadError(msg);
      setTimeout(() => setUploadError(""), 5000);
    } finally {
      setUploading(false);
    }
  }, [projectPath, attachments.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Forward navigation keys to mention menu when open
    if (mentionMenuOpen && mentionMenuRef.current) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        mentionMenuRef.current.handleKey(e.key);
        return;
      }
      const forwarded = ["ArrowUp", "ArrowDown", "Tab", "Escape"];
      if (forwarded.includes(e.key)) {
        e.preventDefault();
        mentionMenuRef.current.handleKey(e.key);
        return;
      }
      if (e.key === "Backspace" && mentionQuery === "") {
        e.preventDefault();
        mentionMenuRef.current.handleKey("Backspace");
        return;
      }
    }

    // Forward navigation keys to slash menu when open
    if (slashMenuOpen && slashMenuRef.current) {
      if (e.key === "Enter" && !e.shiftKey) {
        // Try to select from the menu; if handleKey returns false
        // (no matching command), close the menu and send the message
        e.preventDefault();
        const handled = slashMenuRef.current.handleKey(e.key);
        if (!handled) {
          setSlashMenuOpen(false);
          setSlashQuery("");
          handleSend();
        }
        return;
      }
      const forwarded = ["ArrowUp", "ArrowDown", "Tab", "Escape"];
      if (forwarded.includes(e.key)) {
        e.preventDefault();
        slashMenuRef.current.handleKey(e.key);
        return;
      }
      if (e.key === "Backspace" && slashQuery === "") {
        e.preventDefault();
        slashMenuRef.current.handleKey("Backspace");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursorPos);

    // Slash command detection: show menu only for the command part (before first space)
    if (val.startsWith("/") && !val.includes(" ")) {
      setSlashMenuOpen(true);
      setSlashQuery(val.slice(1)); // everything after "/"
      setMentionMenuOpen(false);
    } else {
      setSlashMenuOpen(false);
      setSlashQuery("");

      // File mention detection: look for @ followed by word characters before cursor
      const mentionMatch = textBeforeCursor.match(/@([\w./-]*)$/);
      if (mentionMatch) {
        setMentionMenuOpen(true);
        setMentionQuery(mentionMatch[1]);
      } else {
        setMentionMenuOpen(false);
        setMentionQuery("");
      }
    }

    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    setSlashMenuOpen(false);
    setSlashQuery("");

    // "insert" — place text in input for user to add arguments, keep focus
    if (cmd.type === "insert" && cmd.insertText) {
      setText(cmd.insertText);
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    // "prompt" — send as message to Claude via WebSocket
    if (cmd.type === "prompt" && cmd.promptText) {
      const prompt = cmd.promptText;
      useChatStore.getState().addUserMessage(prompt);
      const { model: m, effort: e, apiKey: k } = useConfigStore.getState();
      const { runMode: rm } = useUIStore.getState();
      const sid = useChatStore.getState().currentSessionId;
      wsService.send("send_message", {
        prompt, model: m, effort: e, runMode: rm,
        apiKey: k || undefined, sessionId: sid || undefined,
      });
      // Instant feedback
      useChatStore.getState().startStreaming();
      if (prompt.startsWith("/compact")) {
        useChatStore.getState().setStatusText("正在压缩上下文...");
      }
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      return;
    }

    // "action" — execute local UI action
    cmd.action?.();
    // Brief status feedback for action commands (auto-clears after 2s)
    const feedbackMap: Record<string, string> = {
      clear: "✓ 对话已清空", plan: "✓ 已切换到 Plan 模式",
      fork: "✓ 对话已 Fork，下次发送将创建分支",
      copy: "✓ 已复制到剪贴板", export: "✓ 对话已导出",
      "model-opus": "✓ 已切换到 Opus", "model-sonnet": "✓ 已切换到 Sonnet", "model-haiku": "✓ 已切换到 Haiku",
      "fast-on": "✓ Fast 模式已开启", "fast-off": "✓ Fast 模式已关闭",
    };
    const fb = feedbackMap[cmd.id];
    if (fb) {
      useChatStore.getState().setStatusText(fb);
      setTimeout(() => {
        // Only clear if it's still our feedback message
        if (useChatStore.getState().statusText === fb) {
          useChatStore.getState().setStatusText("");
        }
      }, 2000);
    }
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, []);

  const handleSlashDismiss = useCallback(() => {
    setSlashMenuOpen(false);
    setSlashQuery("");
  }, []);

  const handleMentionSelect = useCallback((file: FileMention) => {
    // Insert the filename after @, replacing the query part
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart || 0;
    const textBeforeCursor = text.slice(0, cursorPos);
    const textAfterCursor = text.slice(cursorPos);

    // Find the @ that started this mention
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    if (lastAtIndex === -1) return;

    // Replace @query with @filename
    const newTextBefore = textBeforeCursor.slice(0, lastAtIndex) + `@${file.name}`;
    const newText = newTextBefore + textAfterCursor;

    setText(newText);
    setMentionMenuOpen(false);
    setMentionQuery("");

    // Track this file mention
    setFileMentions((prev) => {
      // Don't add duplicates
      if (prev.some((m) => m.path === file.path)) return prev;
      return [...prev, file];
    });

    // Move cursor after the inserted filename
    requestAnimationFrame(() => {
      const newCursorPos = newTextBefore.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    });
  }, [text]);

  const handleMentionDismiss = useCallback(() => {
    setMentionMenuOpen(false);
    setMentionQuery("");
  }, []);

  // Send selected code from editor to chat
  const handleSendSelection = useCallback(() => {
    if (!editorSelection) return;

    const { text, filePath, lineStart, lineEnd } = editorSelection;
    const fileName = filePath.split(/[/\\]/).pop() || "";

    const contextText = `[${fileName}:${lineStart}-${lineEnd}]\n\`\`\`\n${text}\n\`\`\`\n\n${text.trim()}`;

    setText((prev) => {
      const newText = prev ? `${prev}\n\n${contextText}` : contextText;
      return newText;
    });

    clearEditorSelection();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [editorSelection, clearEditorSelection]);

  const handleOpenSetup = () => setSettingsPageOpen(true);

  return (
    <div className="flex-shrink-0 glass-panel border-t border-white/5 p-4">
      <div className="relative max-w-3xl mx-auto">

        {/* Slash command menu */}
        {slashMenuOpen && !isStreaming && (
          <SlashCommandMenu
            ref={slashMenuRef}
            query={slashQuery}
            onSelect={handleSlashSelect}
            onDismiss={handleSlashDismiss}
          />
        )}

        {/* File mention menu */}
        {mentionMenuOpen && !isStreaming && (
          <FileMentionMenu
            ref={mentionMenuRef}
            query={mentionQuery}
            onSelect={handleMentionSelect}
            onDismiss={handleMentionDismiss}
          />
        )}

        {/* Left icon inside textarea */}
        <div className="absolute left-4 top-3.5 text-slate-500 pointer-events-none" style={{ zIndex: 1 }}>
          <Sparkles size={18} />
        </div>

        {/* Main input container */}
        <div className={`relative rounded-xl border transition-colors overflow-hidden ${
          notInstalled || noProject
            ? "border-rose-err/20 focus-within:border-rose-err/40"
            : "border-white/10 focus-within:border-purple-glow/40"
        }`}
          style={{ background: "rgba(13,11,24,0.6)" }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              notInstalled
                ? "请先安装 Claude Code 才能开始对话..."
                : noProject
                  ? "请先在左侧侧栏选择项目文件夹..."
                  : pendingFork
                    ? "输入消息继续（将创建分支会话）..."
                  : "描述你的下一个任务或提问..."
            }
            disabled={isStreaming || notInstalled || noProject}
            rows={1}
            className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 pl-12 pr-14 py-3.5 resize-none focus:outline-none font-sans leading-relaxed disabled:opacity-50"
            style={{ minHeight: "52px" }}
          />

          {/* Attachment preview */}
          <AttachmentPreview
            attachments={[...attachments, ...fileMentions.map(m => ({
              id: `mention_${m.path}`,
              name: `@${m.name}`,
              type: "text/plain",
              size: 0,
              serverPath: m.path,
            }))]}
            onRemove={(id) => {
              if (id.startsWith("mention_")) {
                const path = id.slice(8); // Remove "mention_" prefix
                setFileMentions((prev) => prev.filter((m) => m.path !== path));
              } else {
                handleRemoveAttachment(id);
              }
            }}
            uploading={uploading}
          />

          {/* Upload error */}
          {uploadError && (
            <div className="px-3 py-1.5 text-xs text-rose-err border-t border-rose-err/10">
              附件上传失败: {uploadError}
            </div>
          )}

          {/* Send / Abort / Setup button */}
          <div className="absolute right-3 top-2.5">
            {isStreaming ? (
              <button
                onClick={handleAbort}
                className="p-1.5 rounded-lg bg-rose-err/10 text-rose-err hover:bg-rose-err/20 border border-rose-err/20 transition-colors"
                title="停止"
              >
                <Square size={16} />
              </button>
            ) : notInstalled ? (
              <button
                onClick={handleOpenSetup}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-err/10 text-rose-err hover:bg-rose-err/20 border border-rose-err/20 transition-colors text-xs font-medium"
                title="安装 Claude Code"
              >
                <Wrench size={13} />
                <span className="hidden sm:inline">安装</span>
              </button>
            ) : noProject ? (
              <button
                disabled
                className="p-1.5 rounded-lg bg-rose-err/10 text-rose-err/50 border border-rose-err/20 transition-colors"
                title="请先选择项目文件夹"
              >
                <ArrowUp size={16} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!text.trim()}
                className="p-1.5 rounded-lg text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: text.trim() ? "#7c3aed" : "rgba(124,58,237,0.3)" }}
                title="发送 (Enter)"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between mt-2 px-1">
          {/* Left: attachment + mic + run mode */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={notInstalled || noProject || isStreaming || attachments.length >= MAX_ATTACHMENTS}
              className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={attachments.length >= MAX_ATTACHMENTS ? `最多 ${MAX_ATTACHMENTS} 个附件` : "添加附件"}
            >
              <Paperclip size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileSelect}
              className="hidden"
            />
            {/* Separator */}
            <div className="w-px h-4 bg-white/10 mx-1" />

            {/* Run mode cycle button */}
            <button
              onClick={cycleRunMode}
              disabled={notInstalled || noProject}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed ${
                runMode === "plan"
                  ? "border-purple-bright/30 bg-purple-glow/10 text-purple-bright"
                  : runMode === "edit"
                    ? "border-amber-glow/30 bg-amber-glow/10 text-amber-glow"
                    : "border-white/10 bg-white/5 text-slate-400"
              }`}
              title="点击切换运行模式"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
              {runMode === "default" ? "Default" : runMode === "plan" ? "Plan" : "Edit"}
            </button>

            {/* Send selected code button */}
            {editorSelection && (
              <button
                onClick={handleSendSelection}
                disabled={isStreaming}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-purple-bright/30 bg-purple-glow/10 text-purple-bright hover:opacity-90 transition-all disabled:opacity-30"
                title={`发送选中的代码 (${editorSelection.filePath.split(/[/\\]/).pop()}:${editorSelection.lineStart}-${editorSelection.lineEnd})`}
              >
                <Code size={12} />
                <span className="hidden sm:inline">选中代码</span>
              </button>
            )}
          </div>

          {/* Right: hint or not-installed / no-project CTA */}
          <div className="flex items-center gap-3">
            {notInstalled ? (
              <button
                onClick={handleOpenSetup}
                className="text-[11px] text-rose-err hover:text-rose-err/80 transition-colors flex items-center gap-1"
              >
                安装 Claude Code →
              </button>
            ) : noProject ? (
              <span className="text-[10px] text-slate-600 hidden sm:block">
                Enter 发送，Shift+Enter 换行，/ 命令
              </span>
            ) : (
              <>
                {pendingPermCount > 0 ? (
                  <span className="text-[11px] text-amber-glow flex items-center gap-1.5 animate-pulse">
                    <ShieldAlert size={12} className="flex-shrink-0" />
                    等待权限确认 ({pendingPermCount})
                  </span>
                ) : statusText ? (
                  <span className={`text-[11px] flex items-center gap-1.5 ${
                    isStreaming ? "text-emerald-ok/80 animate-pulse" : "text-slate-400"
                  }`}>
                    {isStreaming && <span className="w-1.5 h-1.5 rounded-full bg-emerald-ok flex-shrink-0" />}
                    {statusText}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-600 hidden sm:block">
                    {isStreaming ? "双击 ESC 中断" : "Enter 发送，Shift+Enter 换行，/ 命令"}
                  </span>
                )}
                <span className="text-[10px] text-slate-500 font-mono">
                  {model} / {effort}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
