import { useState, useMemo } from "react";
import {
  Code, Eye, FileText, Play, Copy, Check, Download,
  ChevronDown, ChevronUp, ExternalLink, X, RefreshCw,
  Type, Image as ImageIcon, FileCode, Globe
} from "lucide-react";

export type ArtifactType =
  | "application/vnd.react"
  | "text/html"
  | "image/svg+xml"
  | "text/markdown"
  | "text/plain"
  | "code"
  | "mermaid"
  | string;

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  language?: string;
  identifier?: string;
}

interface ArtifactRendererProps {
  artifact: Artifact;
  onClose?: () => void;
}

// Simple HTML sanitizer for artifact preview
function sanitizeHtml(html: string): string {
  // Basic sanitization - remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
}

function getLanguageFromType(type: string, content: string): string {
  if (type.includes("react")) return "tsx";
  if (type.includes("html")) return "html";
  if (type.includes("svg")) return "svg";
  if (type.includes("markdown")) return "markdown";
  if (type.includes("mermaid")) return "mermaid";
  return "plaintext";
}

function getArtifactIcon(type: string) {
  if (type.includes("react") || type.includes("html")) return Globe;
  if (type.includes("svg") || type.includes("image")) return ImageIcon;
  if (type.includes("markdown")) return FileText;
  if (type.includes("mermaid")) return Type;
  return FileCode;
}

export default function ArtifactRenderer({ artifact, onClose }: ArtifactRendererProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const language = useMemo(() =>
    artifact.language || getLanguageFromType(artifact.type, artifact.content),
    [artifact]
  );

  const Icon = useMemo(() => getArtifactIcon(artifact.type), [artifact.type]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([artifact.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.title || `artifact-${artifact.id.slice(0, 8)}.${getFileExtension(artifact.type)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Check if artifact can be previewed
  const canPreview = useMemo(() => {
    return [
      "application/vnd.react",
      "text/html",
      "image/svg+xml",
      "text/markdown",
      "mermaid"
    ].some(t => artifact.type.includes(t) || language === t.replace("text/", ""));
  }, [artifact.type, language]);

  return (
    <div className="my-4 rounded-xl border border-white/10 overflow-hidden bg-[#0d0b18]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#13111C]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-glow/10 flex items-center justify-center">
            <Icon size={16} className="text-purple-bright" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-200">{artifact.title}</h3>
            <p className="text-[11px] text-slate-500">{language}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {canPreview && (
            <>
              <TabButton
                active={activeTab === "preview"}
                onClick={() => setActiveTab("preview")}
                icon={Eye}
                label="预览"
              />
              <TabButton
                active={activeTab === "code"}
                onClick={() => setActiveTab("code")}
                icon={Code}
                label="代码"
              />
            </>
          )}

          <div className="w-px h-4 bg-white/10 mx-1" />

          <ActionButton
            onClick={handleCopy}
            icon={copied ? Check : Copy}
            title={copied ? "已复制" : "复制代码"}
            active={copied}
          />
          <ActionButton
            onClick={handleDownload}
            icon={Download}
            title="下载"
          />
          <ActionButton
            onClick={() => setIsExpanded(!isExpanded)}
            icon={isExpanded ? ChevronUp : ChevronDown}
            title={isExpanded ? "收起" : "展开"}
          />
          {onClose && (
            <ActionButton
              onClick={onClose}
              icon={X}
              title="关闭"
            />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="relative">
          {activeTab === "preview" && canPreview ? (
            <ArtifactPreview artifact={artifact} />
          ) : (
            <CodeView content={artifact.content} language={language} />
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: typeof Code;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        active
          ? "bg-purple-glow/20 text-purple-bright"
          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function ActionButton({ onClick, icon: Icon, title, active }: {
  onClick: () => void;
  icon: typeof Code;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all ${
        active ? "text-emerald-ok" : ""
      }`}
    >
      <Icon size={14} />
    </button>
  );
}

function CodeView({ content, language }: { content: string; language: string }) {
  const lines = content.split("\n");

  return (
    <div className="max-h-[500px] overflow-auto">
      <table className="w-full text-xs font-mono">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="hover:bg-white/[0.02]">
              <td className="w-12 text-right pr-4 py-0.5 text-slate-600 select-none">
                {i + 1}
              </td>
              <td className="py-0.5 pr-4 whitespace-pre text-slate-300">
                {line || " "}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  const { type, content } = artifact;

  // HTML/React preview
  if (type.includes("html") || type.includes("react")) {
    const sanitized = sanitizeHtml(content);
    return (
      <div className="relative">
        <iframe
          srcDoc={sanitized}
          className="w-full min-h-[400px] bg-white"
          sandbox="allow-scripts allow-same-origin"
          title={artifact.title}
        />
        <div className="absolute top-2 right-2 flex gap-1">
          <a
            href={`data:text/html,${encodeURIComponent(sanitized)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
            title="在新窗口打开"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    );
  }

  // SVG preview
  if (type.includes("svg")) {
    return (
      <div
        className="p-6 flex items-center justify-center bg-[#13111C] min-h-[200px]"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Markdown preview
  if (type.includes("markdown")) {
    return (
      <div className="p-6 prose-obsidian bg-[#13111C] max-h-[500px] overflow-auto">
        <MarkdownPreview content={content} />
      </div>
    );
  }

  // Mermaid diagram (simplified - just show as code for now)
  if (type.includes("mermaid")) {
    return (
      <div className="p-6 bg-[#13111C]">
        <div className="text-xs text-slate-500 mb-2">Mermaid 图表</div>
        <CodeView content={content} language="mermaid" />
      </div>
    );
  }

  // Default fallback to code view
  return <CodeView content={content} language={type} />;
}

function MarkdownPreview({ content }: { content: string }) {
  // Simple markdown renderer for artifact preview
  const html = useMemo(() => {
    return content
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-slate-200 mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold text-slate-200 mt-5 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-semibold text-slate-200 mt-6 mb-4">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-100">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-slate-300">$1</em>')
      .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 bg-white/10 rounded text-amber-bright text-sm">$1</code>')
      .replace(/\n/g, '<br />');
  }, [content]);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function getFileExtension(type: string): string {
  if (type.includes("react")) return "tsx";
  if (type.includes("html")) return "html";
  if (type.includes("svg")) return "svg";
  if (type.includes("markdown")) return "md";
  if (type.includes("mermaid")) return "mmd";
  return "txt";
}

// Parser for extracting artifacts from message content
export function parseArtifacts(content: string): { text: string; artifacts: Artifact[] } {
  const artifacts: Artifact[] = [];

  // Match Claude artifact format: <artifact identifier="..." type="..." title="...">...</artifact>
  const artifactRegex = /<artifact\s+([^>]*?)>([\s\S]*?)<\/artifact>/g;
  const attrRegex = /(\w+)="([^"]*)"/g;

  let match;
  let lastIndex = 0;
  let cleanText = "";

  while ((match = artifactRegex.exec(content)) !== null) {
    // Add text before this artifact
    cleanText += content.slice(lastIndex, match.index);
    lastIndex = match.index + match[0].length;

    // Parse attributes
    const attrStr = match[1];
    const artifactContent = match[2];
    const attrs: Record<string, string> = {};

    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }

    const artifact: Artifact = {
      id: attrs.identifier || `artifact-${Date.now()}-${artifacts.length}`,
      type: attrs.type || "text/plain",
      title: attrs.title || "Untitled Artifact",
      content: artifactContent.trim(),
      language: attrs.language,
      identifier: attrs.identifier,
    };

    artifacts.push(artifact);
  }

  // Add remaining text
  cleanText += content.slice(lastIndex);

  return { text: cleanText.trim(), artifacts };
}

// Check if content contains artifacts
export function hasArtifacts(content: string): boolean {
  return /<artifact\s+[^>]*>/.test(content);
}
