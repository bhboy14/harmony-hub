import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useSoundCloud } from "@/contexts/SoundCloudContext";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedQueue, QueueTrack } from "@/hooks/useUnifiedQueue";

export type AudioSource = "spotify" | "local" | "youtube" | "soundcloud" | "pa" | null;

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
  playSoundCloudTrack: (track: { id: string; title: string; artist: string; albumArt?: string; duration: number; streamUrl: string }) => Promise<void>;
  setActiveSource: (source: AudioSource) => void;
  
  // YouTube player ref registration
  registerYouTubePlayer: (player: any) => void;
  unregisterYouTubePlayer: () => void;
  
  // Local audio ref
  localAudioRef: React.RefObject<HTMLAudioElement | null>;
  
  // Queue management
  queue: QueueTrack[];
  queueHistory: QueueTrack[];
  currentQueueIndex: number;
  upcomingTracks: QueueTrack[];
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  addToQueue: (track: Omit<QueueTrack, 'queueId'>) => QueueTrack;
  addMultipleToQueue: (tracks: Omit<QueueTrack, 'queueId'>[]) => QueueTrack[];
  playNext: (track: Omit<QueueTrack, 'queueId'>) => QueueTrack;
  removeFromQueue: (queueId: string) => void;
  clearQueue: () => void;
  clearUpcoming: () => void;
  playQueueTrack: (index: number) => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
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
  const soundcloud = useSoundCloud();
  const { toast } = useToast();
  
  // Queue management
  const queueManager = useUnifiedQueue();
  
  const [activeSource, setActiveSourceState] = useState<AudioSource>(null);
  const [localTrack, setLocalTrack] = useState<LocalTrackInfo | null>(null);
  const [soundcloudTrack, setSoundcloudTrack] = useState<{ id: string; title: string; artist: string; albumArt?: string; duration: number } | null>(null);
  const [youtubeInfo, setYoutubeInfo] = useState<{ videoId: string; title: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(75);
  
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const soundcloudAudioRef = useRef<HTMLAudioElement | null>(null);
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

  // Initialize SoundCloud audio element
  useEffect(() => {
    soundcloudAudioRef.current = new Audio();
    soundcloudAudioRef.current.volume = volume / 100;
    
    const audio = soundcloudAudioRef.current;
    
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      // Auto-play next in queue
      handleQueueNext();
    };
    
    const handleTimeUpdate = () => {
      if (audio && activeSource === 'soundcloud') {
        setProgress(audio.currentTime * 1000);
        setDuration(audio.duration * 1000 || 0);
      }
    };
    
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.pause();
    };
  }, []);

  // Update volume on local audio when volume changes
  useEffect(() => {
    if (localAudioRef.current) {
      localAudioRef.current.volume = volume / 100;
    }
    if (soundcloudAudioRef.current) {
      soundcloudAudioRef.current.volume = volume / 100;
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
    if (except !== 'soundcloud' && soundcloudAudioRef.current) {
      soundcloudAudioRef.current.pause();
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

  // Handle queue next track
  const handleQueueNext = useCallback(async () => {
    const nextTrack = queueManager.goToNext();
    if (nextTrack) {
      await playQueueTrackInternal(nextTrack);
    }
  }, [queueManager]);

  // Play a track from the queue
  const playQueueTrackInternal = useCallback(async (track: QueueTrack) => {
    pauseAllExcept(track.source);
    
    switch (track.source) {
      case 'spotify':
        if (track.externalId) {
          await spotify.play(`spotify:track:${track.externalId}`);
        }
        setActiveSourceState('spotify');
        break;
      case 'local':
        if (localAudioRef.current && track.url) {
          localAudioRef.current.src = track.url;
          await localAudioRef.current.play();
          setLocalTrack({
            id: track.id,
            title: track.title,
            artist: track.artist,
            duration: formatMsToString(track.duration),
            url: track.url,
            albumArt: track.albumArt,
          });
          setActiveSourceState('local');
          setIsPlaying(true);
        }
        break;
      case 'soundcloud':
        if (soundcloudAudioRef.current && track.url) {
          soundcloudAudioRef.current.src = track.url;
          await soundcloudAudioRef.current.play();
          setSoundcloudTrack({
            id: track.id,
            title: track.title,
            artist: track.artist,
            albumArt: track.albumArt,
            duration: track.duration,
          });
          setActiveSourceState('soundcloud');
          setIsPlaying(true);
        }
        break;
      case 'youtube':
        if (track.externalId) {
          setYoutubeInfo({ videoId: track.externalId, title: track.title });
          setActiveSourceState('youtube');
        }
        break;
    }
  }, [pauseAllExcept, spotify]);

  const formatMsToString = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      case 'soundcloud':
        if (soundcloudAudioRef.current) {
          await soundcloudAudioRef.current.play();
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
      case 'soundcloud':
        if (soundcloudAudioRef.current) {
          soundcloudAudioRef.current.pause();
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
    // Use queue if available
    const nextTrack = queueManager.goToNext();
    if (nextTrack) {
      await playQueueTrackInternal(nextTrack);
    } else if (activeSource === 'spotify') {
      await spotify.next();
    }
  }, [activeSource, spotify, queueManager, playQueueTrackInternal]);

  const previous = useCallback(async () => {
    // Use queue if available
    const prevTrack = queueManager.goToPrevious();
    if (prevTrack) {
      await playQueueTrackInternal(prevTrack);
    } else if (activeSource === 'spotify') {
      await spotify.previous();
    }
  }, [activeSource, spotify, queueManager, playQueueTrackInternal]);

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
      case 'soundcloud':
        if (soundcloudAudioRef.current) {
          soundcloudAudioRef.current.volume = newVolume / 100;
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
      case 'soundcloud':
        if (soundcloudAudioRef.current) {
          soundcloudAudioRef.current.currentTime = positionMs / 1000;
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

  const playSoundCloudTrack = useCallback(async (track: { id: string; title: string; artist: string; albumArt?: string; duration: number; streamUrl: string }) => {
    if (!soundcloudAudioRef.current) return;
    
    pauseAllExcept('soundcloud');
    
    try {
      soundcloudAudioRef.current.pause();
      soundcloudAudioRef.current.src = track.streamUrl;
      await soundcloudAudioRef.current.play();
      
      setSoundcloudTrack({
        id: track.id,
        title: track.title,
        artist: track.artist,
        albumArt: track.albumArt,
        duration: track.duration,
      });
      setActiveSourceState('soundcloud');
      setIsPlaying(true);
      setDuration(track.duration);
      setProgress(0);
    } catch (err) {
      console.error('SoundCloud play error:', err);
      toast({
        title: "Playback Error",
        description: "Could not play this track",
        variant: "destructive"
      });
    }
  }, [pauseAllExcept, toast]);

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

  // Play queue track by index
  const playQueueTrack = useCallback(async (index: number) => {
    const track = queueManager.playTrackAtIndex(index);
    if (track) {
      await playQueueTrackInternal(track);
    }
  }, [queueManager, playQueueTrackInternal]);

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
      case 'soundcloud':
        if (soundcloudTrack) {
          return {
            id: soundcloudTrack.id,
            title: soundcloudTrack.title,
            artist: soundcloudTrack.artist,
            albumArt: soundcloudTrack.albumArt,
            duration: soundcloudTrack.duration,
            source: 'soundcloud' as AudioSource,
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
        playSoundCloudTrack,
        setActiveSource,
        registerYouTubePlayer,
        unregisterYouTubePlayer,
        localAudioRef,
        // Queue management
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
