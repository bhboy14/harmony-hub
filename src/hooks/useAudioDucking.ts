import { useEffect, useRef, useCallback, useState } from "react";
import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";

interface UseAudioDuckingOptions {
  enabled?: boolean;
  duckingLevel?: number; // 0-100, default 20
  fadeInDuration?: number; // ms
  fadeOutDuration?: number; // ms
}

export const useAudioDucking = (options: UseAudioDuckingOptions = {}) => {
  const {
    enabled = true,
    duckingLevel = 20,
    fadeInDuration = 300,
    fadeOutDuration = 500,
  } = options;

  const unified = useUnifiedAudio();
  const [isDucking, setIsDucking] = useState(false);
  const originalVolumeRef = useRef<number>(75);
  const duckingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (duckingTimeoutRef.current) {
        clearTimeout(duckingTimeoutRef.current);
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, []);

  // Fade volume smoothly
  const fadeVolume = useCallback((
    from: number,
    to: number,
    duration: number,
    onComplete?: () => void
  ) => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = (to - from) / steps;
    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const newVolume = Math.round(from + volumeStep * currentStep);
      unified.setGlobalVolume(Math.max(0, Math.min(100, newVolume)));

      if (currentStep >= steps) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
        onComplete?.();
      }
    }, stepDuration);
  }, [unified]);

  // Duck the audio (reduce volume)
  const duck = useCallback(() => {
    if (!enabled || isDucking) return;

    // Store original volume
    originalVolumeRef.current = unified.volume;
    setIsDucking(true);

    // Calculate target volume
    const targetVolume = Math.round((duckingLevel / 100) * originalVolumeRef.current);

    // Fade down
    fadeVolume(unified.volume, targetVolume, fadeOutDuration);
  }, [enabled, isDucking, unified.volume, duckingLevel, fadeOutDuration, fadeVolume]);

  // Restore the audio (bring volume back)
  const restore = useCallback(() => {
    if (!isDucking) return;

    // Fade back up
    fadeVolume(unified.volume, originalVolumeRef.current, fadeInDuration, () => {
      setIsDucking(false);
    });
  }, [isDucking, unified.volume, fadeInDuration, fadeVolume]);

  // Listen for Web Speech API events
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const synth = window.speechSynthesis;
    if (!synth) return;

    // Poll for speech state (speechSynthesis doesn't have reliable events across browsers)
    let lastSpeaking = false;
    const pollInterval = setInterval(() => {
      const isSpeaking = synth.speaking && !synth.paused;
      
      if (isSpeaking && !lastSpeaking) {
        // Speech started
        duck();
      } else if (!isSpeaking && lastSpeaking) {
        // Speech ended
        // Small delay to ensure speech is truly done
        if (duckingTimeoutRef.current) {
          clearTimeout(duckingTimeoutRef.current);
        }
        duckingTimeoutRef.current = setTimeout(() => {
          restore();
        }, 200);
      }
      
      lastSpeaking = isSpeaking;
    }, 100);

    return () => {
      clearInterval(pollInterval);
      if (duckingTimeoutRef.current) {
        clearTimeout(duckingTimeoutRef.current);
      }
    };
  }, [enabled, duck, restore]);

  return {
    isDucking,
    duck,
    restore,
    duckingLevel,
  };
};
