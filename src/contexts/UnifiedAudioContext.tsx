import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useSoundCloud } from "@/contexts/SoundCloudContext";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedQueue, QueueTrack } from "@/hooks/useUnifiedQueue";
import { useAuth } from "@/contexts/AuthContext";

export type AudioSource = "spotify" | "local" | "youtube" | "soundcloud" | "pa" | null;

export interface UnifiedTrack {
  id: string;
  title: string;
  artist: string;
  albumArt?: string;
  duration: number;
  source: AudioSource;
}

interface UnifiedAudioContextType {
  activeSource: AudioSource;
  currentTrack: UnifiedTrack | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setGlobalVolume: (volume: number) => Promise<void>;
  toggleMute: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  playTrack: (track: PlayableTrack) => Promise<void>;
  playLocalTrack: (track: LocalTrackInfo) => Promise<void>;
  playYouTubeVideo: (videoId: string, title: string) => void;
  playSoundCloudTrack: (track: any) => Promise<void>;
  setActiveSource: (source: AudioSource) => void;
  registerYouTubePlayer: (player: any) => void;
  unregisterYouTubePlayer: () => void;
  localAudioRef: React.RefObject<HTMLAudioElement | null>;
  fadeAllAndPause: (targetVolume: number, durationMs: number) => Promise<any>;
  resumeAll: (state: any, durationMs: number) => Promise<void>;
  stopAllAudio: () => Promise<void>;
  queue: QueueTrack[];
  queueHistory: QueueTrack[];
  currentQueueIndex: number;
  upcomingTracks: QueueTrack[];
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  addToQueue: (track: any) => QueueTrack;
  addMultipleToQueue: (tracks: any[]) => QueueTrack[];
  playNext: (track: any) => QueueTrack;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  clearUpcoming: () => void;
  playQueueTrack: (index: number) => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  isSyncing: boolean;
  connectedDevices: number;
  broadcastPlaybackState: (action: string) => void;
}

export interface LocalTrackInfo {
  id: string;
  title: string;
  artist: string;
  duration: string;
  fileHandle?: any;
  url?: string;
  albumArt?: string;
}

export interface PlayableTrack {
  id: string;
  title: string;
  artist: string;
  albumArt?: string;
  duration: number;
  source: AudioSource;
  externalId?: string;
  url?: string;
}

const UnifiedAudioContext = createContext<UnifiedAudioContextType | null>(null);

export const UnifiedAudioProvider = ({ children }: { children: ReactNode }) => {
  const spotify = useSpotify();
  const soundcloud = useSoundCloud();
  const { toast } = useToast();
  const { user } = useAuth();
  const queueManager = useUnifiedQueue();

  const [activeSource, setActiveSourceState] = useState<AudioSource>(null);
  const [localTrack, setLocalTrack] = useState<LocalTrackInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(75);
  const [isMuted, setIsMuted] = useState(false);
  const [youtubeTrack, setYoutubeTrack] = useState<{ videoId: string; title: string } | null>(null);

  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state with Spotify Context when Spotify is active
  useEffect(() => {
    if (spotify.playbackState?.track && activeSource === "spotify") {
      setIsPlaying(spotify.playbackState.isPlaying);
      setProgress(spotify.playbackState.progress);
      setDuration(spotify.playbackState.track.duration_ms);
    }
  }, [spotify.playbackState, activeSource]);

  // Auto-detect Spotify playback
  useEffect(() => {
    if (spotify.playbackState?.isPlaying && activeSource !== "spotify") {
      setActiveSourceState("spotify");
    }
  }, [spotify.playbackState?.isPlaying, activeSource]);

  // Local audio progress tracking
  useEffect(() => {
    if (activeSource === "local" && isPlaying && localAudioRef.current) {
      progressIntervalRef.current = setInterval(() => {
        if (localAudioRef.current) {
          setProgress(localAudioRef.current.currentTime * 1000);
        }
      }, 250);
    }
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [activeSource, isPlaying]);

  const stopAllAudio = useCallback(async () => {
    // Stop local audio
    if (localAudioRef.current) {
      localAudioRef.current.pause();
      localAudioRef.current.currentTime = 0;
    }
    // Pause Spotify
    if (spotify.isConnected && spotify.playbackState?.isPlaying) {
      try {
        await spotify.pause();
      } catch {}
    }
    // Stop YouTube
    if (youtubePlayerRef.current?.pauseVideo) {
      youtubePlayerRef.current.pauseVideo();
    }
    setIsPlaying(false);
  }, [spotify]);

  const play = useCallback(async () => {
    if (activeSource === "spotify") {
      await spotify.play();
    } else if (activeSource === "local" && localAudioRef.current) {
      await localAudioRef.current.play();
      setIsPlaying(true);
    } else if (activeSource === "youtube" && youtubePlayerRef.current?.playVideo) {
      youtubePlayerRef.current.playVideo();
      setIsPlaying(true);
    }
  }, [activeSource, spotify]);

  const pause = useCallback(async () => {
    if (activeSource === "spotify") {
      await spotify.pause();
    } else if (activeSource === "local" && localAudioRef.current) {
      localAudioRef.current.pause();
      setIsPlaying(false);
    } else if (activeSource === "youtube" && youtubePlayerRef.current?.pauseVideo) {
      youtubePlayerRef.current.pauseVideo();
      setIsPlaying(false);
    }
  }, [activeSource, spotify]);

  const seek = useCallback(async (ms: number) => {
    if (activeSource === "spotify") {
      await spotify.seek(ms);
    } else if (activeSource === "local" && localAudioRef.current) {
      localAudioRef.current.currentTime = ms / 1000;
      setProgress(ms);
    } else if (activeSource === "youtube" && youtubePlayerRef.current?.seekTo) {
      youtubePlayerRef.current.seekTo(ms / 1000, true);
      setProgress(ms);
    }
  }, [activeSource, spotify]);

  const playLocalTrack = useCallback(async (track: LocalTrackInfo) => {
    await stopAllAudio();
    
    setActiveSourceState("local");
    setLocalTrack(track);
    
    if (track.url && localAudioRef.current) {
      localAudioRef.current.src = track.url;
      localAudioRef.current.load();
      
      localAudioRef.current.onloadedmetadata = () => {
        if (localAudioRef.current) {
          setDuration(localAudioRef.current.duration * 1000);
          localAudioRef.current.play();
          setIsPlaying(true);
        }
      };
      
      localAudioRef.current.onended = () => {
        setIsPlaying(false);
        setProgress(0);
      };
    }
  }, [stopAllAudio]);

  const playYouTubeVideo = useCallback((videoId: string, title: string) => {
    stopAllAudio();
    setActiveSourceState("youtube");
    setYoutubeTrack({ videoId, title });
    setIsPlaying(true);
  }, [stopAllAudio]);

  const playTrack = useCallback(async (track: PlayableTrack) => {
    await stopAllAudio();
    
    if (track.source === "spotify" && track.externalId) {
      setActiveSourceState("spotify");
      await spotify.play(`spotify:track:${track.externalId}`);
    } else if (track.source === "local" && track.url) {
      await playLocalTrack({
        id: track.id,
        title: track.title,
        artist: track.artist,
        duration: String(track.duration),
        url: track.url,
        albumArt: track.albumArt,
      });
    } else if (track.source === "youtube" && track.externalId) {
      playYouTubeVideo(track.externalId, track.title);
    }
  }, [stopAllAudio, spotify, playLocalTrack, playYouTubeVideo]);

  const playSoundCloudTrack = useCallback(async (track: any) => {
    await stopAllAudio();
    setActiveSourceState("soundcloud");
    // SoundCloud integration would go here
  }, [stopAllAudio]);

  // Build the current track from active source
  const currentTrack: UnifiedTrack | null = (() => {
    if (activeSource === "spotify" && spotify.playbackState?.track) {
      const t = spotify.playbackState.track;
      return {
        id: t.id,
        title: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        albumArt: t.albumArt || t.album?.images?.[0]?.url,
        duration: t.duration_ms,
        source: "spotify" as AudioSource,
      };
    }
    if (activeSource === "local" && localTrack) {
      return {
        id: localTrack.id,
        title: localTrack.title,
        artist: localTrack.artist,
        albumArt: localTrack.albumArt,
        duration,
        source: "local" as AudioSource,
      };
    }
    if (activeSource === "youtube" && youtubeTrack) {
      return {
        id: youtubeTrack.videoId,
        title: youtubeTrack.title,
        artist: "YouTube",
        albumArt: `https://img.youtube.com/vi/${youtubeTrack.videoId}/mqdefault.jpg`,
        duration,
        source: "youtube" as AudioSource,
      };
    }
    return null;
  })();

  const setGlobalVolume = useCallback(async (v: number) => {
    setVolumeState(v);
    if (localAudioRef.current) {
      localAudioRef.current.volume = v / 100;
    }
    if (activeSource === "spotify" && spotify.isConnected) {
      await spotify.setVolume(v);
    }
  }, [activeSource, spotify]);

  const toggleMute = useCallback(async () => {
    setIsMuted(!isMuted);
    if (localAudioRef.current) {
      localAudioRef.current.muted = !isMuted;
    }
  }, [isMuted]);

  const fadeAllAndPause = useCallback(async (targetVolume: number, durationMs: number) => {
    const savedState = { volume, isPlaying };
    // Simple fade implementation
    if (localAudioRef.current) {
      localAudioRef.current.volume = targetVolume / 100;
    }
    return savedState;
  }, [volume, isPlaying]);

  const resumeAll = useCallback(async (state: any, durationMs: number) => {
    if (state && localAudioRef.current) {
      localAudioRef.current.volume = state.volume / 100;
    }
  }, []);

  const registerYouTubePlayer = useCallback((player: any) => {
    youtubePlayerRef.current = player;
  }, []);

  const unregisterYouTubePlayer = useCallback(() => {
    youtubePlayerRef.current = null;
  }, []);

  const next = useCallback(async () => {
    if (activeSource === "spotify") {
      // Would call spotify.next() if implemented
    }
    // Queue navigation would go here
  }, [activeSource]);

  const previous = useCallback(async () => {
    if (activeSource === "spotify") {
      // Would call spotify.previous() if implemented
    }
  }, [activeSource]);

  const playQueueTrack = useCallback(async (index: number) => {
    const track = queueManager.playTrackAtIndex(index);
    if (track) {
      await playTrack({
        id: track.id,
        title: track.title,
        artist: track.artist,
        albumArt: track.albumArt,
        duration: track.duration,
        source: track.source as AudioSource,
        externalId: track.externalId,
        url: track.url,
      });
    }
  }, [queueManager, playTrack]);

  return (
    <UnifiedAudioContext.Provider
      value={{
        activeSource,
        currentTrack,
        isPlaying,
        progress,
        duration,
        volume,
        isMuted,
        isLoading: false,
        play,
        pause,
        next,
        previous,
        setVolume: async (v) => setVolumeState(v),
        setGlobalVolume,
        toggleMute,
        seek,
        playTrack,
        playLocalTrack,
        playYouTubeVideo,
        playSoundCloudTrack,
        setActiveSource: (s) => setActiveSourceState(s),
        registerYouTubePlayer,
        unregisterYouTubePlayer,
        localAudioRef,
        fadeAllAndPause,
        resumeAll,
        stopAllAudio,
        queue: queueManager.queue,
        queueHistory: queueManager.history,
        currentQueueIndex: queueManager.currentIndex,
        upcomingTracks: queueManager.upcomingTracks,
        shuffle: queueManager.shuffle,
        repeat: queueManager.repeat,
        addToQueue: queueManager.addToQueue,
        addMultipleToQueue: queueManager.addMultipleToQueue,
        playNext: queueManager.playNext,
        removeFromQueue: queueManager.removeFromQueue,
        clearQueue: queueManager.clearQueue,
        clearUpcoming: queueManager.clearUpcoming,
        playQueueTrack,
        toggleShuffle: queueManager.toggleShuffle,
        toggleRepeat: queueManager.toggleRepeat,
        isSyncing: false,
        connectedDevices: 0,
        broadcastPlaybackState: () => {},
      }}
    >
      {/* Hidden audio element for local playback */}
      <audio ref={localAudioRef} style={{ display: 'none' }} />
      {children}
    </UnifiedAudioContext.Provider>
  );
};

export const useUnifiedAudio = () => {
  const context = useContext(UnifiedAudioContext);
  if (!context) throw new Error("useUnifiedAudio must be used within UnifiedAudioProvider");
  return context;
};
