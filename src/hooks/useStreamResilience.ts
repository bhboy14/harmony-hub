import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCrossfade } from "@/hooks/useCrossfade";

const BUFFER_TIMEOUT_MS = 3000; // Trigger fallback after 3 seconds of buffering
const EMERGENCY_TRACK_KEY = "emergency_ambient_track";

interface StreamResilienceOptions {
  onFallbackTriggered?: () => void;
  onStreamRestored?: () => void;
}

interface EmergencyTrack {
  name: string;
  url: string;
  isDefault: boolean;
}

export const useStreamResilience = (options: StreamResilienceOptions = {}) => {
  const { toast } = useToast();
  const { crossfade, fadeOut, fadeIn } = useCrossfade({ duration: 500 });
  
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFallbackActive, setIsFallbackActive] = useState(false);
  const [bufferingSource, setBufferingSource] = useState<string | null>(null);
  const [emergencyTrack, setEmergencyTrack] = useState<EmergencyTrack>(() => {
    const saved = localStorage.getItem(EMERGENCY_TRACK_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      name: "Ambient Silence",
      url: "/audio/azan-default.mp3", // Fallback to azan as ambient for now
      isDefault: true,
    };
  });

  const bufferTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const originalVolumeRef = useRef<number>(1);
  const originalAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize fallback audio element
  useEffect(() => {
    fallbackAudioRef.current = new Audio();
    fallbackAudioRef.current.loop = true;
    fallbackAudioRef.current.preload = "auto";
    fallbackAudioRef.current.src = emergencyTrack.url;

    return () => {
      if (fallbackAudioRef.current) {
        fallbackAudioRef.current.pause();
        fallbackAudioRef.current = null;
      }
    };
  }, [emergencyTrack.url]);

  // Set custom emergency track
  const setCustomEmergencyTrack = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const track: EmergencyTrack = {
      name: file.name,
      url,
      isDefault: false,
    };
    setEmergencyTrack(track);
    localStorage.setItem(EMERGENCY_TRACK_KEY, JSON.stringify(track));
    
    if (fallbackAudioRef.current) {
      fallbackAudioRef.current.src = url;
    }
    
    toast({
      title: "Emergency Track Set",
      description: `"${file.name}" will play during stream interruptions`,
    });
  }, [toast]);

  // Reset to default emergency track
  const resetEmergencyTrack = useCallback(() => {
    const track: EmergencyTrack = {
      name: "Ambient Silence",
      url: "/audio/azan-default.mp3",
      isDefault: true,
    };
    setEmergencyTrack(track);
    localStorage.removeItem(EMERGENCY_TRACK_KEY);
    
    if (fallbackAudioRef.current) {
      fallbackAudioRef.current.src = track.url;
    }
  }, []);

  // Monitor an audio element for buffering
  const monitorAudioElement = useCallback((
    audio: HTMLAudioElement,
    source: string
  ) => {
    originalAudioRef.current = audio;
    
    const handleWaiting = () => {
      console.log(`[StreamResilience] ${source} started buffering`);
      setIsBuffering(true);
      setBufferingSource(source);
      
      // Start timeout for fallback
      if (bufferTimeoutRef.current) {
        clearTimeout(bufferTimeoutRef.current);
      }
      
      bufferTimeoutRef.current = setTimeout(() => {
        triggerFallback(audio);
      }, BUFFER_TIMEOUT_MS);
    };

    const handlePlaying = () => {
      console.log(`[StreamResilience] ${source} resumed playing`);
      setIsBuffering(false);
      setBufferingSource(null);
      
      if (bufferTimeoutRef.current) {
        clearTimeout(bufferTimeoutRef.current);
        bufferTimeoutRef.current = null;
      }
      
      if (isFallbackActive) {
        restoreFromFallback(audio);
      }
    };

    const handleCanPlay = () => {
      if (isBuffering) {
        handlePlaying();
      }
    };

    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [isFallbackActive, isBuffering]);

  // Trigger fallback to emergency track
  const triggerFallback = useCallback(async (originalAudio: HTMLAudioElement) => {
    if (!fallbackAudioRef.current) return;
    
    console.log("[StreamResilience] Triggering emergency fallback");
    setIsFallbackActive(true);
    originalVolumeRef.current = originalAudio.volume;
    
    toast({
      title: "Stream Interrupted",
      description: "Playing ambient track while reconnecting...",
      variant: "destructive",
    });

    // Crossfade to emergency track
    fallbackAudioRef.current.volume = 0;
    await fallbackAudioRef.current.play().catch(console.error);
    await crossfade(originalAudio, fallbackAudioRef.current, originalVolumeRef.current);
    
    options.onFallbackTriggered?.();
  }, [crossfade, toast, options]);

  // Restore from fallback when stream resumes
  const restoreFromFallback = useCallback(async (originalAudio: HTMLAudioElement) => {
    if (!fallbackAudioRef.current) return;
    
    console.log("[StreamResilience] Restoring from fallback");
    
    toast({
      title: "Stream Restored",
      description: "Resuming original playback",
    });

    // Crossfade back to original
    originalAudio.volume = 0;
    await crossfade(fallbackAudioRef.current, originalAudio, originalVolumeRef.current);
    
    setIsFallbackActive(false);
    options.onStreamRestored?.();
  }, [crossfade, toast, options]);

  // Manually trigger fallback (for testing)
  const manualTriggerFallback = useCallback(async () => {
    if (!fallbackAudioRef.current) return;
    
    setIsFallbackActive(true);
    fallbackAudioRef.current.volume = 0.7;
    await fallbackAudioRef.current.play().catch(console.error);
    await fadeIn(fallbackAudioRef.current, 0.7);
    
    toast({
      title: "Emergency Track Playing",
      description: emergencyTrack.name,
    });
  }, [fadeIn, toast, emergencyTrack.name]);

  // Stop fallback manually
  const stopFallback = useCallback(async () => {
    if (fallbackAudioRef.current) {
      await fadeOut(fallbackAudioRef.current);
      fallbackAudioRef.current.pause();
      fallbackAudioRef.current.currentTime = 0;
    }
    setIsFallbackActive(false);
  }, [fadeOut]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bufferTimeoutRef.current) {
        clearTimeout(bufferTimeoutRef.current);
      }
    };
  }, []);

  // Pre-cache emergency track on mount
  useEffect(() => {
    if ("caches" in window) {
      caches.open("emergency-audio-v1").then((cache) => {
        cache.add(emergencyTrack.url).catch(console.error);
      });
    }
  }, [emergencyTrack.url]);

  return {
    isBuffering,
    isFallbackActive,
    bufferingSource,
    emergencyTrack,
    setCustomEmergencyTrack,
    resetEmergencyTrack,
    monitorAudioElement,
    manualTriggerFallback,
    stopFallback,
    fallbackAudioRef,
  };
};
