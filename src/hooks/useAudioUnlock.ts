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
  const [isInitialized, setIsInitialized] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasUnlockedRef = useRef(false);
  const onUnlockRef = useRef(onUnlock);

  // Keep callback ref updated
  useEffect(() => {
    onUnlockRef.current = onUnlock;
  }, [onUnlock]);

  // Detect iOS/Safari - run once on mount
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const needsUnlock = isIOS || (isSafari && isMobile);
    setIsIOSDevice(needsUnlock);
    
    // Only proceed with AudioContext if on iOS/mobile Safari
    if (!needsUnlock) {
      setIsInitialized(true);
      return;
    }

    // Check if we already unlocked in this session
    const wasUnlocked = sessionStorage.getItem('audioUnlocked') === 'true';
    if (wasUnlocked) {
      hasUnlockedRef.current = true;
      setIsLocked(false);
      setIsInitialized(true);
      return;
    }
    
    // Create AudioContext to check state
    let audioContext: AudioContext | null = null;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;
        
        // Check initial state - only set locked if truly suspended
        const initialState = audioContext.state;
        console.log('[AudioUnlock] Initial AudioContext state:', initialState);
        
        if (initialState === 'suspended') {
          setIsLocked(true);
        } else if (initialState === 'running') {
          // Already running, mark as unlocked
          hasUnlockedRef.current = true;
          sessionStorage.setItem('audioUnlocked', 'true');
        }
        
        // Listen for state changes
        audioContext.onstatechange = () => {
          const state = audioContextRef.current?.state;
          console.log('[AudioUnlock] AudioContext state changed to:', state);
          
          if (state === 'running' && !hasUnlockedRef.current) {
            hasUnlockedRef.current = true;
            setIsLocked(false);
            sessionStorage.setItem('audioUnlocked', 'true');
            onUnlockRef.current?.();
          }
          // Don't set locked again once unlocked - the session is good
        };
      }
    } catch (error) {
      console.warn('[AudioUnlock] Could not create AudioContext:', error);
    }

    // Create a silent audio element for unlocking
    const silentAudio = new Audio();
    silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    silentAudio.preload = 'auto';
    silentAudio.volume = 0.001;
    silentAudioRef.current = silentAudio;
    
    setIsInitialized(true);

    return () => {
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
      silentAudioRef.current = null;
    };
  }, []);

  /**
   * Unlock audio playback on iOS/Safari.
   * This must be called from a user gesture (click/touch).
   */
  const unlockAudio = useCallback(async (): Promise<boolean> => {
    // Already unlocked
    if (hasUnlockedRef.current) {
      setIsLocked(false);
      return true;
    }

    try {
      console.log('[AudioUnlock] Attempting to unlock audio...');
      
      // Step 1: Resume AudioContext
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('[AudioUnlock] AudioContext resumed, state:', audioContextRef.current.state);
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
        try {
          const oscillator = audioContextRef.current.createOscillator();
          const gainNode = audioContextRef.current.createGain();
          gainNode.gain.value = 0; // Silent
          oscillator.connect(gainNode);
          gainNode.connect(audioContextRef.current.destination);
          oscillator.start(0);
          oscillator.stop(audioContextRef.current.currentTime + 0.001);
          console.log('[AudioUnlock] Oscillator played');
        } catch (e) {
          console.warn('[AudioUnlock] Oscillator failed:', e);
        }
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
          mediaEl.muted = wasMuted;
          mediaEl.volume = wasVolume;
        }
      }

      // Mark as unlocked
      hasUnlockedRef.current = true;
      setIsLocked(false);
      sessionStorage.setItem('audioUnlocked', 'true');
      onUnlockRef.current?.();
      
      console.log('[AudioUnlock] Audio successfully unlocked');
      return true;
    } catch (error) {
      console.error('[AudioUnlock] Failed to unlock audio:', error);
      return false;
    }
  }, []);

  // Don't report locked state until initialized
  const effectiveIsLocked = isInitialized && isLocked && !hasUnlockedRef.current;

  return {
    isLocked: effectiveIsLocked,
    isIOSDevice,
    unlockAudio,
    audioContext: audioContextRef.current,
  };
};
