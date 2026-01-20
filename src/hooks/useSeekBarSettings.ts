import { useState, useEffect, useCallback } from "react";

export interface SeekBarColors {
  spotify: string;
  youtube: string;
  local: string;
  soundcloud: string;
  pa: string;
  default: string;
}

export interface SeekBarSettings {
  colors: SeekBarColors;
  opacity: number; // 0-100
}

const DEFAULT_SETTINGS: SeekBarSettings = {
  colors: {
    spotify: "#22c55e",    // green-500
    youtube: "#ef4444",    // red-500
    local: "#f59e0b",      // amber-500
    soundcloud: "#f97316", // orange-500
    pa: "#f87171",         // red-400
    default: "#22b1af",    // brand-teal
  },
  opacity: 100,
};

const STORAGE_KEY = "seekbar-settings";

export const useSeekBarSettings = () => {
  const [settings, setSettings] = useState<SeekBarSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error("Failed to load seek bar settings:", e);
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to save seek bar settings:", e);
    }
  }, [settings]);

  const updateColor = useCallback((source: keyof SeekBarColors, color: string) => {
    setSettings(prev => ({
      ...prev,
      colors: { ...prev.colors, [source]: color },
    }));
  }, []);

  const updateOpacity = useCallback((opacity: number) => {
    setSettings(prev => ({ ...prev, opacity }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    updateColor,
    updateOpacity,
    resetToDefaults,
    defaultSettings: DEFAULT_SETTINGS,
  };
};

// Singleton for cross-component access
let globalSettings: SeekBarSettings = DEFAULT_SETTINGS;
let listeners: Array<(settings: SeekBarSettings) => void> = [];

export const getSeekBarSettings = (): SeekBarSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      globalSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Failed to load seek bar settings:", e);
  }
  return globalSettings;
};

export const subscribeToSeekBarSettings = (listener: (settings: SeekBarSettings) => void) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
};

// Listen for storage changes from other components
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        globalSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(e.newValue) };
        listeners.forEach(l => l(globalSettings));
      } catch (err) {
        console.error("Failed to parse seek bar settings:", err);
      }
    }
  });
}
