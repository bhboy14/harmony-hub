import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useSpotify } from "./SpotifyContext";

export type AudioSource = "spotify" | "local" | "youtube" | "pa" | null;

interface UnifiedAudioContextType {
  activeSource: AudioSource;
  currentTrack: any;
  isPlaying: boolean;
  progress: number;
  duration: number;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  setActiveSource: (source: AudioSource) => void;
}

const UnifiedAudioContext = createContext<UnifiedAudioContextType | null>(null);

export const UnifiedAudioProvider = ({ children }: { children: ReactNode }) => {
  const spotify = useSpotify();
  const [activeSource, setActiveSource] = useState<AudioSource>(null);

  // Sync active source if Spotify starts playing on its own
  useEffect(() => {
    if (spotify.playbackState?.isPlaying) {
      setActiveSource("spotify");
    }
  }, [spotify.playbackState?.isPlaying]);

  const play = async () => {
    if (activeSource === "spotify") await spotify.play();
  };

  const pause = async () => {
    if (activeSource === "spotify") await spotify.pause();
  };

  const seek = async (ms: number) => {
    if (activeSource === "spotify") await spotify.seek(ms);
  };

  // Construct the unified track object for the UI
  const currentTrack =
    activeSource === "spotify"
      ? {
          title: spotify.playbackState?.track?.name,
          artist: spotify.playbackState?.track?.artists.map((a) => a.name).join(", "),
          albumArt: spotify.playbackState?.track?.albumArt,
        }
      : null;

  return (
    <UnifiedAudioContext.Provider
      value={{
        activeSource,
        currentTrack,
        isPlaying: activeSource === "spotify" ? spotify.playbackState?.isPlaying || false : false,
        progress: activeSource === "spotify" ? spotify.playbackState?.progress || 0 : 0,
        duration: activeSource === "spotify" ? spotify.playbackState?.track?.duration_ms || 0 : 0,
        play,
        pause,
        seek,
        setActiveSource,
      }}
    >
      {children}
    </UnifiedAudioContext.Provider>
  );
};

export const useUnifiedAudio = () => {
  const context = useContext(UnifiedAudioContext);
  if (!context) throw new Error("useUnifiedAudio must be used within UnifiedAudioProvider");
  return context;
};
