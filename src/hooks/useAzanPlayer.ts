import { useState, useRef, useCallback, useEffect } from "react";

export type MusicStopMode = "fade" | "immediate";
export type PostAzanAction = "resume" | "silence" | "quran" | "custom";

export interface AzanPlayerSettings {
  enabled: boolean;
  azanFile: string; // URL or path to azan audio
  volume: number; // 0-100
  fadeOutDuration: number; // seconds
  fadeInDuration: number; // seconds
  musicStopMode: MusicStopMode; // fade or immediate
  postAzanAction: PostAzanAction;
  postAzanDelay: number; // seconds
  minutesBefore: number; // minutes before prayer to start
  announcePrayerName: boolean; // Announce prayer name before azan
}

const DEFAULT_AZAN_FILE = "/audio/azan-default.mp3";

const PRAYER_NAME_ANNOUNCEMENTS: Record<string, string> = {
  "Fajr": "Fajr",
  "Sunrise": "Sunrise",
  "Dhuhr": "Dhuhr",
  "Asr": "Asr",
  "Maghrib": "Maghrib",
  "Isha": "Isha",
};

export const useAzanPlayer = () => {
  const [settings, setSettings] = useState<AzanPlayerSettings>(() => {
    const saved = localStorage.getItem("azanPlayerSettings");
    return saved ? JSON.parse(saved) : {
      enabled: true,
      azanFile: DEFAULT_AZAN_FILE,
      volume: 80,
      fadeOutDuration: 5,
      fadeInDuration: 3,
      musicStopMode: "fade",
      postAzanAction: "resume",
      postAzanDelay: 30,
      minutesBefore: 2,
      announcePrayerName: true,
    };
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPrayer, setCurrentPrayer] = useState<string | null>(null);
  const azanAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Persist settings
  useEffect(() => {
    localStorage.setItem("azanPlayerSettings", JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<AzanPlayerSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Announce prayer name using Web Speech API
  const announcePrayerName = useCallback((prayerName: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!settings.announcePrayerName) {
        resolve();
        return;
      }

      const announcement = PRAYER_NAME_ANNOUNCEMENTS[prayerName] || prayerName;
      
      // Check if speech synthesis is supported
      if (!('speechSynthesis' in window)) {
        console.log("Speech synthesis not supported, skipping announcement");
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(`${announcement} prayer time`);
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = settings.volume / 100;
      
      speechSynthRef.current = utterance;

      utterance.onend = () => {
        // Small pause after announcement
        setTimeout(resolve, 500);
      };

      utterance.onerror = () => {
        console.error("Speech synthesis error");
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }, [settings.announcePrayerName, settings.volume]);

  // Play the azan audio
  const playAzan = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (azanAudioRef.current) {
        azanAudioRef.current.pause();
        azanAudioRef.current = null;
      }

      const audio = new Audio(settings.azanFile);
      audio.volume = settings.volume / 100;
      azanAudioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentPrayer(null);
        azanAudioRef.current = null;
        resolve();
      };

      audio.onerror = (e) => {
        setIsPlaying(false);
        setCurrentPrayer(null);
        azanAudioRef.current = null;
        reject(e);
      };

      audio.play().catch(reject);
    });
  }, [settings.azanFile, settings.volume]);

  // Start complete azan sequence with prayer name announcement
  const startAzanSequence = useCallback(async (prayerName: string): Promise<void> => {
    setIsPlaying(true);
    setCurrentPrayer(prayerName);

    try {
      // First announce the prayer name
      await announcePrayerName(prayerName);
      
      // Then play the azan
      await playAzan();
    } catch (error) {
      console.error("Azan sequence error:", error);
      setIsPlaying(false);
      setCurrentPrayer(null);
    }
  }, [announcePrayerName, playAzan]);

  // Stop azan playback
  const stopAzan = useCallback(() => {
    if (azanAudioRef.current) {
      azanAudioRef.current.pause();
      azanAudioRef.current.currentTime = 0;
      azanAudioRef.current = null;
    }

    if (speechSynthRef.current) {
      window.speechSynthesis.cancel();
    }

    setIsPlaying(false);
    setCurrentPrayer(null);
  }, []);

  // Set custom azan file
  const setCustomAzanFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    updateSettings({ azanFile: url });
  }, [updateSettings]);

  // Reset to default azan
  const resetToDefaultAzan = useCallback(() => {
    updateSettings({ azanFile: DEFAULT_AZAN_FILE });
  }, [updateSettings]);

  return {
    settings,
    updateSettings,
    isPlaying,
    currentPrayer,
    startAzanSequence,
    stopAzan,
    setCustomAzanFile,
    resetToDefaultAzan,
    DEFAULT_AZAN_FILE,
  };
};
