import { useState, useEffect, useCallback, useRef } from "react";

interface UseStationUnlockOptions {
  onUnlock?: () => void;
}

interface UseStationUnlockReturn {
  isUnlocked: boolean;
  isUnlocking: boolean;
  needsUnlock: boolean;
  hasMicPermission: boolean;
  hasSpeakerPermission: boolean;
  isIOSDevice: boolean;
  unlockStation: () => Promise<boolean>;
}

/**
 * Unified hook to handle all audio permissions in a single user action.
 * Consolidates:
 * - iOS/Safari audio context unlock
 * - Microphone permission (getUserMedia)
 * - Speaker selection permission (selectAudioOutput)
 * 
 * This ONLY requests permissions when the user explicitly clicks the unlock button.
 */
export const useStationUnlock = (options: UseStationUnlockOptions = {}): UseStationUnlockReturn => {
  const { onUnlock } = options;
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [hasSpeakerPermission, setHasSpeakerPermission] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const onUnlockRef = useRef(onUnlock);

  // Keep callback ref updated
  useEffect(() => {
    onUnlockRef.current = onUnlock;
  }, [onUnlock]);

  // Detect iOS/Safari and check existing permissions (without prompting)
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    setIsIOSDevice(isIOS || (isSafari && isMobile));

    // Check session storage for previous unlock
    const wasUnlocked = sessionStorage.getItem('stationUnlocked') === 'true';
    if (wasUnlocked) {
      setIsUnlocked(true);
      setHasMicPermission(true);
      setHasSpeakerPermission(true);
    }

    // Passively check if we already have permissions (don't prompt)
    if ('permissions' in navigator) {
      // Check microphone permission status without prompting
      (navigator.permissions as any).query?.({ name: 'microphone' as any })
        .then((result: PermissionStatus) => {
          if (result.state === 'granted') {
            setHasMicPermission(true);
          }
        })
        .catch(() => {
          // Permission query not supported for microphone
        });
    }

    // Check if we can enumerate devices (indicates previous permission)
    navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        // If we have labels, we have permission
        const hasLabels = devices.some(d => d.label);
        if (hasLabels) {
          setHasMicPermission(true);
        }
      })
      .catch(() => {});

  }, []);

  /**
   * Unlock the station - requests all permissions in one user gesture.
   * This MUST be called from a click/touch event handler.
   */
  const unlockStation = useCallback(async (): Promise<boolean> => {
    if (isUnlocked) return true;
    
    setIsUnlocking(true);
    console.log('[StationUnlock] Starting unlock sequence...');

    try {
      // Step 1: Resume/Create AudioContext (for iOS)
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioContextClass();
          }
          
          if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
            console.log('[StationUnlock] AudioContext resumed');
          }
        }
      } catch (e) {
        console.warn('[StationUnlock] AudioContext error:', e);
      }

      // Step 2: Play silent audio (iOS unlock trick)
      try {
        const silentAudio = new Audio();
        silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        silentAudio.volume = 0.001;
        silentAudio.muted = true;
        await silentAudio.play();
        silentAudio.pause();
        silentAudio.muted = false;
        console.log('[StationUnlock] Silent audio played');
      } catch (e) {
        console.warn('[StationUnlock] Silent audio error:', e);
      }

      // Step 3: Play oscillator (belt and suspenders for iOS)
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
        try {
          const oscillator = audioContextRef.current.createOscillator();
          const gainNode = audioContextRef.current.createGain();
          gainNode.gain.value = 0;
          oscillator.connect(gainNode);
          gainNode.connect(audioContextRef.current.destination);
          oscillator.start(0);
          oscillator.stop(audioContextRef.current.currentTime + 0.001);
          console.log('[StationUnlock] Oscillator played');
        } catch (e) {
          console.warn('[StationUnlock] Oscillator error:', e);
        }
      }

      // Step 4: Request microphone permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop tracks immediately - we just needed the permission
        stream.getTracks().forEach(track => track.stop());
        setHasMicPermission(true);
        console.log('[StationUnlock] Microphone permission granted');
      } catch (e: any) {
        console.warn('[StationUnlock] Microphone permission denied or error:', e);
        // Continue even if mic permission is denied
      }

      // Step 5: Request speaker selection permission (if supported)
      const mediaDevices = navigator.mediaDevices as any;
      if (typeof mediaDevices?.selectAudioOutput === 'function') {
        try {
          await mediaDevices.selectAudioOutput();
          setHasSpeakerPermission(true);
          console.log('[StationUnlock] Speaker selection permission granted');
        } catch (e: any) {
          // User may cancel - that's OK
          if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
            console.warn('[StationUnlock] Speaker selection error:', e);
          }
        }
      } else {
        // Not supported - consider it "granted" since we can't request it
        setHasSpeakerPermission(true);
      }

      // Step 6: Unlock any existing audio/video elements on the page
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
        } catch (e) {
          // Ignore play errors
        } finally {
          mediaEl.muted = wasMuted;
          mediaEl.volume = wasVolume;
        }
      }

      // Mark as unlocked
      setIsUnlocked(true);
      sessionStorage.setItem('stationUnlocked', 'true');
      onUnlockRef.current?.();
      
      console.log('[StationUnlock] Station unlocked successfully');
      return true;
    } catch (error) {
      console.error('[StationUnlock] Failed to unlock station:', error);
      return false;
    } finally {
      setIsUnlocking(false);
    }
  }, [isUnlocked]);

  // Determine if unlock is needed
  const needsUnlock = !isUnlocked && (isIOSDevice || !hasMicPermission);

  return {
    isUnlocked,
    isUnlocking,
    needsUnlock,
    hasMicPermission,
    hasSpeakerPermission,
    isIOSDevice,
    unlockStation,
  };
};
