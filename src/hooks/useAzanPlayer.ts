import { useState, useRef, useCallback, useEffect } from "react";

export type MusicStopMode = "fade" | "immediate";
export type PostAzanAction = "resume" | "silence" | "quran" | "custom";

export interface PrayerAnnouncement {
  prayer: string;
  audioFile: string | null; // null means use speech synthesis fallback
}

export interface AzanPlayerSettings {
  enabled: boolean;
  azanFile: string;
  volume: number;
  fadeOutDuration: number;
  fadeInDuration: number;
  musicStopMode: MusicStopMode;
  postAzanAction: PostAzanAction;
  postAzanDelay: number;
  minutesBefore: number;
  announcePrayerName: boolean;
  useArabicAnnouncement: boolean;
  prayerAnnouncements: Record<string, string | null>; // prayer name -> audio file URL
}

const DEFAULT_AZAN_FILE = "/audio/azan-default.mp3";

// Arabic prayer names for speech synthesis fallback
const PRAYER_ANNOUNCEMENTS = {
  Fajr: { english: "Fajr prayer time", arabic: "صلاة الفجر" },
  Sunrise: { english: "Sunrise", arabic: "الشروق" },
  Dhuhr: { english: "Dhuhr prayer time", arabic: "صلاة الظهر" },
  Asr: { english: "Asr prayer time", arabic: "صلاة العصر" },
  Maghrib: { english: "Maghrib prayer time", arabic: "صلاة المغرب" },
  Isha: { english: "Isha prayer time", arabic: "صلاة العشاء" },
};

const DEFAULT_SETTINGS: AzanPlayerSettings = {
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
  useArabicAnnouncement: true,
  prayerAnnouncements: {
    Fajr: null,
    Dhuhr: null,
    Asr: null,
    Maghrib: null,
    Isha: null,
  },
};

export const useAzanPlayer = () => {
  const [settings, setSettings] = useState<AzanPlayerSettings>(() => {
    const saved = localStorage.getItem("azanPlayerSettings");
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
    return DEFAULT_SETTINGS;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPrayer, setCurrentPrayer] = useState<string | null>(null);
  const announcementAudioRef = useRef<HTMLAudioElement | null>(null);
  const azanAudioRef = useRef<HTMLAudioElement | null>(null);

  // Persist settings
  useEffect(() => {
    localStorage.setItem("azanPlayerSettings", JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<AzanPlayerSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Set custom announcement audio for a specific prayer
  const setPrayerAnnouncementAudio = useCallback((prayer: string, file: File) => {
    const url = URL.createObjectURL(file);
    setSettings(prev => ({
      ...prev,
      prayerAnnouncements: {
        ...prev.prayerAnnouncements,
        [prayer]: url,
      },
    }));
  }, []);

  // Clear custom announcement for a prayer
  const clearPrayerAnnouncementAudio = useCallback((prayer: string) => {
    setSettings(prev => ({
      ...prev,
      prayerAnnouncements: {
        ...prev.prayerAnnouncements,
        [prayer]: null,
      },
    }));
  }, []);

  // Play audio file announcement
  const playAudioAnnouncement = useCallback((audioUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (announcementAudioRef.current) {
        announcementAudioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      audio.volume = settings.volume / 100;
      announcementAudioRef.current = audio;

      audio.onended = () => {
        announcementAudioRef.current = null;
        setTimeout(resolve, 300); // Small pause after announcement
      };

      audio.onerror = () => {
        announcementAudioRef.current = null;
        reject(new Error("Failed to play announcement audio"));
      };

      audio.play().catch(reject);
    });
  }, [settings.volume]);

  // Fallback: Speech synthesis announcement
  const playSpeechAnnouncement = useCallback((prayerName: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        console.log("Speech synthesis not supported");
        resolve();
        return;
      }

      const prayer = PRAYER_ANNOUNCEMENTS[prayerName as keyof typeof PRAYER_ANNOUNCEMENTS];
      if (!prayer) {
        resolve();
        return;
      }

      const text = settings.useArabicAnnouncement ? prayer.arabic : prayer.english;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = settings.useArabicAnnouncement ? 'ar-SA' : 'en-US';
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = settings.volume / 100;

      utterance.onend = () => setTimeout(resolve, 500);
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  }, [settings.volume, settings.useArabicAnnouncement]);

  // Announce prayer name (audio file or speech synthesis)
  const announcePrayerName = useCallback(async (prayerName: string): Promise<void> => {
    if (!settings.announcePrayerName) return;

    const customAudio = settings.prayerAnnouncements[prayerName];
    
    if (customAudio) {
      // Use custom audio file
      try {
        await playAudioAnnouncement(customAudio);
      } catch (error) {
        console.error("Custom announcement failed, using speech fallback:", error);
        await playSpeechAnnouncement(prayerName);
      }
    } else {
      // Use speech synthesis
      await playSpeechAnnouncement(prayerName);
    }
  }, [settings.announcePrayerName, settings.prayerAnnouncements, playAudioAnnouncement, playSpeechAnnouncement]);

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

  // Start complete azan sequence
  const startAzanSequence = useCallback(async (prayerName: string): Promise<void> => {
    setIsPlaying(true);
    setCurrentPrayer(prayerName);

    try {
      await announcePrayerName(prayerName);
      await playAzan();
    } catch (error) {
      console.error("Azan sequence error:", error);
      setIsPlaying(false);
      setCurrentPrayer(null);
    }
  }, [announcePrayerName, playAzan]);

  // Stop all playback
  const stopAzan = useCallback(() => {
    if (announcementAudioRef.current) {
      announcementAudioRef.current.pause();
      announcementAudioRef.current = null;
    }

    if (azanAudioRef.current) {
      azanAudioRef.current.pause();
      azanAudioRef.current.currentTime = 0;
      azanAudioRef.current = null;
    }

    window.speechSynthesis?.cancel();

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
    setPrayerAnnouncementAudio,
    clearPrayerAnnouncementAudio,
    DEFAULT_AZAN_FILE,
    PRAYER_LIST: Object.keys(PRAYER_ANNOUNCEMENTS).filter(p => p !== "Sunrise"),
  };
};
