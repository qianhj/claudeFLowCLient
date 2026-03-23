import { Sun, Moon, Monitor, Type, Text } from "lucide-react";
import { useUIStore, type Theme } from "../../stores/uiStore";
import { useConfigStore } from "../../stores/configStore";

export default function AppearanceSettings() {
  const { theme, setTheme, effectiveTheme } = useUIStore();
  const { uiFontSize, editorFontSize, setUIFontSize, setEditorFontSize } = useConfigStore();

  const themes: { id: Theme; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "浅色", icon: Sun },
    { id: "dark", label: "深色", icon: Moon },
    { id: "system", label: "跟随系统", icon: Monitor },
  ];

  return (
    <section className="space-y-5">
      {/* Theme Selection */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          {effectiveTheme === "light" ? <Sun size={14} className="text-amber-glow" /> : <Moon size={14} className="text-purple-bright" />}
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">外观主题</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                theme === t.id
                  ? "border-amber-glow/30 bg-amber-glow/10 text-amber-glow"
                  : "border-white/5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size Settings */}
      <div className="space-y-4 pt-2 border-t border-white/5">
        {/* UI Font Size */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Type size={14} className="text-sky-link" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">界面字体大小</span>
            <span className="ml-auto text-xs font-mono text-slate-500">{uiFontSize}px</span>
          </div>
          <input
            type="range"
            min={12}
            max={18}
            step={1}
            value={uiFontSize}
            onChange={(e) => setUIFontSize(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-glow"
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>12px</span>
            <span>18px</span>
          </div>
        </div>

        {/* Editor Font Size */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Text size={14} className="text-sky-link" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">编辑器字体大小</span>
            <span className="ml-auto text-xs font-mono text-slate-500">{editorFontSize}px</span>
          </div>
          <input
            type="range"
            min={10}
            max={20}
            step={1}
            value={editorFontSize}
            onChange={(e) => setEditorFontSize(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-glow"
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>10px</span>
            <span>20px</span>
          </div>
        </div>
      </div>
    </section>
  );
}
