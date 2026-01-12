import { useState, useEffect, useCallback, useRef } from "react";

interface UseAudioUnlockOptions {
  onUnlock?: () => void;
}

interface UseAudioUnlockReturn {
  isLocked: boolean;
  isIOSDevice: boolean;
  unlockAudio: () => Promise<boolean>;
  audioContext: AudioContext | null;
}

/**
 * Hook to handle iOS/Safari audio unlock requirements.
 * Safari requires a user gesture to unlock the Web Audio API.
 * This hook detects when audio is locked and provides methods to unlock it.
 */
export const useAudioUnlock = (options: UseAudioUnlockOptions = {}): UseAudioUnlockReturn => {
  const { onUnlock } = options;
  const [isLocked, setIsLocked] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasUnlockedRef = useRef(false);

  // Detect iOS/Safari
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    setIsIOSDevice(isIOS || (isSafari && isMobile));
    
    // Create AudioContext to check state
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
        
        // Check if AudioContext is suspended (locked)
        if (audioContextRef.current.state === 'suspended') {
          setIsLocked(true);
        }
        
        // Listen for state changes
        audioContextRef.current.onstatechange = () => {
          if (audioContextRef.current?.state === 'running') {
            setIsLocked(false);
            if (!hasUnlockedRef.current) {
              hasUnlockedRef.current = true;
              onUnlock?.();
            }
          } else if (audioContextRef.current?.state === 'suspended') {
            setIsLocked(true);
          }
        };
      }
    } catch (error) {
      console.warn('[AudioUnlock] Could not create AudioContext:', error);
    }

    // Create a silent audio element for unlocking
    silentAudioRef.current = new Audio();
    silentAudioRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    silentAudioRef.current.preload = 'auto';
    silentAudioRef.current.volume = 0.001; // Near-silent

    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      silentAudioRef.current = null;
    };
  }, [onUnlock]);

  // Check lock state periodically on iOS (AudioContext can get suspended)
  useEffect(() => {
    if (!isIOSDevice) return;

    const checkLockState = () => {
      if (audioContextRef.current?.state === 'suspended' && !hasUnlockedRef.current) {
        setIsLocked(true);
      }
    };

    // Check on visibility change (user switches tabs)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkLockState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initial check after a short delay
    const timer = setTimeout(checkLockState, 500);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(timer);
    };
  }, [isIOSDevice]);

  /**
   * Unlock audio playback on iOS/Safari.
   * This must be called from a user gesture (click/touch).
   */
  const unlockAudio = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[AudioUnlock] Attempting to unlock audio...');
      
      // Step 1: Resume AudioContext
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('[AudioUnlock] AudioContext resumed');
      }

      // Step 2: Play silent audio (iOS unlock trick)
      if (silentAudioRef.current) {
        silentAudioRef.current.muted = true;
        try {
          await silentAudioRef.current.play();
          silentAudioRef.current.pause();
          silentAudioRef.current.currentTime = 0;
          silentAudioRef.current.muted = false;
          console.log('[AudioUnlock] Silent audio played successfully');
        } catch (e) {
          console.warn('[AudioUnlock] Silent audio play failed:', e);
        }
      }

      // Step 3: Create and play an oscillator (belt and suspenders approach)
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
        const oscillator = audioContextRef.current.createOscillator();
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = 0; // Silent
        oscillator.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
        oscillator.start(0);
        oscillator.stop(audioContextRef.current.currentTime + 0.001);
        console.log('[AudioUnlock] Oscillator played');
      }

      // Step 4: Try to unlock any existing audio elements on the page
      const audioElements = document.querySelectorAll('audio, video');
      for (const el of audioElements) {
        const mediaEl = el as HTMLMediaElement;
        const wasMuted = mediaEl.muted;
        const wasVolume = mediaEl.volume;
        
        try {
          mediaEl.muted = true;
          mediaEl.volume = 0;
          await mediaEl.play();
          mediaEl.pause();
          mediaEl.muted = wasMuted;
          mediaEl.volume = wasVolume;
        } catch (e) {
          // Restore original state if play failed
          mediaEl.muted = wasMuted;
          mediaEl.volume = wasVolume;
        }
      }

      // Mark as unlocked
      hasUnlockedRef.current = true;
      setIsLocked(false);
      onUnlock?.();
      
      console.log('[AudioUnlock] Audio successfully unlocked');
      return true;
    } catch (error) {
      console.error('[AudioUnlock] Failed to unlock audio:', error);
      return false;
    }
  }, [onUnlock]);

  return {
    isLocked,
    isIOSDevice,
    unlockAudio,
    audioContext: audioContextRef.current,
  };
};
