import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useToast } from "@/hooks/use-toast";

export type AudioSource = "spotify" | "local" | "youtube" | "pa" | null;

export interface UnifiedTrack {
  id: string;
  title: string;
  artist: string;
  albumArt?: string;
  duration: number; // in ms
  source: AudioSource;
}

interface UnifiedAudioContextType {
  // Current state
  activeSource: AudioSource;
  currentTrack: UnifiedTrack | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  
  // Control functions
  play: () => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  
  // Source-specific controls
  playLocalTrack: (track: LocalTrackInfo) => Promise<void>;
  playYouTubeVideo: (videoId: string, title: string) => void;
  setActiveSource: (source: AudioSource) => void;
  
  // YouTube player ref registration
  registerYouTubePlayer: (player: any) => void;
  unregisterYouTubePlayer: () => void;
  
  // Local audio ref
  localAudioRef: React.RefObject<HTMLAudioElement | null>;
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

const UnifiedAudioContext = createContext<UnifiedAudioContextType | null>(null);

export const UnifiedAudioProvider = ({ children }: { children: ReactNode }) => {
  const spotify = useSpotify();
  const { toast } = useToast();
  
  const [activeSource, setActiveSourceState] = useState<AudioSource>(null);
  const [localTrack, setLocalTrack] = useState<LocalTrackInfo | null>(null);
  const [youtubeInfo, setYoutubeInfo] = useState<{ videoId: string; title: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(75);
  
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // Initialize local audio element
  useEffect(() => {
    localAudioRef.current = new Audio();
    localAudioRef.current.volume = volume / 100;
    
    const audio = localAudioRef.current;
    
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };
    
    const handleTimeUpdate = () => {
      if (audio) {
        setProgress(audio.currentTime * 1000);
        setDuration(audio.duration * 1000 || 0);
      }
    };
    
    const handleError = () => {
      toast({
        title: "Playback Error",
        description: "Could not play this track",
        variant: "destructive"
      });
      setIsPlaying(false);
    };
    
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('error', handleError);
    
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('error', handleError);
      audio.pause();
    };
  }, [toast]);

  // Update volume on local audio when volume changes
  useEffect(() => {
    if (localAudioRef.current) {
      localAudioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Sync with Spotify state when Spotify is active
  useEffect(() => {
    if (activeSource === 'spotify' && spotify.playbackState) {
      setIsPlaying(spotify.playbackState.isPlaying);
      setProgress(spotify.playbackState.progress);
      setDuration(spotify.playbackState.track?.duration_ms || 0);
      setVolumeState(spotify.playbackState.volume || 75);
    }
  }, [activeSource, spotify.playbackState]);

  // Auto-detect Spotify as active source when it starts playing
  useEffect(() => {
    if (spotify.playbackState?.isPlaying && activeSource !== 'spotify') {
      // Pause other sources
      pauseAllExcept('spotify');
      setActiveSourceState('spotify');
    }
  }, [spotify.playbackState?.isPlaying]);

  const pauseAllExcept = useCallback((except: AudioSource) => {
    if (except !== 'local' && localAudioRef.current) {
      localAudioRef.current.pause();
    }
    if (except !== 'youtube' && youtubePlayerRef.current?.pauseVideo) {
      youtubePlayerRef.current.pauseVideo();
    }
    if (except !== 'spotify' && spotify.playbackState?.isPlaying) {
      spotify.pause();
    }
  }, [spotify]);

  const setActiveSource = useCallback((source: AudioSource) => {
    if (source !== activeSource) {
      pauseAllExcept(source);
      setActiveSourceState(source);
    }
  }, [activeSource, pauseAllExcept]);

  const play = useCallback(async () => {
    switch (activeSource) {
      case 'spotify':
        await spotify.play();
        break;
      case 'local':
        if (localAudioRef.current) {
          await localAudioRef.current.play();
          setIsPlaying(true);
        }
        break;
      case 'youtube':
        if (youtubePlayerRef.current?.playVideo) {
          youtubePlayerRef.current.playVideo();
          setIsPlaying(true);
        }
        break;
    }
  }, [activeSource, spotify]);

  const pause = useCallback(async () => {
    switch (activeSource) {
      case 'spotify':
        await spotify.pause();
        break;
      case 'local':
        if (localAudioRef.current) {
          localAudioRef.current.pause();
          setIsPlaying(false);
        }
        break;
      case 'youtube':
        if (youtubePlayerRef.current?.pauseVideo) {
          youtubePlayerRef.current.pauseVideo();
          setIsPlaying(false);
        }
        break;
    }
  }, [activeSource, spotify]);

  const next = useCallback(async () => {
    if (activeSource === 'spotify') {
      await spotify.next();
    }
    // For local/youtube, you'd need a playlist implementation
  }, [activeSource, spotify]);

  const previous = useCallback(async () => {
    if (activeSource === 'spotify') {
      await spotify.previous();
    }
    // For local/youtube, you'd need a playlist implementation
  }, [activeSource, spotify]);

  const setVolume = useCallback(async (newVolume: number) => {
    setVolumeState(newVolume);
    
    switch (activeSource) {
      case 'spotify':
        await spotify.setVolume(newVolume);
        break;
      case 'local':
        if (localAudioRef.current) {
          localAudioRef.current.volume = newVolume / 100;
        }
        break;
      case 'youtube':
        if (youtubePlayerRef.current?.setVolume) {
          youtubePlayerRef.current.setVolume(newVolume);
        }
        break;
    }
  }, [activeSource, spotify]);

  const seek = useCallback(async (positionMs: number) => {
    switch (activeSource) {
      case 'local':
        if (localAudioRef.current) {
          localAudioRef.current.currentTime = positionMs / 1000;
          setProgress(positionMs);
        }
        break;
      case 'youtube':
        if (youtubePlayerRef.current?.seekTo) {
          youtubePlayerRef.current.seekTo(positionMs / 1000, true);
          setProgress(positionMs);
        }
        break;
      // Spotify seek would require additional API implementation
    }
  }, [activeSource]);

  const playLocalTrack = useCallback(async (track: LocalTrackInfo) => {
    if (!localAudioRef.current) return;
    
    // Pause other sources
    pauseAllExcept('local');
    
    try {
      localAudioRef.current.pause();
      
      if (track.fileHandle) {
        const file = await track.fileHandle.getFile();
        const url = URL.createObjectURL(file);
        localAudioRef.current.src = url;
      } else if (track.url) {
        localAudioRef.current.src = track.url;
      } else {
        throw new Error('No audio source');
      }
      
      await localAudioRef.current.play();
      setLocalTrack(track);
      setActiveSourceState('local');
      setIsPlaying(true);
      
      // Parse duration string to ms (format: "M:SS" or "H:MM:SS")
      const parts = track.duration.split(':').map(Number);
      let durationMs = 0;
      if (parts.length === 2) {
        durationMs = (parts[0] * 60 + parts[1]) * 1000;
      } else if (parts.length === 3) {
        durationMs = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
      }
      setDuration(durationMs);
      setProgress(0);
    } catch (err) {
      console.error('Play error:', err);
      toast({
        title: "Playback Error",
        description: "Could not play this track",
        variant: "destructive"
      });
    }
  }, [pauseAllExcept, toast]);

  const playYouTubeVideo = useCallback((videoId: string, title: string) => {
    pauseAllExcept('youtube');
    setYoutubeInfo({ videoId, title });
    setActiveSourceState('youtube');
  }, [pauseAllExcept]);

  const registerYouTubePlayer = useCallback((player: any) => {
    youtubePlayerRef.current = player;
    
    // Set up YouTube progress tracking
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    progressIntervalRef.current = window.setInterval(() => {
      if (youtubePlayerRef.current && activeSource === 'youtube') {
        const currentTime = youtubePlayerRef.current.getCurrentTime?.() || 0;
        const totalDuration = youtubePlayerRef.current.getDuration?.() || 0;
        setProgress(currentTime * 1000);
        setDuration(totalDuration * 1000);
      }
    }, 1000);
  }, [activeSource]);

  const unregisterYouTubePlayer = useCallback(() => {
    youtubePlayerRef.current = null;
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Build current track info based on active source
  const currentTrack: UnifiedTrack | null = (() => {
    switch (activeSource) {
      case 'spotify':
        if (spotify.playbackState?.track) {
          const t = spotify.playbackState.track;
          return {
            id: t.id,
            title: t.name,
            artist: t.artists.map(a => a.name).join(", "),
            albumArt: t.album.images[0]?.url,
            duration: t.duration_ms,
            source: 'spotify' as AudioSource,
          };
        }
        return null;
      case 'local':
        if (localTrack) {
          return {
            id: localTrack.id,
            title: localTrack.title,
            artist: localTrack.artist,
            albumArt: localTrack.albumArt,
            duration: duration,
            source: 'local' as AudioSource,
          };
        }
        return null;
      case 'youtube':
        if (youtubeInfo) {
          return {
            id: youtubeInfo.videoId,
            title: youtubeInfo.title,
            artist: 'YouTube',
            albumArt: `https://img.youtube.com/vi/${youtubeInfo.videoId}/mqdefault.jpg`,
            duration: duration,
            source: 'youtube' as AudioSource,
          };
        }
        return null;
      default:
        return null;
    }
  })();

  return (
    <UnifiedAudioContext.Provider
      value={{
        activeSource,
        currentTrack,
        isPlaying: activeSource === 'spotify' ? (spotify.playbackState?.isPlaying ?? false) : isPlaying,
        progress: activeSource === 'spotify' ? (spotify.playbackState?.progress ?? 0) : progress,
        duration: activeSource === 'spotify' ? (spotify.playbackState?.track?.duration_ms ?? 0) : duration,
        volume,
        play,
        pause,
        next,
        previous,
        setVolume,
        seek,
        playLocalTrack,
        playYouTubeVideo,
        setActiveSource,
        registerYouTubePlayer,
        unregisterYouTubePlayer,
        localAudioRef,
      }}
    >
      {children}
    </UnifiedAudioContext.Provider>
  );
};

export const useUnifiedAudio = () => {
  const context = useContext(UnifiedAudioContext);
  if (!context) {
    throw new Error("useUnifiedAudio must be used within a UnifiedAudioProvider");
  }
  return context;
};
