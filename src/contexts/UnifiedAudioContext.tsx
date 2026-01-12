import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useSoundCloud } from "@/contexts/SoundCloudContext";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedQueue, QueueTrack } from "@/hooks/useUnifiedQueue";
import { useGaplessPlayback } from "@/hooks/useGaplessPlayback";
import { usePlaybackSync } from "@/hooks/usePlaybackSync";
import { useAuth } from "@/contexts/AuthContext";

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
  isMuted: boolean;
  isLoading: boolean;

  // Control functions
  play: () => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setGlobalVolume: (volume: number) => Promise<void>;
  toggleMute: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;

  // Unified play function
  playTrack: (track: PlayableTrack) => Promise<void>;

  // Source-specific controls
  playLocalTrack: (track: LocalTrackInfo) => Promise<void>;
  playYouTubeVideo: (videoId: string, title: string) => void;
  playSoundCloudTrack: (track: {
    id: string;
    title: string;
    artist: string;
    albumArt?: string;
    duration: number;
    streamUrl: string;
  }) => Promise<void>;
  setActiveSource: (source: AudioSource) => void;

  // YouTube player ref registration
  registerYouTubePlayer: (player: any) => void;
  unregisterYouTubePlayer: () => void;

  // Local audio ref
  localAudioRef: React.RefObject<HTMLAudioElement | null>;

  // PA/Broadcast ducking functions
  fadeAllAndPause: (
    targetVolume: number,
    durationMs: number,
  ) => Promise<{ previousVolume: number; wasPlaying: boolean; activeSource: AudioSource }>;
  resumeAll: (
    previousState: { previousVolume: number; wasPlaying: boolean; activeSource: AudioSource },
    durationMs: number,
  ) => Promise<void>;
  stopAllAudio: () => Promise<void>;

  // Queue management
  queue: QueueTrack[];
  queueHistory: QueueTrack[];
  currentQueueIndex: number;
  upcomingTracks: QueueTrack[];
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  addToQueue: (track: Omit<QueueTrack, "queueId">) => QueueTrack;
  addMultipleToQueue: (tracks: Omit<QueueTrack, "queueId">[]) => QueueTrack[];
  playNext: (track: Omit<QueueTrack, "queueId">) => QueueTrack;
  removeFromQueue: (queueId: string) => void;
  clearQueue: () => void;
  clearUpcoming: () => void;
  playQueueTrack: (index: number) => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;

  // Sync state
  isSyncing: boolean;
  connectedDevices: number;

  // Broadcast sync state change
  broadcastPlaybackState: (action: "play" | "pause" | "seek" | "track_change") => void;
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
  externalId?: string; // Spotify URI or YouTube Video ID
  url?: string; // Local file URL or stream URL
}

const UnifiedAudioContext = createContext<UnifiedAudioContextType | null>(null);

// Cross-fade duration in ms
const CROSSFADE_DURATION = 500;

export const UnifiedAudioProvider = ({ children }: { children: ReactNode }) => {
  const spotify = useSpotify();
  const soundcloud = useSoundCloud();
  const { toast } = useToast();
  const { user } = useAuth();

  // Queue management
  const queueManager = useUnifiedQueue();

  const [activeSource, setActiveSourceState] = useState<AudioSource>(null);
  const [localTrack, setLocalTrack] = useState<LocalTrackInfo | null>(null);
  const [soundcloudTrack, setSoundcloudTrack] = useState<{
    id: string;
    title: string;
    artist: string;
    albumArt?: string;
    duration: number;
  } | null>(null);
  const [youtubeInfo, setYoutubeInfo] = useState<{ videoId: string; title: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(75);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(75);

  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const soundcloudAudioRef = useRef<HTMLAudioElement | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const crossfadeTimeoutRef = useRef<number | null>(null);
  const prefetchedAudioRef = useRef<HTMLAudioElement | null>(null);
  const [gaplessReady, setGaplessReady] = useState(false);

  // Get next track for gapless prefetch
  const nextQueueTrack = queueManager.upcomingTracks[0] || null;

  // Gapless playback hook
  const { swapToPrefetched, isPrefetched } = useGaplessPlayback({
    currentTrack: queueManager.currentTrack,
    nextTrack: nextQueueTrack,
    progress,
    duration,
    isPlaying,
    activeSource,
    onNextReady: (audio) => {
      prefetchedAudioRef.current = audio;
      setGaplessReady(true);
      console.log("[Gapless] Next track ready for seamless transition");
    },
  });

  // Playback sync across devices
  const { isSyncing, connectedDevices, broadcastState } = usePlaybackSync({
    enabled: !!user,
    onRemoteStateChange: useCallback(
      async (state, action) => {
        console.log("[Sync] Received remote state change:", action, state);

        // Handle remote state changes - sync to this device
        if (action === "play" && !isPlaying) {
          // Remote started playing
          if (localAudioRef.current && activeSource === "local") {
            try {
              // iOS requires muted autoplay first, then unmute
              const wasMuted = localAudioRef.current.muted;
              localAudioRef.current.muted = true;
              await localAudioRef.current.play();
              // Small delay before unmuting (iOS requirement)
              setTimeout(() => {
                if (localAudioRef.current) {
                  localAudioRef.current.muted = wasMuted;
                }
              }, 50);
              setIsPlaying(true);
            } catch (error) {
              console.error("[Sync] Failed to play on remote command:", error);
              // Audio is likely locked - the AudioUnlockOverlay will handle this
            }
          }
        } else if (action === "pause" && isPlaying) {
          // Remote paused
          if (localAudioRef.current && activeSource === "local") {
            localAudioRef.current.pause();
            setIsPlaying(false);
          }
        } else if (action === "seek" && state.progressMs !== undefined) {
          // Remote seeked
          if (localAudioRef.current && activeSource === "local") {
            localAudioRef.current.currentTime = state.progressMs / 1000;
            setProgress(state.progressMs);
          }
        }
      },
      [isPlaying, activeSource],
    ),
  });

  // Broadcast playback state to sync across devices
  const broadcastPlaybackState = useCallback(
    (action: "play" | "pause" | "seek" | "track_change") => {
      const track = (() => {
        switch (activeSource) {
          case "local":
            if (localTrack) {
              return {
                id: localTrack.id,
                title: localTrack.title,
                artist: localTrack.artist,
                albumArt: localTrack.albumArt,
                duration: duration,
                source: "local" as AudioSource,
              };
            }
            return null;
          case "spotify":
            if (spotify.playbackState?.track) {
              const t = spotify.playbackState.track;
              return {
                id: t.id,
                title: t.name,
                artist: t.artists.map((a: any) => a.name).join(", "),
                albumArt: t.album.images[0]?.url,
                duration: t.duration_ms,
                source: "spotify" as AudioSource,
              };
            }
            return null;
          default:
            return null;
        }
      })();

      broadcastState(isPlaying, progress, duration, track, activeSource, action);
    },
    [activeSource, localTrack, duration, isPlaying, progress, spotify.playbackState, broadcastState],
  );

  // Initialize local audio element with robust error handling
  useEffect(() => {
    localAudioRef.current = new Audio();
    localAudioRef.current.volume = isMuted ? 0 : volume / 100;
    localAudioRef.current.preload = "auto";

    const audio = localAudioRef.current;

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      // Auto-advance to next track
      handleAutoNext();
    };

    const handleTimeUpdate = () => {
      if (audio && activeSource === "local") {
        setProgress(audio.currentTime * 1000);
        setDuration((audio.duration || 0) * 1000);
      }
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handleError = (e: Event) => {
      const error = (e.target as HTMLAudioElement)?.error;
      console.error("Local audio error:", error);

      toast({
        title: "Track unavailable, skipping to next",
        description: error?.message || "Could not play this track",
        variant: "destructive",
      });

      setIsPlaying(false);
      setIsLoading(false);

      // Auto-skip to next track
      setTimeout(() => handleAutoNext(), 500);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("error", handleError);
      audio.pause();
    };
  }, [toast]);

  // Initialize SoundCloud audio element
  useEffect(() => {
    soundcloudAudioRef.current = new Audio();
    soundcloudAudioRef.current.volume = isMuted ? 0 : volume / 100;
    soundcloudAudioRef.current.preload = "auto";

    const audio = soundcloudAudioRef.current;

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      handleAutoNext();
    };

    const handleTimeUpdate = () => {
      if (audio && activeSource === "soundcloud") {
        setProgress(audio.currentTime * 1000);
        setDuration((audio.duration || 0) * 1000);
      }
    };

    const handleError = (e: Event) => {
      const error = (e.target as HTMLAudioElement)?.error;
      console.error("SoundCloud audio error:", error);

      toast({
        title: "Track unavailable, skipping to next",
        description: "Could not play this SoundCloud track",
        variant: "destructive",
      });

      setIsPlaying(false);
      setTimeout(() => handleAutoNext(), 500);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("error", handleError);
      audio.pause();
    };
  }, [toast]);

  // Auto-advance to next track with gapless support
  const handleAutoNext = useCallback(async () => {
    const nextTrack = queueManager.goToNext();
    if (nextTrack) {
      // Check if we have a prefetched audio ready for gapless playback
      if (
        prefetchedAudioRef.current &&
        isPrefetched(nextTrack.queueId) &&
        (nextTrack.source === "local" || nextTrack.source === "soundcloud")
      ) {
        console.log("[Gapless] Using prefetched audio for seamless transition");

        // Swap the prefetched audio into place
        const prefetchedAudio = swapToPrefetched(isMuted ? 0 : volume / 100);

        if (prefetchedAudio) {
          // Stop current audio
          if (localAudioRef.current) {
            localAudioRef.current.pause();
            localAudioRef.current.src = "";
          }
          if (soundcloudAudioRef.current) {
            soundcloudAudioRef.current.pause();
            soundcloudAudioRef.current.src = "";
          }

          // Use the prefetched audio element
          if (nextTrack.source === "local") {
            localAudioRef.current = prefetchedAudio;
            setLocalTrack({
              id: nextTrack.id,
              title: nextTrack.title,
              artist: nextTrack.artist,
              duration: formatMsToString(nextTrack.duration),
              url: nextTrack.url,
              albumArt: nextTrack.albumArt,
            });
            setActiveSourceState("local");
          } else {
            soundcloudAudioRef.current = prefetchedAudio;
            setSoundcloudTrack({
              id: nextTrack.id,
              title: nextTrack.title,
              artist: nextTrack.artist,
              albumArt: nextTrack.albumArt,
              duration: nextTrack.duration,
            });
            setActiveSourceState("soundcloud");
          }

          // Start playback immediately
          await prefetchedAudio.play();
          setIsPlaying(true);
          setDuration(nextTrack.duration);
          setProgress(0);
          setGaplessReady(false);
          prefetchedAudioRef.current = null;

          // Re-attach event listeners to the new audio element
          attachAudioListeners(prefetchedAudio, nextTrack.source === "local" ? "local" : "soundcloud");

          return;
        }
      }

      // Fallback to normal playback
      await playQueueTrackInternal(nextTrack);
    }
  }, [queueManager, isPrefetched, swapToPrefetched, isMuted, volume]);

  // Helper to format ms to string
  const formatMsToString = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Helper to attach audio event listeners
  const attachAudioListeners = useCallback(
    (audio: HTMLAudioElement, source: "local" | "soundcloud") => {
      const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
        handleAutoNext();
      };

      const handleTimeUpdate = () => {
        if (activeSource === source) {
          setProgress(audio.currentTime * 1000);
          setDuration((audio.duration || 0) * 1000);
        }
      };

      const handleError = () => {
        console.error(`${source} audio error`);
        setIsPlaying(false);
        setTimeout(() => handleAutoNext(), 500);
      };

      audio.addEventListener("ended", handleEnded);
      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("error", handleError);
    },
    [activeSource],
  );

  // Update volume on all audio sources when volume changes
  useEffect(() => {
    const effectiveVolume = isMuted ? 0 : volume / 100;

    if (localAudioRef.current) {
      localAudioRef.current.volume = effectiveVolume;
    }
    if (soundcloudAudioRef.current) {
      soundcloudAudioRef.current.volume = effectiveVolume;
    }
    if (youtubePlayerRef.current?.setVolume) {
      youtubePlayerRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  // Sync with Spotify state when Spotify is active
  useEffect(() => {
    if (activeSource === "spotify" && spotify.playbackState) {
      setIsPlaying(spotify.playbackState.isPlaying);
      setProgress(spotify.playbackState.progress);
      setDuration(spotify.playbackState.track?.duration_ms || 0);
    }
  }, [activeSource, spotify.playbackState]);

  // Crossfade helper - fade out audio element
  const fadeOutAudio = useCallback(async (audio: HTMLAudioElement): Promise<void> => {
    return new Promise((resolve) => {
      const steps = 10;
      const stepDuration = CROSSFADE_DURATION / 2 / steps;
      const startVolume = audio.volume;
      const volumeStep = startVolume / steps;
      let currentStep = 0;

      const fadeInterval = setInterval(() => {
        currentStep++;
        audio.volume = Math.max(0, startVolume - volumeStep * currentStep);

        if (currentStep >= steps) {
          clearInterval(fadeInterval);
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 0;
          resolve();
        }
      }, stepDuration);
    });
  }, []);

  // Stop all audio sources with cross-fade
  const stopAllSources = useCallback(async () => {
    // Clear any pending crossfade
    if (crossfadeTimeoutRef.current) {
      clearTimeout(crossfadeTimeoutRef.current);
    }

    const fadePromises: Promise<void>[] = [];

    // Fade out local audio if playing
    if (localAudioRef.current && !localAudioRef.current.paused) {
      fadePromises.push(fadeOutAudio(localAudioRef.current));
    } else if (localAudioRef.current) {
      localAudioRef.current.pause();
      localAudioRef.current.currentTime = 0;
    }

    // Fade out SoundCloud if playing
    if (soundcloudAudioRef.current && !soundcloudAudioRef.current.paused) {
      fadePromises.push(fadeOutAudio(soundcloudAudioRef.current));
    } else if (soundcloudAudioRef.current) {
      soundcloudAudioRef.current.pause();
      soundcloudAudioRef.current.currentTime = 0;
    }

    // Stop YouTube immediately
    if (youtubePlayerRef.current?.pauseVideo) {
      try {
        youtubePlayerRef.current.pauseVideo();
      } catch {
        // YouTube player might not be ready
      }
    }

    // IMPORTANT: Spotify commands can fail when there's no active device.
    // Fire-and-forget to avoid blocking.
    if (spotify.playbackState?.isPlaying) {
      void spotify.pause().catch(() => {
        // ignore
      });
    }

    // Wait for fade outs to complete
    if (fadePromises.length > 0) {
      await Promise.all(fadePromises);
    }

    // Reset playing state
    setIsPlaying(false);
  }, [spotify, fadeOutAudio]);

  // Pause all sources except specified one
  const pauseAllExcept = useCallback(
    async (except: AudioSource) => {
      if (except !== "local" && localAudioRef.current && !localAudioRef.current.paused) {
        localAudioRef.current.pause();
      }
      if (except !== "soundcloud" && soundcloudAudioRef.current && !soundcloudAudioRef.current.paused) {
        soundcloudAudioRef.current.pause();
      }
      if (except !== "youtube" && youtubePlayerRef.current?.pauseVideo) {
        try {
          const state = youtubePlayerRef.current.getPlayerState?.();
          if (state === 1) {
            youtubePlayerRef.current.pauseVideo();
          }
        } catch {
          // YouTube player might not be ready
        }
      }

      if (except !== "spotify" && spotify.playbackState?.isPlaying) {
        // Fire-and-forget: avoid blocking user-gesture playback for local audio.
        void spotify.pause().catch(() => {
          // ignore
        });
      }
    },
    [spotify],
  );

  // Fade all audio sources and pause - for PA/Broadcast mode
  const fadeAllAndPause = useCallback(
    async (
      targetVolume: number,
      durationMs: number,
    ): Promise<{ previousVolume: number; wasPlaying: boolean; activeSource: AudioSource }> => {
      const previousVolume = volume;
      const wasPlaying = isPlaying || spotify.playbackState?.isPlaying || false;
      const currentSource = activeSource;

      const steps = 20;
      const stepDuration = durationMs / steps;
      const volumeStep = (targetVolume - previousVolume) / steps;

      // Gradual fade
      for (let i = 1; i <= steps; i++) {
        const newVolume = Math.round(previousVolume + volumeStep * i);
        const clampedVolume = Math.max(0, Math.min(100, newVolume));

        // Local audio
        if (localAudioRef.current) {
          localAudioRef.current.volume = clampedVolume / 100;
        }
        // SoundCloud audio
        if (soundcloudAudioRef.current) {
          soundcloudAudioRef.current.volume = clampedVolume / 100;
        }
        // YouTube
        if (youtubePlayerRef.current?.setVolume) {
          youtubePlayerRef.current.setVolume(clampedVolume);
        }
        // Spotify - use their fade if available
        if (spotify.isConnected && spotify.playbackState?.isPlaying) {
          try {
            await spotify.setVolume(clampedVolume);
          } catch (e) {
            console.warn("Spotify volume adjustment failed:", e);
          }
        }

        await new Promise((r) => setTimeout(r, stepDuration));
      }

      // Pause all sources after fade
      if (localAudioRef.current && !localAudioRef.current.paused) {
        localAudioRef.current.pause();
      }
      if (soundcloudAudioRef.current && !soundcloudAudioRef.current.paused) {
        soundcloudAudioRef.current.pause();
      }
      if (youtubePlayerRef.current?.pauseVideo) {
        try {
          youtubePlayerRef.current.pauseVideo();
        } catch (e) {
          // YouTube player might not be ready
        }
      }
      if (spotify.playbackState?.isPlaying) {
        try {
          await spotify.pause();
        } catch (e) {
          console.warn("Spotify pause failed:", e);
        }
      }

      setIsPlaying(false);

      return { previousVolume, wasPlaying, activeSource: currentSource };
    },
    [volume, isPlaying, activeSource, spotify],
  );

  // Resume all audio after PA broadcast ends
  const resumeAll = useCallback(
    async (
      previousState: { previousVolume: number; wasPlaying: boolean; activeSource: AudioSource },
      durationMs: number,
    ) => {
      const { previousVolume: targetVolume, wasPlaying, activeSource: prevSource } = previousState;

      // Only resume if was playing before
      if (!wasPlaying) return;

      // Resume playback on the previous source
      switch (prevSource) {
        case "local":
          if (localAudioRef.current) {
            localAudioRef.current.volume = 0;
            await localAudioRef.current.play();
          }
          break;
        case "soundcloud":
          if (soundcloudAudioRef.current) {
            soundcloudAudioRef.current.volume = 0;
            await soundcloudAudioRef.current.play();
          }
          break;
        case "youtube":
          if (youtubePlayerRef.current?.playVideo) {
            youtubePlayerRef.current.setVolume(0);
            youtubePlayerRef.current.playVideo();
          }
          break;
        case "spotify":
          if (spotify.isConnected) {
            try {
              await spotify.setVolume(0);
              await spotify.play();
            } catch (e) {
              console.warn("Spotify resume failed:", e);
            }
          }
          break;
      }

      setIsPlaying(true);

      // Gradual fade in
      const steps = 20;
      const stepDuration = durationMs / steps;
      const volumeStep = targetVolume / steps;

      for (let i = 1; i <= steps; i++) {
        const newVolume = Math.round(volumeStep * i);
        const clampedVolume = Math.max(0, Math.min(100, newVolume));

        if (localAudioRef.current) {
          localAudioRef.current.volume = clampedVolume / 100;
        }
        if (soundcloudAudioRef.current) {
          soundcloudAudioRef.current.volume = clampedVolume / 100;
        }
        if (youtubePlayerRef.current?.setVolume) {
          youtubePlayerRef.current.setVolume(clampedVolume);
        }
        if (spotify.isConnected) {
          try {
            await spotify.setVolume(clampedVolume);
          } catch (e) {
            // Ignore volume errors during fade
          }
        }

        await new Promise((r) => setTimeout(r, stepDuration));
      }

      setVolumeState(targetVolume);
    },
    [spotify],
  );

  // Stop all audio immediately (for emergencies)
  const stopAllAudio = useCallback(async () => {
    if (localAudioRef.current) {
      localAudioRef.current.pause();
      localAudioRef.current.currentTime = 0;
    }
    if (soundcloudAudioRef.current) {
      soundcloudAudioRef.current.pause();
      soundcloudAudioRef.current.currentTime = 0;
    }
    if (youtubePlayerRef.current?.stopVideo) {
      try {
        youtubePlayerRef.current.stopVideo();
      } catch (e) {
        // YouTube player might not be ready
      }
    }
    if (spotify.isConnected && spotify.playbackState?.isPlaying) {
      try {
        await spotify.pause();
      } catch (e) {
        console.warn("Spotify stop failed:", e);
      }
    }
    setIsPlaying(false);
    setActiveSourceState(null);
  }, [spotify]);

  // Listen for PA broadcast events to handle audio ducking
  const preBroadcastStateRef = useRef<{
    previousVolume: number;
    wasPlaying: boolean;
    activeSource: AudioSource;
  } | null>(null);

  useEffect(() => {
    const handleBroadcastStart = async (e: CustomEvent<{ musicDuckLevel: number; fadeOutDuration: number }>) => {
      console.log("[UnifiedAudio] PA broadcast started, ducking audio");
      const { musicDuckLevel, fadeOutDuration } = e.detail;

      if (isPlaying || activeSource) {
        const state = await fadeAllAndPause(musicDuckLevel, fadeOutDuration);
        preBroadcastStateRef.current = state;
      }
    };

    const handleBroadcastStop = async (e: CustomEvent<{ fadeInDuration: number }>) => {
      console.log("[UnifiedAudio] PA broadcast stopped, restoring audio");
      const { fadeInDuration } = e.detail;

      if (preBroadcastStateRef.current) {
        await resumeAll(preBroadcastStateRef.current, fadeInDuration);
        preBroadcastStateRef.current = null;
      }
    };

    window.addEventListener("pa-broadcast-start", handleBroadcastStart as EventListener);
    window.addEventListener("pa-broadcast-stop", handleBroadcastStop as EventListener);

    return () => {
      window.removeEventListener("pa-broadcast-start", handleBroadcastStart as EventListener);
      window.removeEventListener("pa-broadcast-stop", handleBroadcastStop as EventListener);
    };
  }, [isPlaying, activeSource, fadeAllAndPause, resumeAll]);

  const setActiveSource = useCallback(
    (source: AudioSource) => {
      if (source !== activeSource) {
        pauseAllExcept(source);
        setActiveSourceState(source);
      }
    },
    [activeSource, pauseAllExcept],
  );

  // Unified playTrack function - the heart of the audio engine
  const playTrack = useCallback(
    async (track: PlayableTrack) => {
      setIsLoading(true);

      // Stop all current playback first (cross-fade)
      // NOTE: don't await here; awaiting can break user-gesture playback (autoplay policies).
      stopAllSources();

      try {
        switch (track.source) {
          case "spotify":
            if (track.externalId) {
              // Check if Spotify is connected
              if (!spotify.isConnected) {
                toast({
                  title: "Spotify not connected",
                  description: "Please connect your Spotify account first",
                  variant: "destructive",
                });
                setIsLoading(false);
                return;
              }

              try {
                // OPTIMIZATION: Set active source immediately for faster UI feedback
                setActiveSourceState("spotify");

                // FIX: Auto-Wake Up Spotify Device
                // If there is no active device, find the web player and transfer playback
                const activeDevice = spotify.devices.find((d) => (d as any).is_active);
                if (!activeDevice) {
                  const webDevice = spotify.devices.find(
                    (d) => d.type === "Computer" || d.name.toLowerCase().includes("web"),
                  );
                  if (webDevice) {
                    await spotify.transferPlayback(webDevice.id);
                    // Small delay to let transfer settle
                    await new Promise((r) => setTimeout(r, 500));
                  }
                }

                await spotify.play(track.externalId);
              } catch (error: any) {
                // Handle insufficient scope or 400 errors
                if (error?.message?.includes("scope") || error?.message?.includes("400")) {
                  toast({
                    title: "Spotify authorization required",
                    description: "Please reconnect Spotify with streaming permissions",
                    variant: "destructive",
                  });
                  // Could trigger re-auth here
                } else {
                  throw error;
                }
              }
            }
            break;

          case "local":
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
              setActiveSourceState("local");
              setIsPlaying(true);
              setDuration(track.duration);
              setProgress(0);
            }
            break;

          case "soundcloud":
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
              setActiveSourceState("soundcloud");
              setIsPlaying(true);
              setDuration(track.duration);
              setProgress(0);
            }
            break;

          case "youtube":
            if (track.externalId) {
              setYoutubeInfo({ videoId: track.externalId, title: track.title });
              setActiveSourceState("youtube");
              // YouTube player will auto-play when videoId changes
            }
            break;

          default:
            throw new Error(`Unknown source: ${track.source}`);
        }
      } catch (error) {
        console.error("Playback error:", error);
        toast({
          title: "Track unavailable, skipping to next",
          description: "Could not play this track",
          variant: "destructive",
        });

        // Auto-skip to next
        setTimeout(() => handleAutoNext(), 500);
      } finally {
        setIsLoading(false);
      }
    },
    [spotify, stopAllSources, toast, handleAutoNext],
  );

  // Play a track from the queue
  const playQueueTrackInternal = useCallback(
    async (track: QueueTrack) => {
      await playTrack({
        id: track.id,
        title: track.title,
        artist: track.artist,
        albumArt: track.albumArt,
        duration: track.duration,
        source: track.source,
        externalId: track.externalId,
        url: track.url,
      });
    },
    [playTrack],
  );

  const play = useCallback(async () => {
    switch (activeSource) {
      case "spotify":
        // FIX: Added device wake-up logic here too for the global Play button
        const activeDevice = spotify.devices.find((d) => (d as any).is_active);
        if (!activeDevice) {
          const webDevice = spotify.devices.find((d) => d.type === "Computer" || d.name.toLowerCase().includes("web"));
          if (webDevice) {
            await spotify.transferPlayback(webDevice.id);
          }
        }
        await spotify.play();
        break;
      case "local":
        if (localAudioRef.current) {
          await localAudioRef.current.play();
          setIsPlaying(true);
        }
        break;
      case "soundcloud":
        if (soundcloudAudioRef.current) {
          await soundcloudAudioRef.current.play();
          setIsPlaying(true);
        }
        break;
      case "youtube":
        if (youtubePlayerRef.current?.playVideo) {
          youtubePlayerRef.current.playVideo();
          setIsPlaying(true);
        }
        break;
    }
  }, [activeSource, spotify]);

  const pause = useCallback(async () => {
    switch (activeSource) {
      case "spotify":
        await spotify.pause();
        break;
      case "local":
        if (localAudioRef.current) {
          localAudioRef.current.pause();
          setIsPlaying(false);
        }
        break;
      case "soundcloud":
        if (soundcloudAudioRef.current) {
          soundcloudAudioRef.current.pause();
          setIsPlaying(false);
        }
        break;
      case "youtube":
        if (youtubePlayerRef.current?.pauseVideo) {
          youtubePlayerRef.current.pauseVideo();
          setIsPlaying(false);
        }
        break;
    }
  }, [activeSource, spotify]);

  const next = useCallback(async () => {
    const nextTrack = queueManager.goToNext();
    if (nextTrack) {
      await playQueueTrackInternal(nextTrack);
    } else if (activeSource === "spotify") {
      await spotify.next();
    }
  }, [activeSource, spotify, queueManager, playQueueTrackInternal]);

  const previous = useCallback(async () => {
    const prevTrack = queueManager.goToPrevious();
    if (prevTrack) {
      await playQueueTrackInternal(prevTrack);
    } else if (activeSource === "spotify") {
      await spotify.previous();
    }
  }, [activeSource, spotify, queueManager, playQueueTrackInternal]);

  // Set volume for current source
  const setVolume = useCallback(
    async (newVolume: number) => {
      setVolumeState(newVolume);
      setIsMuted(newVolume === 0);

      switch (activeSource) {
        case "spotify":
          await spotify.setVolume(newVolume);
          break;
        case "local":
          if (localAudioRef.current) {
            localAudioRef.current.volume = newVolume / 100;
          }
          break;
        case "soundcloud":
          if (soundcloudAudioRef.current) {
            soundcloudAudioRef.current.volume = newVolume / 100;
          }
          break;
        case "youtube":
          if (youtubePlayerRef.current?.setVolume) {
            youtubePlayerRef.current.setVolume(newVolume);
          }
          break;
      }
    },
    [activeSource, spotify],
  );

  // Set global volume across ALL sources at once
  const setGlobalVolume = useCallback(
    async (newVolume: number) => {
      setVolumeState(newVolume);
      setIsMuted(newVolume === 0);

      const volumeRatio = newVolume / 100;

      // Update all sources simultaneously
      if (localAudioRef.current) {
        localAudioRef.current.volume = volumeRatio;
      }
      if (soundcloudAudioRef.current) {
        soundcloudAudioRef.current.volume = volumeRatio;
      }
      if (youtubePlayerRef.current?.setVolume) {
        youtubePlayerRef.current.setVolume(newVolume);
      }
      if (spotify.isConnected) {
        try {
          await spotify.setVolume(newVolume);
        } catch (e) {
          // Spotify volume might fail if no active device
        }
      }
    },
    [spotify],
  );

  // Toggle mute with memory of previous volume
  const toggleMute = useCallback(async () => {
    if (isMuted) {
      await setGlobalVolume(previousVolume || 75);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume);
      await setGlobalVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, previousVolume, volume, setGlobalVolume]);

  const seek = useCallback(
    async (positionMs: number) => {
      // Update local state immediately for responsive UI
      setProgress(positionMs);

      switch (activeSource) {
        case "local":
          if (localAudioRef.current) {
            localAudioRef.current.currentTime = positionMs / 1000;
          }
          break;
        case "soundcloud":
          if (soundcloudAudioRef.current) {
            soundcloudAudioRef.current.currentTime = positionMs / 1000;
          }
          break;
        case "youtube":
          if (youtubePlayerRef.current?.seekTo) {
            youtubePlayerRef.current.seekTo(positionMs / 1000, true);
          }
          break;
        case "spotify":
          // Use the Spotify context's seek function
          if (spotify.isConnected) {
            try {
              await spotify.seek(positionMs);
            } catch (err) {
              console.error("Spotify seek failed:", err);
            }
          }
          break;
      }
    },
    [activeSource, spotify],
  );

  const playLocalTrack = useCallback(
    async (track: LocalTrackInfo) => {
      if (!localAudioRef.current) return;

      setIsLoading(true);
      // Don't await: keeping this synchronous helps prevent autoplay-policy blocks.
      pauseAllExcept("local");

      try {
        localAudioRef.current.pause();

        let audioUrl: string;
        // Prefer an already-prepared URL (keeps playback within user-gesture constraints)
        if (track.url) {
          audioUrl = track.url;
        } else if (track.fileHandle) {
          const file = await track.fileHandle.getFile();
          audioUrl = URL.createObjectURL(file);
        } else {
          throw new Error("No audio source");
        }

        localAudioRef.current.src = audioUrl;
        await localAudioRef.current.play();

        setLocalTrack(track);
        setActiveSourceState("local");
        setIsPlaying(true);

        // Parse duration string to ms
        const parts = track.duration.split(":").map(Number);
        let durationMs = 0;
        if (parts.length === 2) {
          durationMs = (parts[0] * 60 + parts[1]) * 1000;
        } else if (parts.length === 3) {
          durationMs = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
        }
        setDuration(durationMs);
        setProgress(0);
      } catch (err: any) {
        const name = err?.name;
        const message = err?.message || String(err);
        console.error("Local play error:", { name, message, err });
        toast({
          title: name === "NotAllowedError" ? "Playback blocked by browser" : "Playback Error",
          description: name ? `${name}: ${message}` : message,
          variant: "destructive",
        });
        // Don't auto-skip here; a manual play failure should not jump the queue.
      } finally {
        setIsLoading(false);
      }
    },
    [pauseAllExcept, toast, handleAutoNext],
  );

  const playYouTubeVideo = useCallback(
    (videoId: string, title: string) => {
      pauseAllExcept("youtube");
      setYoutubeInfo({ videoId, title });
      setActiveSourceState("youtube");
    },
    [pauseAllExcept],
  );

  const playSoundCloudTrack = useCallback(
    async (track: {
      id: string;
      title: string;
      artist: string;
      albumArt?: string;
      duration: number;
      streamUrl: string;
    }) => {
      if (!soundcloudAudioRef.current) return;

      setIsLoading(true);
      // Don't await: keeping this synchronous helps prevent autoplay-policy blocks.
      pauseAllExcept("soundcloud");

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
        setActiveSourceState("soundcloud");
        setIsPlaying(true);
        setDuration(track.duration);
        setProgress(0);
      } catch (err) {
        console.error("SoundCloud play error:", err);
        toast({
          title: "Track unavailable, skipping to next",
          description: "Could not play this track",
          variant: "destructive",
        });
        setTimeout(() => handleAutoNext(), 500);
      } finally {
        setIsLoading(false);
      }
    },
    [pauseAllExcept, toast, handleAutoNext],
  );

  const registerYouTubePlayer = useCallback(
    (player: any) => {
      youtubePlayerRef.current = player;

      // Apply current volume to YouTube player
      if (player?.setVolume) {
        player.setVolume(isMuted ? 0 : volume);
      }

      // Set up YouTube progress tracking
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      progressIntervalRef.current = window.setInterval(() => {
        if (youtubePlayerRef.current && activeSource === "youtube") {
          try {
            const currentTime = youtubePlayerRef.current.getCurrentTime?.() || 0;
            const totalDuration = youtubePlayerRef.current.getDuration?.() || 0;
            setProgress(currentTime * 1000);
            setDuration(totalDuration * 1000);

            // Update isPlaying state from YouTube
            const state = youtubePlayerRef.current.getPlayerState?.();
            setIsPlaying(state === 1); // 1 = playing
          } catch (e) {
            // Player might not be ready
          }
        }
      }, 500);
    },
    [activeSource, volume, isMuted],
  );

  const unregisterYouTubePlayer = useCallback(() => {
    youtubePlayerRef.current = null;
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Play queue track by index
  const playQueueTrack = useCallback(
    async (index: number) => {
      const track = queueManager.playTrackAtIndex(index);
      if (track) {
        await playQueueTrackInternal(track);
      }
    },
    [queueManager, playQueueTrackInternal],
  );

  // Build current track info based on active source
  const currentTrack: UnifiedTrack | null = (() => {
    switch (activeSource) {
      case "spotify":
        if (spotify.playbackState?.track) {
          const t = spotify.playbackState.track;
          return {
            id: t.id,
            title: t.name,
            artist: t.artists.map((a) => a.name).join(", "),
            albumArt: t.album.images?.[0]?.url,
            duration: t.duration_ms,
            source: "spotify" as AudioSource,
          };
        }
        return null;
      case "local":
        if (localTrack) {
          return {
            id: localTrack.id,
            title: localTrack.title,
            artist: localTrack.artist,
            albumArt: localTrack.albumArt,
            duration: duration,
            source: "local" as AudioSource,
          };
        }
        return null;
      case "soundcloud":
        if (soundcloudTrack) {
          return {
            id: soundcloudTrack.id,
            title: soundcloudTrack.title,
            artist: soundcloudTrack.artist,
            albumArt: soundcloudTrack.albumArt,
            duration: soundcloudTrack.duration,
            source: "soundcloud" as AudioSource,
          };
        }
        return null;
      case "youtube":
        if (youtubeInfo) {
          return {
            id: youtubeInfo.videoId,
            title: youtubeInfo.title,
            artist: "YouTube",
            albumArt: `https://img.youtube.com/vi/${youtubeInfo.videoId}/mqdefault.jpg`,
            duration: duration,
            source: "youtube" as AudioSource,
          };
        }
        return null;
      default:
        return null;
    }
  })();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (crossfadeTimeoutRef.current) {
        clearTimeout(crossfadeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <UnifiedAudioContext.Provider
      value={{
        activeSource,
        currentTrack,
        isPlaying: activeSource === "spotify" ? (spotify.playbackState?.isPlaying ?? false) : isPlaying,
        progress: activeSource === "spotify" ? (spotify.playbackState?.progress ?? 0) : progress,
        duration: activeSource === "spotify" ? (spotify.playbackState?.track?.duration_ms ?? 0) : duration,
        volume,
        isMuted,
        isLoading,
        play,
        pause,
        next,
        previous,
        setVolume,
        setGlobalVolume,
        toggleMute,
        seek,
        playTrack,
        playLocalTrack,
        playYouTubeVideo,
        playSoundCloudTrack,
        setActiveSource,
        registerYouTubePlayer,
        unregisterYouTubePlayer,
        localAudioRef,
        // PA/Broadcast ducking
        fadeAllAndPause,
        resumeAll,
        stopAllAudio,
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
        // Sync state
        isSyncing,
        connectedDevices,
        broadcastPlaybackState,
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
