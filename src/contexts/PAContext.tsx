import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { useUnifiedAudio, AudioSource } from "@/contexts/UnifiedAudioContext";
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
  
  const unifiedAudio = useUnifiedAudio();
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
      
      // Duck audio in BACKGROUND (don't await) so mic starts instantly
      if (autoDuck && (unifiedAudio.isPlaying || unifiedAudio.activeSource)) {
        unifiedAudio.fadeAllAndPause(musicDuckLevel, fadeOutDuration * 1000)
          .then(state => {
            preBroadcastStateRef.current = state;
          })
          .catch(err => {
            console.warn('Could not duck audio:', err);
          });
      }
    } catch (err) {
      console.error("Error starting broadcast:", err);
      toast({
        title: "Broadcast Failed",
        description: "Could not start broadcast. Check microphone permissions.",
        variant: "destructive"
      });
    }
  }, [micVolume, autoDuck, unifiedAudio, musicDuckLevel, fadeOutDuration, toast]);

  const stopBroadcast = useCallback(async () => {
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    setAudioLevel(0);
    
    // Restore ALL audio sources
    if (autoDuck && preBroadcastStateRef.current) {
      try {
        await unifiedAudio.resumeAll(preBroadcastStateRef.current, fadeInDuration * 1000);
        preBroadcastStateRef.current = null;
      } catch (err) {
        console.warn('Could not restore audio:', err);
      }
    }
    
    setIsLive(false);
    toast({
      title: "Broadcast Ended",
      description: "Music playback has been resumed.",
    });
  }, [autoDuck, unifiedAudio, fadeInDuration, toast]);

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
