import { useCallback, useEffect, useState } from "react";
import {
  Monitor, Camera, Maximize2, Minimize2, RotateCcw,
  ZoomIn, ZoomOut, Code2, Info, Power, PowerOff,
  Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";

/* ── Types mirrored from preload.ts ── */
interface AgentState {
  enabled: boolean;
  debugPort: number;
  autoScreenshot: boolean;
  recordActions: boolean;
}
interface WindowInfo {
  id: number;
  title: string;
  bounds: { x: number; y: number; width: number; height: number };
  isFocused: boolean;
  isVisible: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
}
interface Display {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  isPrimary: boolean;
}

const BTN_CLS =
  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.06] text-slate-300";
const BTN_PRIMARY =
  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-[#ca5d3d] hover:bg-amber-glow text-white";
const SECTION_CLS = "rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2";

/* ── Not running in Electron ── */
function NotElectron() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center px-6 py-12">
      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
        <Monitor size={20} className="text-slate-500" />
      </div>
      <div>
        <div className="text-sm font-medium text-slate-300 mb-1">仅限桌面应用</div>
        <div className="text-xs text-slate-500 leading-relaxed">
          Electron Desktop Agent 仅在<br />打包的桌面版中可用
        </div>
      </div>
    </div>
  );
}

export default function ElectronAgentPanel() {
  const isElectron = typeof window !== "undefined" && !!window.electronAPI;

  if (!isElectron) return <NotElectron />;

  return <AgentControls />;
}

/* ── Main panel (only rendered inside Electron) ── */
function AgentControls() {
  const api = window.electronAPI;

  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [windowInfo, setWindowInfo] = useState<WindowInfo | null>(null);
  const [primaryDisplay, setPrimaryDisplay] = useState<Display | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  /* helpers */
  const setLoad = (key: string, v: boolean) => setLoading((p) => ({ ...p, [key]: v }));
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  /* initial fetch */
  const refresh = useCallback(async () => {
    const [statusRes, winRes, screenRes] = await Promise.all([
      api.agent.status(),
      api.agent.getWindowInfo(),
      api.agent.getScreenInfo(),
    ]);
    if (statusRes.success && statusRes.state) setAgentState(statusRes.state);
    if (winRes.success && winRes.info) setWindowInfo(winRes.info);
    if (screenRes.success && screenRes.primary) setPrimaryDisplay(screenRes.primary as Display);
  }, [api]);

  useEffect(() => {
    refresh();
    const unsub = api.onAgentReady((state: AgentState) => setAgentState(state));
    return unsub;
  }, [api, refresh]);

  /* actions */
  const toggleAgent = async () => {
    if (!agentState) return;
    setLoad("toggle", true);
    const res = await api.agent.enable(!agentState.enabled);
    setLoad("toggle", false);
    if (res.success && res.state) {
      setAgentState(res.state);
      showToast(res.state.enabled ? "Agent 已启用" : "Agent 已禁用");
    }
  };

  const capture = async () => {
    setLoad("capture", true);
    const res = await api.agent.capture();
    setLoad("capture", false);
    if (res.success && res.dataUrl) {
      setScreenshot(res.dataUrl);
      showToast("截图成功");
    } else {
      showToast("截图失败", false);
    }
  };

  const windowControl = async (action: string) => {
    setLoad(action, true);
    const res = await api.agent.windowControl(action as Parameters<typeof api.agent.windowControl>[0]);
    setLoad(action, false);
    if (res.success) {
      await refresh();
    } else {
      showToast(`操作失败: ${res.error}`, false);
    }
  };

  const menuCommand = async (cmd: string) => {
    setLoad(cmd, true);
    const res = await api.agent.menuCommand(cmd);
    setLoad(cmd, false);
    if (!res.success) showToast(`命令失败: ${res.error}`, false);
    else showToast(`已执行: ${cmd}`);
  };

  return (
    <div className="p-3 space-y-3 overflow-y-auto">

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
          toast.ok
            ? "bg-emerald-ok/10 border-emerald-ok/20 text-emerald-ok"
            : "bg-rose-err/10 border-rose-err/20 text-rose-err"
        }`}>
          {toast.ok
            ? <CheckCircle2 size={12} />
            : <AlertCircle size={12} />}
          {toast.msg}
        </div>
      )}

      {/* Agent 状态卡 */}
      <div className={SECTION_CLS}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor size={13} className="text-purple-glow" />
            <span className="text-xs font-semibold text-slate-200">Desktop Agent</span>
          </div>
          {agentState && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
              agentState.enabled
                ? "bg-emerald-ok/10 text-emerald-ok border-emerald-ok/20"
                : "bg-slate-500/10 text-slate-500 border-slate-500/20"
            }`}>
              {agentState.enabled ? "启用" : "禁用"}
            </span>
          )}
        </div>

        <button onClick={toggleAgent} disabled={loading.toggle} className={BTN_PRIMARY}>
          {loading.toggle
            ? <Loader2 size={12} className="animate-spin" />
            : agentState?.enabled
              ? <PowerOff size={12} />
              : <Power size={12} />}
          {agentState?.enabled ? "禁用 Agent" : "启用 Agent"}
        </button>
      </div>

      {/* 窗口信息 */}
      {windowInfo && (
        <div className={SECTION_CLS}>
          <div className="flex items-center gap-2 mb-1">
            <Info size={12} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">窗口信息</span>
            <button onClick={refresh} className="ml-auto p-0.5 hover:text-amber-glow text-slate-500 transition-colors">
              <RotateCcw size={10} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            {[
              ["标题", windowInfo.title || "—"],
              ["位置", `${windowInfo.bounds.x}, ${windowInfo.bounds.y}`],
              ["尺寸", `${windowInfo.bounds.width} × ${windowInfo.bounds.height}`],
              ["状态", windowInfo.isMinimized ? "最小化" : windowInfo.isMaximized ? "最大化" : "正常"],
              ["聚焦", windowInfo.isFocused ? "是" : "否"],
              ["可见", windowInfo.isVisible ? "是" : "否"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 p-1.5 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-200 font-mono truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 窗口控制 */}
      <div className={SECTION_CLS}>
        <div className="flex items-center gap-2 mb-1">
          <Maximize2 size={12} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">窗口控制</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { action: "minimize", label: "最小化", icon: Minimize2 },
            { action: "maximize", label: "最大化", icon: Maximize2 },
            { action: "restore",  label: "还原",   icon: RotateCcw },
          ].map(({ action, label, icon: Icon }) => (
            <button key={action} onClick={() => windowControl(action)} disabled={!!loading[action]} className={BTN_CLS}>
              {loading[action] ? <Loader2 size={11} className="animate-spin" /> : <Icon size={11} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 缩放控制 */}
      <div className={SECTION_CLS}>
        <div className="flex items-center gap-2 mb-1">
          <ZoomIn size={12} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">缩放 / 菜单</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { cmd: "zoom-in",    label: "放大",   icon: ZoomIn },
            { cmd: "zoom-out",   label: "缩小",   icon: ZoomOut },
            { cmd: "reset-zoom", label: "重置",   icon: RotateCcw },
            { cmd: "reload",     label: "刷新",   icon: RotateCcw },
            { cmd: "toggle-devtools", label: "DevTools", icon: Code2 },
          ].map(({ cmd, label, icon: Icon }) => (
            <button key={cmd} onClick={() => menuCommand(cmd)} disabled={!!loading[cmd]} className={BTN_CLS}>
              {loading[cmd] ? <Loader2 size={11} className="animate-spin" /> : <Icon size={11} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 截图 */}
      <div className={SECTION_CLS}>
        <div className="flex items-center gap-2 mb-1">
          <Camera size={12} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">截图</span>
        </div>
        <button onClick={capture} disabled={loading.capture} className={BTN_PRIMARY}>
          {loading.capture ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
          {loading.capture ? "截图中..." : "捕获当前窗口"}
        </button>
        {screenshot && (
          <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
            <img src={screenshot} alt="screenshot" className="w-full" />
          </div>
        )}
      </div>

      {/* 屏幕信息 */}
      {primaryDisplay && (
        <div className={SECTION_CLS}>
          <div className="flex items-center gap-2 mb-1">
            <Monitor size={12} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">显示器信息</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            {[
              ["分辨率", `${primaryDisplay.bounds.width} × ${primaryDisplay.bounds.height}`],
              ["缩放", `${primaryDisplay.scaleFactor}x`],
              ["工作区宽", `${primaryDisplay.workArea.width}`],
              ["工作区高", `${primaryDisplay.workArea.height}`],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 p-1.5 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-200 font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
