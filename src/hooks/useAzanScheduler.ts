import { useState, useEffect, useCallback, useRef } from "react";
import { PrayerTime } from "@/hooks/usePrayerTimes";

export type PostAzanAction = "resume" | "silence" | "quran" | "custom";

interface AzanScheduleSettings {
  enabled: boolean;
  fadeOutDuration: number; // seconds
  fadeInDuration: number; // seconds
  postAzanAction: PostAzanAction;
  postAzanDelay: number; // seconds
  minutesBefore: number; // minutes before prayer to start fade
}

interface UseAzanSchedulerProps {
  prayerTimes: PrayerTime[];
  onFadeOut: (durationMs: number) => Promise<void>;
  onFadeIn: (durationMs: number) => Promise<void>;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onPlayAzan: () => Promise<void>;
  onPlayQuran?: () => Promise<void>;
  isPlaying: boolean;
}

export const useAzanScheduler = ({
  prayerTimes,
  onFadeOut,
  onFadeIn,
  onPause,
  onResume,
  onPlayAzan,
  onPlayQuran,
  isPlaying,
}: UseAzanSchedulerProps) => {
  const [settings, setSettings] = useState<AzanScheduleSettings>({
    enabled: true,
    fadeOutDuration: 5,
    fadeInDuration: 3,
    postAzanAction: "resume",
    postAzanDelay: 30,
    minutesBefore: 2,
  });

  const [isAzanPlaying, setIsAzanPlaying] = useState(false);
  const [wasPlayingBeforeAzan, setWasPlayingBeforeAzan] = useState(false);
  const scheduledTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const azanEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleNextAzan = useCallback(() => {
    if (!settings.enabled) return;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Find next prayer time (excluding sunrise)
    const prayersWithAzan = prayerTimes.filter(p => p.name !== "Sunrise");
    
    let nextPrayer: PrayerTime | null = null;
    let nextPrayerMinutes = Infinity;

    for (const prayer of prayersWithAzan) {
      const [hours, mins] = prayer.time.split(":").map(Number);
      let prayerMinutes = hours * 60 + mins;
      
      // Adjust for next day
      if (prayerMinutes <= currentMinutes) {
        prayerMinutes += 24 * 60;
      }

      if (prayerMinutes < nextPrayerMinutes) {
        nextPrayerMinutes = prayerMinutes;
        nextPrayer = prayer;
      }
    }

    if (!nextPrayer) return;

    // Calculate when to start fade (minutes before)
    const fadeStartMinutes = nextPrayerMinutes - settings.minutesBefore;
    const msUntilFade = (fadeStartMinutes - currentMinutes) * 60 * 1000;

    if (msUntilFade > 0 && msUntilFade < 24 * 60 * 60 * 1000) {
      console.log(`Scheduling Azan for ${nextPrayer.name} in ${Math.round(msUntilFade / 60000)} minutes`);
      
      if (scheduledTimeoutRef.current) {
        clearTimeout(scheduledTimeoutRef.current);
      }

      scheduledTimeoutRef.current = setTimeout(async () => {
        await triggerAzanSequence();
      }, msUntilFade);
    }
  }, [prayerTimes, settings]);

  const triggerAzanSequence = useCallback(async () => {
    console.log("Starting Azan sequence...");
    setWasPlayingBeforeAzan(isPlaying);
    setIsAzanPlaying(true);

    try {
      // Step 1: Fade out current music
      if (isPlaying) {
        await onFadeOut(settings.fadeOutDuration * 1000);
        await onPause();
      }

      // Step 2: Play Azan (assume 3-4 minutes)
      await onPlayAzan();
      
      // Step 3: After Azan ends (simulated with timeout for now)
      const azanDuration = 180000; // 3 minutes
      
      azanEndTimeoutRef.current = setTimeout(async () => {
        setIsAzanPlaying(false);

        // Wait for post-azan delay
        await new Promise(r => setTimeout(r, settings.postAzanDelay * 1000));

        // Execute post-azan action
        switch (settings.postAzanAction) {
          case "resume":
            if (wasPlayingBeforeAzan) {
              await onResume();
              await onFadeIn(settings.fadeInDuration * 1000);
            }
            break;
          case "quran":
            if (onPlayQuran) {
              await onPlayQuran();
              await onFadeIn(settings.fadeInDuration * 1000);
            }
            break;
          case "silence":
          default:
            // Do nothing
            break;
        }

        // Schedule the next prayer
        scheduleNextAzan();
      }, azanDuration);
    } catch (error) {
      console.error("Azan sequence error:", error);
      setIsAzanPlaying(false);
    }
  }, [isPlaying, settings, onFadeOut, onFadeIn, onPause, onResume, onPlayAzan, onPlayQuran, wasPlayingBeforeAzan, scheduleNextAzan]);

  // Schedule when settings or prayer times change
  useEffect(() => {
    scheduleNextAzan();
    return () => {
      if (scheduledTimeoutRef.current) clearTimeout(scheduledTimeoutRef.current);
      if (azanEndTimeoutRef.current) clearTimeout(azanEndTimeoutRef.current);
    };
  }, [scheduleNextAzan]);

  // Manual trigger for testing
  const testAzanSequence = useCallback(async () => {
    await triggerAzanSequence();
  }, [triggerAzanSequence]);

  return {
    settings,
    setSettings,
    isAzanPlaying,
    testAzanSequence,
    scheduleNextAzan,
  };
};
