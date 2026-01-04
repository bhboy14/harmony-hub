import { useState, useEffect, useCallback, useRef } from "react";
import { PrayerTime } from "@/hooks/usePrayerTimes";
import { useAzanPlayer, AzanPlayerSettings, MusicStopMode, PostAzanAction } from "@/hooks/useAzanPlayer";

export type { PostAzanAction, MusicStopMode };

interface UseAzanSchedulerProps {
  prayerTimes: PrayerTime[];
  onFadeOut: (durationMs: number) => Promise<void>;
  onFadeIn: (durationMs: number) => Promise<void>;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onPlayQuran?: () => Promise<void>;
  isPlaying: boolean;
}

export const useAzanScheduler = ({
  prayerTimes,
  onFadeOut,
  onFadeIn,
  onPause,
  onResume,
  onPlayQuran,
  isPlaying,
}: UseAzanSchedulerProps) => {
  const azanPlayer = useAzanPlayer();
  const { settings, startAzanSequence, stopAzan } = azanPlayer;

  const [wasPlayingBeforeAzan, setWasPlayingBeforeAzan] = useState(false);
  const [nextScheduledPrayer, setNextScheduledPrayer] = useState<string | null>(null);
  const scheduledTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const postAzanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stop music based on user preference (fade or immediate)
  const stopMusic = useCallback(async () => {
    if (!isPlaying) return;

    if (settings.musicStopMode === "fade") {
      await onFadeOut(settings.fadeOutDuration * 1000);
    }
    await onPause();
  }, [isPlaying, settings.musicStopMode, settings.fadeOutDuration, onFadeOut, onPause]);

  // Resume music based on settings
  const resumeMusic = useCallback(async () => {
    if (!wasPlayingBeforeAzan) return;

    await onResume();
    if (settings.musicStopMode === "fade") {
      await onFadeIn(settings.fadeInDuration * 1000);
    }
  }, [wasPlayingBeforeAzan, settings.musicStopMode, settings.fadeInDuration, onResume, onFadeIn]);

  const scheduleNextAzan = useCallback(() => {
    if (!settings.enabled) return;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentSeconds = now.getSeconds();

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

    // Calculate when to start (minutes before)
    const startMinutes = nextPrayerMinutes - settings.minutesBefore;
    const msUntilStart = ((startMinutes - currentMinutes) * 60 - currentSeconds) * 1000;

    if (msUntilStart > 0 && msUntilStart < 24 * 60 * 60 * 1000) {
      console.log(`Scheduling Azan for ${nextPrayer.name} in ${Math.round(msUntilStart / 60000)} minutes`);
      setNextScheduledPrayer(nextPrayer.name);
      
      if (scheduledTimeoutRef.current) {
        clearTimeout(scheduledTimeoutRef.current);
      }

      scheduledTimeoutRef.current = setTimeout(async () => {
        await triggerAzanSequence(nextPrayer!.name);
      }, msUntilStart);
    }
  }, [prayerTimes, settings.enabled, settings.minutesBefore]);

  const triggerAzanSequence = useCallback(async (prayerName: string) => {
    console.log(`Starting Azan sequence for ${prayerName}...`);
    setWasPlayingBeforeAzan(isPlaying);

    try {
      // Step 1: Stop current music (fade or immediate based on settings)
      await stopMusic();

      // Step 2: Play prayer announcement + Azan
      await startAzanSequence(prayerName);
      
      // Step 3: Handle post-azan actions after delay
      postAzanTimeoutRef.current = setTimeout(async () => {
        switch (settings.postAzanAction) {
          case "resume":
            await resumeMusic();
            break;
          case "quran":
            if (onPlayQuran) {
              await onPlayQuran();
              if (settings.musicStopMode === "fade") {
                await onFadeIn(settings.fadeInDuration * 1000);
              }
            }
            break;
          case "silence":
          default:
            // Do nothing
            break;
        }

        // Schedule the next prayer
        scheduleNextAzan();
      }, settings.postAzanDelay * 1000);
    } catch (error) {
      console.error("Azan sequence error:", error);
      // Schedule next anyway
      scheduleNextAzan();
    }
  }, [isPlaying, settings, stopMusic, resumeMusic, startAzanSequence, onPlayQuran, onFadeIn, scheduleNextAzan]);

  // Schedule when settings or prayer times change
  useEffect(() => {
    scheduleNextAzan();
    return () => {
      if (scheduledTimeoutRef.current) clearTimeout(scheduledTimeoutRef.current);
      if (postAzanTimeoutRef.current) clearTimeout(postAzanTimeoutRef.current);
    };
  }, [scheduleNextAzan]);

  // Manual trigger for testing
  const testAzanSequence = useCallback(async (prayerName?: string) => {
    if (azanPlayer.isPlaying) {
      stopAzan();
    } else {
      await triggerAzanSequence(prayerName || "Test");
    }
  }, [azanPlayer.isPlaying, stopAzan, triggerAzanSequence]);

  return {
    settings: azanPlayer.settings,
    updateSettings: azanPlayer.updateSettings,
    setSettings: azanPlayer.updateSettings,
    isAzanPlaying: azanPlayer.isPlaying,
    currentPrayer: azanPlayer.currentPrayer,
    testAzanSequence,
    scheduleNextAzan,
    stopAzan,
    nextScheduledPrayer,
    setCustomAzanFile: azanPlayer.setCustomAzanFile,
    resetToDefaultAzan: azanPlayer.resetToDefaultAzan,
  };
};
