import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

interface UseAudioOutputOptions {
  audioElement?: HTMLAudioElement | null;
}

// Type assertions for experimental browser APIs
// These are not in the standard TS lib but are available in Chrome/Edge

export const useAudioOutput = (options: UseAudioOutputOptions = {}) => {
  const { audioElement } = options;
  const { toast } = useToast();
  
  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [isSelectorSupported, setIsSelectorSupported] = useState(false);
  
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Check for API support
  useEffect(() => {
    // Check if setSinkId is supported (for programmatic device selection)
    const testAudio = document.createElement('audio') as any;
    const hasSinkId = typeof testAudio.setSinkId === 'function';
    setIsSupported(hasSinkId);

    // Check if selectAudioOutput is supported (for user-triggered picker)
    const mediaDevices = navigator.mediaDevices as any;
    const hasSelector = typeof mediaDevices?.selectAudioOutput === 'function';
    setIsSelectorSupported(hasSelector);

    console.log('[AudioOutput] setSinkId supported:', hasSinkId);
    console.log('[AudioOutput] selectAudioOutput supported:', hasSelector);
  }, []);

  // Update audio element ref
  useEffect(() => {
    if (audioElement) {
      audioElementRef.current = audioElement;
    }
  }, [audioElement]);

  // Enumerate audio output devices (NO permission prompt - passive only)
  const refreshDevices = useCallback(async () => {
    if (!isSupported) return;

    try {
      // DO NOT request getUserMedia here - it causes flashing permission prompts
      // Just enumerate what we can see
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const outputDevices = allDevices
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker ${device.deviceId.slice(0, 8)}`,
          groupId: device.groupId,
        }));

      setDevices(outputDevices);
      console.log('[AudioOutput] Available devices:', outputDevices);
    } catch (err) {
      console.error('[AudioOutput] Failed to enumerate devices:', err);
    }
  }, [isSupported]);

  // Listen for device changes
  useEffect(() => {
    if (!isSupported) return;

    refreshDevices();

    const handleDeviceChange = () => {
      console.log('[AudioOutput] Device change detected');
      refreshDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [isSupported, refreshDevices]);

  // Set audio output device - try multiple audio elements
  const setOutputDevice = useCallback(async (deviceId: string) => {
    // Try the provided audio element first
    let audio = audioElementRef.current as any;
    
    // If no audio element provided, try to find all audio/video elements in the page
    if (!audio) {
      const allAudioElements = [
        ...document.querySelectorAll('audio'),
        ...document.querySelectorAll('video')
      ];
      audio = allAudioElements[0] as any;
    }
    
    // Check if setSinkId is supported at all
    const testAudio = document.createElement('audio') as any;
    if (typeof testAudio.setSinkId !== 'function') {
      toast({
        title: "Browser Limitation",
        description: "Your browser doesn't support audio output selection. Try Chrome or Edge.",
        variant: "destructive",
      });
      return false;
    }

    // If we have an audio element, set its sink
    if (audio && typeof audio.setSinkId === 'function') {
      try {
        await audio.setSinkId(deviceId);
        setCurrentDeviceId(deviceId);
        
        const device = devices.find(d => d.deviceId === deviceId);
        toast({
          title: "Audio Output Changed",
          description: `Now playing through ${device?.label || 'Selected device'}`,
        });
        
        console.log('[AudioOutput] Set output to:', deviceId);
        return true;
      } catch (err) {
        console.error('[AudioOutput] Failed to set output device:', err);
        toast({
          title: "Failed to Change Output",
          description: "Could not switch to the selected audio device. Make sure audio is playing.",
          variant: "destructive",
        });
        return false;
      }
    } else {
      // No active audio element - just update the preference
      setCurrentDeviceId(deviceId);
      const device = devices.find(d => d.deviceId === deviceId);
      toast({
        title: "Output Device Selected",
        description: `${device?.label || 'Device'} will be used when audio starts playing.`,
      });
      console.log('[AudioOutput] Saved preference for device:', deviceId);
      return true;
    }
  }, [devices, toast]);

  // Use browser's native audio output picker (requires user gesture)
  const showOutputPicker = useCallback(async () => {
    const mediaDevices = navigator.mediaDevices as any;
    if (typeof mediaDevices?.selectAudioOutput !== 'function') {
      // Don't show error - just return null and let the caller handle it
      console.log('[AudioOutput] selectAudioOutput not supported in this browser');
      return null;
    }

    try {
      const device = await mediaDevices.selectAudioOutput();
      console.log('[AudioOutput] User selected:', device);
      
      // If we have an audio element, set it to use this device
      const audio = audioElementRef.current as any;
      if (audio && typeof audio.setSinkId === 'function') {
        await audio.setSinkId(device.deviceId);
        setCurrentDeviceId(device.deviceId);
      }

      toast({
        title: "Audio Output Changed",
        description: `Now playing through ${device.label}`,
      });

      // Refresh device list
      await refreshDevices();

      return device;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        toast({
          title: "Permission Denied",
          description: "Please allow access to select an audio output device",
          variant: "destructive",
        });
      } else {
        console.error('[AudioOutput] Failed to select output:', err);
      }
      return null;
    }
  }, [refreshDevices, toast]);

  return {
    devices,
    currentDeviceId,
    isSupported,
    isSelectorSupported,
    setOutputDevice,
    showOutputPicker,
    refreshDevices,
    setAudioElement: (el: HTMLAudioElement | null) => {
      audioElementRef.current = el;
    },
  };
};
