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

  // Enumerate audio output devices
  const refreshDevices = useCallback(async () => {
    if (!isSupported) return;

    try {
      // Request microphone permission first to get device labels
      // (browsers require some media permission to show device labels)
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        // Permission denied or not available - continue anyway
      }

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

  // Set audio output device
  const setOutputDevice = useCallback(async (deviceId: string) => {
    const audio = audioElementRef.current as any;
    if (!audio || typeof audio.setSinkId !== 'function') {
      toast({
        title: "Not Supported",
        description: "Audio output selection is not supported in your browser",
        variant: "destructive",
      });
      return false;
    }

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
        description: "Could not switch to the selected audio device",
        variant: "destructive",
      });
      return false;
    }
  }, [devices, toast]);

  // Use browser's native audio output picker (requires user gesture)
  const showOutputPicker = useCallback(async () => {
    const mediaDevices = navigator.mediaDevices as any;
    if (typeof mediaDevices?.selectAudioOutput !== 'function') {
      toast({
        title: "Not Supported",
        description: "Audio output picker is not available in your browser. Try Chrome or Edge.",
        variant: "destructive",
      });
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
