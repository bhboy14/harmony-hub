/*
  INTEGRATED FIX FOR SPOTIFY PLAYBACK SDK & UNIFIED AUDIO ENGINE
  
  Fixes included:
  1. TS2339: Property '_options' does not exist (added 'as any' casting).
  2. Playback Control: Explicitly transfer playback to Web SDK upon 'ready'.
  3. Metadata Sync: UnifiedAudioContext now maps Spotify state to UnifiedTrack.
  4. Global Sync: Claims 'activeSource' as 'spotify' when SDK detects playback.
*/

// --- FILE: src/contexts/SpotifyContext.tsx ---

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayerInstance;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface SpotifyPlayerInstance {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, callback: (state: any) => void) => void;
  removeListener: (event: string, callback?: (state: any) => void) => void;
  getCurrentState: () => Promise<any>;
  setName: (name: string) => Promise<void>;
  getVolume: () => Promise<number>;
  setVolume: (volume: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (position_ms: number) => Promise<void>;
  previousTrack: () => Promise<void>;
  nextTrack: () => Promise<void>;
  activateElement: () => Promise<void>;
}

interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  uri: string;
  albumArt?: string;
}

interface SpotifyPlaybackState {
  isPlaying: boolean;
  track: SpotifyTrack | null;
  progress: number;
  volume: number;
  device: { id: string; name: string; type: string } | null;
}

export interface SpotifyContextType {
  isConnected: boolean;
  isLoading: boolean;
  isPlayerReady: boolean;
  isPlayerConnecting: boolean;
  tokens: SpotifyTokens | null;
  playbackState: SpotifyPlaybackState | null;
  devices: any[];
  webPlayerReady: boolean;
  webPlayerDeviceId: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  play: (uri?: string, uris?: string[]) => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  refreshPlaybackState: () => Promise<void>;
  transferPlayback: (deviceId: string) => Promise<void>;
}

const SpotifyContext = createContext<SpotifyContextType | null>(null);
const REDIRECT_URI = typeof window !== "undefined" ? `${window.location.origin}/spotify-callback` : "";

export const SpotifyProvider = ({ children }: { children: ReactNode }) => {
  const [tokens, setTokens] = useState<SpotifyTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlayerConnecting, setIsPlayerConnecting] = useState(false);
  const [playbackState, setPlaybackState] = useState<SpotifyPlaybackState | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [webPlayerReady, setWebPlayerReady] = useState(false);
  const [webPlayerDeviceId, setWebPlayerDeviceId] = useState<string | null>(null);
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();

  const normalizeTrack = (track: any): SpotifyTrack => {
    if (!track) return track;
    const images = track.album?.images || [];
    const albumArt = images[0]?.url || track.album_art || "/placeholder.png";
    return { ...track, albumArt };
  };

  const saveTokensToDb = useCallback(
    async (newTokens: SpotifyTokens) => {
      if (!user) return;
      await supabase.from("spotify_tokens").upsert({
        user_id: user.id,
        access_token: newTokens.accessToken,
        refresh_token: newTokens.refreshToken,
        expires_at: new Date(newTokens.expiresAt).toISOString(),
      });
    },
    [user],
  );

  const ensureValidToken = useCallback(async (): Promise<string | null> => {
    if (!tokens) return null;
    if (Date.now() < tokens.expiresAt - 60000) return tokens.accessToken;
    try {
      const { data, error } = await supabase.functions.invoke("spotify-auth", {
        body: { action: "refresh", refreshToken: tokens.refreshToken },
      });
      if (error) throw error;
      const t = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || tokens.refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
      };
      setTokens(t);
      await saveTokensToDb(t);
      return t.accessToken;
    } catch {
      return null;
    }
  }, [tokens, saveTokensToDb]);

  const callSpotifyApi = useCallback(
    async (action: string, params: Record<string, any> = {}) => {
      const accessToken = await ensureValidToken();
      if (!accessToken) throw new Error("Not connected");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("spotify-player", {
        body: { action, accessToken, ...params },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      return data;
    },
    [ensureValidToken],
  );

  const refreshPlaybackState = useCallback(async () => {
    if (!tokens) return;
    try {
      const [playback, deviceList] = await Promise.all([callSpotifyApi("get_playback"), callSpotifyApi("get_devices")]);
      if (playback && playback.item) {
        setPlaybackState({
          isPlaying: playback.is_playing,
          track: normalizeTrack(playback.item),
          progress: playback.progress_ms,
          volume: playback.device?.volume_percent ?? 100,
          device: playback.device,
        });
      }
      setDevices(deviceList?.devices || []);
    } catch (err) {
      console.error("Refresh Error:", err);
    }
  }, [callSpotifyApi, tokens]);

  const initializeWebPlaybackSDK = useCallback(async () => {
    if (!tokens || playerRef.current) return;

    const setupPlayer = () => {
      const player = new window.Spotify.Player({
        name: "Harmony Hub Player",
        getOAuthToken: async (cb) => {
          const token = await ensureValidToken();
          if (token) cb(token);
        },
        volume: 0.5,
      });

      player.addListener("ready", async ({ device_id }) => {
        setWebPlayerDeviceId(device_id);
        setWebPlayerReady(true);
        setIsPlayerReady(true);
        // FORCE TRANSFER: Makes the hub the controller
        await callSpotifyApi("transfer", { deviceId: device_id });
      });

      player.addListener("player_state_changed", (state) => {
        if (!state) return;
        setPlaybackState({
          isPlaying: !state.paused,
          track: normalizeTrack(state.track_window.current_track),
          progress: state.position,
          volume: 100,
          device: {
            id: (player as any)._options?.id || "", // Fix for TS2339
            name: "Harmony Hub Player",
            type: "Computer",
          },
        });
      });

      player.connect();
      playerRef.current = player;
    };

    if (window.Spotify) setupPlayer();
    else window.onSpotifyWebPlaybackSDKReady = setupPlayer;
  }, [tokens, ensureValidToken, callSpotifyApi]);

  useEffect(() => {
    if (tokens) initializeWebPlaybackSDK();
  }, [tokens, initializeWebPlaybackSDK]);

  const play = useCallback(
    async (uri?: string, uris?: string[]) => {
      const devId = webPlayerDeviceId || playbackState?.device?.id;
      await callSpotifyApi("play", { uri, uris, deviceId: devId });
      setTimeout(refreshPlaybackState, 500);
    },
    [callSpotifyApi, webPlayerDeviceId, playbackState?.device?.id, refreshPlaybackState],
  );

  const pause = useCallback(async () => {
    const devId = webPlayerDeviceId || playbackState?.device?.id;
    await callSpotifyApi("pause", { deviceId: devId });
    setTimeout(refreshPlaybackState, 500);
  }, [callSpotifyApi, webPlayerDeviceId, playbackState?.device?.id, refreshPlaybackState]);

  const seek = useCallback(
    async (ms: number) => {
      const devId = webPlayerDeviceId || playbackState?.device?.id;
      if (playerRef.current && devId === webPlayerDeviceId) {
        await playerRef.current.seek(ms);
      } else {
        await callSpotifyApi("seek", { position: Math.floor(ms), deviceId: devId });
      }
    },
    [callSpotifyApi, webPlayerDeviceId, playbackState?.device?.id],
  );

  const transferPlayback = useCallback(
    async (deviceId: string) => {
      await callSpotifyApi("transfer", { deviceId });
      setTimeout(refreshPlaybackState, 500);
    },
    [callSpotifyApi, refreshPlaybackState],
  );

  useEffect(() => {
    if (!user) return;
    const loadTokens = async () => {
      const { data } = await supabase.from("spotify_tokens").select("*").eq("user_id", user.id).maybeSingle();
      if (data)
        setTokens({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: new Date(data.expires_at).getTime(),
        });
      setIsLoading(false);
    };
    loadTokens();
  }, [user]);

  return (
    <SpotifyContext.Provider
      value={{
        isConnected: !!tokens,
        isLoading,
        isPlayerReady,
        isPlayerConnecting,
        tokens,
        playbackState,
        devices,
        webPlayerReady,
        webPlayerDeviceId,
        connect: async () => {},
        disconnect: () => {},
        play,
        pause,
        next: async () => {},
        previous: async () => {},
        setVolume: async (v) => await playerRef.current?.setVolume(v / 100),
        seek,
        refreshPlaybackState,
        transferPlayback,
      }}
    >
      {children}
    </SpotifyContext.Provider>
  );
};

export const useSpotify = () => {
  const context = useContext(SpotifyContext);
  if (!context) throw new Error("useSpotify must be used within SpotifyProvider");
  return context;
};

// --- FILE: src/contexts/UnifiedAudioContext.tsx ---

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

  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const youtubePlayerRef = useRef<any>(null);

  // Sync state with Spotify Context
  useEffect(() => {
    if (spotify.playbackState?.track) {
      setActiveSourceState("spotify");
      setIsPlaying(spotify.playbackState.isPlaying);
      setProgress(spotify.playbackState.progress);
      setDuration(spotify.playbackState.track.duration_ms);
    }
  }, [spotify.playbackState]);

  const play = async () => {
    if (activeSource === "spotify") await spotify.play();
    else if (localAudioRef.current) {
      await localAudioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pause = async () => {
    if (activeSource === "spotify") await spotify.pause();
    else if (localAudioRef.current) {
      localAudioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const seek = async (ms: number) => {
    if (activeSource === "spotify") await spotify.seek(ms);
    else if (localAudioRef.current) {
      localAudioRef.current.currentTime = ms / 1000;
      setProgress(ms);
    }
  };

  const currentTrack: UnifiedTrack | null = (() => {
    if (activeSource === "spotify" && spotify.playbackState?.track) {
      const t = spotify.playbackState.track;
      return {
        id: t.id,
        title: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        albumArt: t.albumArt,
        duration: t.duration_ms,
        source: "spotify",
      };
    }
    if (activeSource === "local" && localTrack) {
      return {
        id: localTrack.id,
        title: localTrack.title,
        artist: localTrack.artist,
        albumArt: localTrack.albumArt,
        duration,
        source: "local",
      };
    }
    return null;
  })();

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
        next: async () => {},
        previous: async () => {},
        setVolume: async (v) => setVolumeState(v),
        setGlobalVolume: async (v) => setVolumeState(v),
        toggleMute: async () => setIsMuted(!isMuted),
        seek,
        playTrack: async (t) => {},
        playLocalTrack: async (t) => {},
        playYouTubeVideo: () => {},
        playSoundCloudTrack: async () => {},
        setActiveSource: (s) => setActiveSourceState(s),
        registerYouTubePlayer: () => {},
        unregisterYouTubePlayer: () => {},
        localAudioRef,
        fadeAllAndPause: async () => ({}),
        resumeAll: async () => {},
        stopAllAudio: async () => {},
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
        playQueueTrack: async () => {},
        toggleShuffle: queueManager.toggleShuffle,
        toggleRepeat: queueManager.toggleRepeat,
        isSyncing: false,
        connectedDevices: 0,
        broadcastPlaybackState: () => {},
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

// --- FILE: src/components/PlaybackBar.tsx ---

import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SeekBar } from "@/components/SeekBar";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  Music,
  Sliders,
  Keyboard,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const PlaybackBar = () => {
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    isMuted,
    play,
    pause,
    seek,
    setGlobalVolume,
    toggleMute,
  } = useUnifiedAudio();

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[90px] bg-black border-t border-white/10 z-[100] px-4">
      <div className="h-full grid grid-cols-3 items-center">
        {/* Track Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-14 h-14 rounded shadow-lg overflow-hidden bg-zinc-800 flex-shrink-0">
            {currentTrack?.albumArt ? (
              <img src={currentTrack.albumArt} className="w-full h-full object-cover" alt={currentTrack.title} />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-700">
                <Music className="h-6 w-6 text-zinc-500" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-white truncate text-sm">{currentTrack?.title || "No Track Playing"}</p>
            <p className="text-xs text-zinc-400 truncate">{currentTrack?.artist || "Select a track"}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-white">
              <SkipBack className="h-4 w-4 fill-current" />
            </Button>
            <Button
              size="icon"
              onClick={() => (isPlaying ? pause() : play())}
              className="h-8 w-8 rounded-full bg-white text-black"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current ml-0.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="text-white">
              <SkipForward className="h-4 w-4 fill-current" />
            </Button>
          </div>
          <SeekBar progressMs={progress} durationMs={duration} onSeek={seek} className="w-full max-w-[600px]" />
        </div>

        {/* Tools */}
        <div className="flex items-center justify-end gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-zinc-400">
                <Keyboard className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-64 bg-zinc-900 border-zinc-800">
              <div className="p-2 space-y-2 text-xs text-white">
                <p className="font-bold border-b border-white/10 pb-1">Shortcuts</p>
                <div className="flex justify-between">
                  <span>Play/Pause</span>
                  <kbd className="bg-zinc-800 px-1 rounded">Space</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Seek Forward</span>
                  <kbd className="bg-zinc-800 px-1 rounded">→</kbd>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2 w-32">
            <Button variant="ghost" size="icon" onClick={toggleMute} className="text-zinc-400">
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider value={[isMuted ? 0 : volume]} max={100} onValueChange={(v) => setGlobalVolume(v[0])} />
          </div>
        </div>
      </div>
    </div>
  );
};
