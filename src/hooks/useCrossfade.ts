import { useRef, useCallback } from "react";

interface UseCrossfadeOptions {
  duration?: number; // in ms
}

export const useCrossfade = (options: UseCrossfadeOptions = {}) => {
  const { duration = 500 } = options;
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFadingRef = useRef(false);

  // Clean up any ongoing fade
  const cancelFade = useCallback(() => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    isFadingRef.current = false;
  }, []);

  // Crossfade between two audio elements
  const crossfade = useCallback(async (
    outgoing: HTMLAudioElement | null,
    incoming: HTMLAudioElement | null,
    targetVolume: number // 0-1
  ): Promise<void> => {
    return new Promise((resolve) => {
      cancelFade();
      isFadingRef.current = true;

      const steps = 20;
      const stepDuration = duration / steps;
      let currentStep = 0;

      // Get starting volumes
      const outgoingStartVolume = outgoing?.volume ?? 0;
      const incomingStartVolume = incoming?.volume ?? 0;

      // Calculate volume steps
      const outgoingStep = outgoingStartVolume / steps;
      const incomingStep = (targetVolume - incomingStartVolume) / steps;

      // Start incoming audio at low volume
      if (incoming) {
        incoming.volume = incomingStartVolume;
      }

      fadeIntervalRef.current = setInterval(() => {
        currentStep++;

        // Fade out the outgoing
        if (outgoing) {
          const newOutVolume = Math.max(0, outgoingStartVolume - outgoingStep * currentStep);
          outgoing.volume = newOutVolume;
        }

        // Fade in the incoming
        if (incoming) {
          const newInVolume = Math.min(targetVolume, incomingStartVolume + incomingStep * currentStep);
          incoming.volume = newInVolume;
        }

        if (currentStep >= steps) {
          cancelFade();
          
          // Fully stop outgoing
          if (outgoing) {
            outgoing.pause();
            outgoing.currentTime = 0;
            outgoing.volume = 0;
          }

          // Ensure incoming is at target volume
          if (incoming) {
            incoming.volume = targetVolume;
          }

          resolve();
        }
      }, stepDuration);
    });
  }, [duration, cancelFade]);

  // Simple fade out
  const fadeOut = useCallback(async (
    audio: HTMLAudioElement | null
  ): Promise<void> => {
    if (!audio) return;

    return new Promise((resolve) => {
      cancelFade();
      isFadingRef.current = true;

      const steps = 10;
      const stepDuration = (duration / 2) / steps;
      const startVolume = audio.volume;
      const volumeStep = startVolume / steps;
      let currentStep = 0;

      fadeIntervalRef.current = setInterval(() => {
        currentStep++;
        audio.volume = Math.max(0, startVolume - volumeStep * currentStep);

        if (currentStep >= steps) {
          cancelFade();
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 0;
          resolve();
        }
      }, stepDuration);
    });
  }, [duration, cancelFade]);

  // Simple fade in
  const fadeIn = useCallback(async (
    audio: HTMLAudioElement,
    targetVolume: number
  ): Promise<void> => {
    return new Promise((resolve) => {
      cancelFade();
      isFadingRef.current = true;

      audio.volume = 0;
      
      const steps = 10;
      const stepDuration = (duration / 2) / steps;
      const volumeStep = targetVolume / steps;
      let currentStep = 0;

      fadeIntervalRef.current = setInterval(() => {
        currentStep++;
        audio.volume = Math.min(targetVolume, volumeStep * currentStep);

        if (currentStep >= steps) {
          cancelFade();
          audio.volume = targetVolume;
          resolve();
        }
      }, stepDuration);
    });
  }, [duration, cancelFade]);

  return {
    crossfade,
    fadeOut,
    fadeIn,
    cancelFade,
    isFading: isFadingRef.current,
  };
};
