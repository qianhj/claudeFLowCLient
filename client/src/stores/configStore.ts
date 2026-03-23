import { create } from "zustand";
import type { ModelId, EffortLevel } from "../types/claude";

interface ConfigState {
  model: ModelId;
  effort: EffortLevel;
  thinking: boolean;
  autoCompactThreshold: number;
  // API Key — 仅存内存，不持久化，不写日志
  apiKey: string;
  // Font sizes
  uiFontSize: number;     // 12-18px
  editorFontSize: number; // 10-20px

  setModel: (m: ModelId) => void;
  setEffort: (e: EffortLevel) => void;
  setThinking: (t: boolean) => void;
  setAutoCompactThreshold: (v: number) => void;
  setApiKey: (k: string) => void;
  setUIFontSize: (v: number) => void;
  setEditorFontSize: (v: number) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  model: "opus",
  effort: "high",
  thinking: true,
  autoCompactThreshold: 95,
  apiKey: "",
  uiFontSize: parseInt(localStorage.getItem("hz_uiFontSize") || "14", 10),
  editorFontSize: parseInt(localStorage.getItem("hz_editorFontSize") || "13", 10),

  setModel: (model) => set({ model }),
  setEffort: (effort) => set({ effort }),
  setThinking: (thinking) => set({ thinking }),
  setAutoCompactThreshold: (autoCompactThreshold) =>
    set({ autoCompactThreshold }),
  setApiKey: (apiKey) => set({ apiKey }),
  setUIFontSize: (v) => {
    localStorage.setItem("hz_uiFontSize", String(v));
    set({ uiFontSize: v });
  },
  setEditorFontSize: (v) => {
    localStorage.setItem("hz_editorFontSize", String(v));
    set({ editorFontSize: v });
  },
}));
