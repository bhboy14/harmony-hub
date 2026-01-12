import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import type { AudioSource } from "@/contexts/UnifiedAudioContext";
import { useToast } from "@/hooks/use-toast";

interface PAContextType {
  isLive: boolean;
  micVolume: number;
  audioLevel: number;
  setMicVolume: (volume: number) => void;
  startBroadcast: () => Promise<void>;
  stopBroadcast: () => Promise<void>;
  toggleBroadcast: () => Promise<void>;
}

const PAContext = createContext<PAContextType | null>(null);

export const PAProvider = ({ children }: { children: ReactNode }) => {
  const [isLive, setIsLive] = useState(false);
  const [micVolume, setMicVolume] = useState(80);
  const [audioLevel, setAudioLevel] = useState(0);
  const [musicDuckLevel] = useState(20);
  const [fadeInDuration] = useState(2);
  const [fadeOutDuration] = useState(2);
  const [autoDuck] = useState(true);
  
  const { toast } = useToast();
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const preBroadcastStateRef = useRef<{ previousVolume: number; wasPlaying: boolean; activeSource: AudioSource } | null>(null);

  // Update gain when volume changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = micVolume / 100;
    }
  }, [micVolume]);

  // Audio level monitoring
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isLive) {
      setAudioLevel(0);
      return;
    }

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calculate average level
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = Math.min(100, (average / 128) * 100);
    
    setAudioLevel(normalizedLevel);
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, [isLive]);

  // Start/stop audio level monitoring
  useEffect(() => {
    if (isLive && analyserRef.current) {
      updateAudioLevel();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isLive, updateAudioLevel]);

  // Helper to get unified audio context dynamically (lazy load to avoid provider order issues)
  const getUnifiedAudioContext = useCallback(async () => {
    try {
      const { useUnifiedAudio } = await import("@/contexts/UnifiedAudioContext");
      // We can't call a hook here, so we need a different approach
      // Instead, we'll access it through a global event system or skip ducking
      return null;
    } catch {
      return null;
    }
  }, []);

  const startBroadcast = useCallback(async () => {
    try {
      // Start mic FIRST for instant response
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      mediaStreamRef.current = stream;
      
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      
      // Create analyser for level metering
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      
      const gainNode = audioContext.createGain();
      gainNode.gain.value = micVolume / 100;
      gainNodeRef.current = gainNode;
      
      // Connect: source -> analyser -> gain -> destination
      source.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Set live state IMMEDIATELY so UI responds
      setIsLive(true);
      
      toast({
        title: "Broadcast Started",
        description: "You are now live!",
      });
      
      // Dispatch custom event for audio ducking (UnifiedAudioContext can listen)
      if (autoDuck) {
        window.dispatchEvent(new CustomEvent('pa-broadcast-start', { 
          detail: { musicDuckLevel, fadeOutDuration: fadeOutDuration * 1000 } 
        }));
      }
    } catch (err) {
      console.error("Error starting broadcast:", err);
      toast({
        title: "Broadcast Failed",
        description: "Could not start broadcast. Check microphone permissions.",
        variant: "destructive"
      });
    }
  }, [micVolume, autoDuck, musicDuckLevel, fadeOutDuration, toast]);

  const stopBroadcast = useCallback(async () => {
    // Cancel animation frame FIRST
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Disconnect and clear gain node
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch (e) {
        // Already disconnected
      }
      gainNodeRef.current = null;
    }
    
    // Disconnect and clear analyser
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (e) {
        // Already disconnected
      }
      analyserRef.current = null;
    }
    
    // Stop ALL media tracks - this is critical to stop the mic
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      mediaStreamRef.current = null;
    }
    
    // Close audio context AFTER disconnecting nodes
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch (e) {
        console.warn('Error closing audio context:', e);
      }
      audioContextRef.current = null;
    }
    
    // Reset audio level
    setAudioLevel(0);
    
    // Set isLive to false BEFORE restoring audio
    setIsLive(false);
    
    // Dispatch custom event to restore audio
    if (autoDuck) {
      window.dispatchEvent(new CustomEvent('pa-broadcast-stop', { 
        detail: { fadeInDuration: fadeInDuration * 1000 } 
      }));
    }
    
    toast({
      title: "Broadcast Ended",
      description: "Microphone stopped. Music playback resumed.",
    });
  }, [autoDuck, fadeInDuration, toast]);

  const toggleBroadcast = useCallback(async () => {
    if (isLive) {
      await stopBroadcast();
    } else {
      await startBroadcast();
    }
  }, [isLive, startBroadcast, stopBroadcast]);

  return (
    <PAContext.Provider
      value={{
        isLive,
        micVolume,
        audioLevel,
        setMicVolume,
        startBroadcast,
        stopBroadcast,
        toggleBroadcast,
      }}
    >
      {children}
    </PAContext.Provider>
  );
};

export const usePA = () => {
  const context = useContext(PAContext);
  if (!context) {
    throw new Error("usePA must be used within a PAProvider");
  }
  return context;
};
