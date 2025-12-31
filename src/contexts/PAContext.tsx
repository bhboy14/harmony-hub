import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useToast } from "@/hooks/use-toast";

interface PAContextType {
  isLive: boolean;
  micVolume: number;
  setMicVolume: (volume: number) => void;
  startBroadcast: () => Promise<void>;
  stopBroadcast: () => Promise<void>;
  toggleBroadcast: () => Promise<void>;
}

const PAContext = createContext<PAContextType | null>(null);

export const PAProvider = ({ children }: { children: ReactNode }) => {
  const [isLive, setIsLive] = useState(false);
  const [micVolume, setMicVolume] = useState(80);
  const [musicDuckLevel] = useState(20);
  const [fadeInDuration] = useState(2);
  const [fadeOutDuration] = useState(2);
  const [autoDuck] = useState(true);
  
  const spotify = useSpotify();
  const { toast } = useToast();
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const preBroadcastVolumeRef = useRef<number>(100);

  // Update gain when volume changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = micVolume / 100;
    }
  }, [micVolume]);

  const startBroadcast = useCallback(async () => {
    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      mediaStreamRef.current = stream;
      
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = micVolume / 100;
      gainNodeRef.current = gainNode;
      
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Duck music if connected
      if (autoDuck && spotify.isConnected && spotify.playbackState?.isPlaying) {
        preBroadcastVolumeRef.current = spotify.playbackState.volume || 100;
        await spotify.fadeVolume(musicDuckLevel, fadeOutDuration * 1000);
      }
      
      setIsLive(true);
      toast({
        title: "Broadcast Started",
        description: "You are now live. Speak into your microphone.",
      });
    } catch (err) {
      console.error("Error starting broadcast:", err);
      toast({
        title: "Broadcast Failed",
        description: "Could not start broadcast. Check microphone permissions.",
        variant: "destructive"
      });
    }
  }, [micVolume, autoDuck, spotify, musicDuckLevel, fadeOutDuration, toast]);

  const stopBroadcast = useCallback(async () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (autoDuck && spotify.isConnected) {
      await spotify.fadeVolume(preBroadcastVolumeRef.current, fadeInDuration * 1000);
    }
    
    setIsLive(false);
    toast({
      title: "Broadcast Ended",
      description: "You are no longer live.",
    });
  }, [autoDuck, spotify, fadeInDuration, toast]);

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
