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
  albumArt?: string; // Guaranteed fallback property
}

interface SpotifyPlaybackState {
  isPlaying: boolean;
  track: SpotifyTrack | null;
  progress: number;
  volume: number;
  device: { id: string; name: string; type: string } | null;
}

interface SpotifyContextType {
  isConnected: boolean;
  isLoading: boolean;
  isPlayerReady: boolean;
  isPlayerConnecting: boolean;
  tokens: SpotifyTokens | null;
  playbackState: SpotifyPlaybackState | null;
  devices: any[];
  playlists: any[];
  savedTracks: SpotifyTrack[];
  recentlyPlayed: any[];
  webPlayerReady: boolean;
  webPlayerDeviceId: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  play: (uri?: string, uris?: string[]) => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  fadeVolume: (targetVolume: number, durationMs: number) => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  loadPlaylists: () => Promise<void>;
  loadSavedTracks: () => Promise<void>;
  loadRecentlyPlayed: () => Promise<void>;
  refreshPlaybackState: () => Promise<void>;
  reinitializePlayer: () => Promise<void>;
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
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [savedTracks, setSavedTracks] = useState<SpotifyTrack[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<any[]>([]);
  const [webPlayerReady, setWebPlayerReady] = useState(false);
  const [webPlayerDeviceId, setWebPlayerDeviceId] = useState<string | null>(null);
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const sdkLoadedRef = useRef(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Helper to safely extract images and normalize data
  const normalizeTrack = (track: any): SpotifyTrack => {
    if (!track) return track;
    return {
      ...track,
      albumArt: track.album?.images?.[0]?.url || track.album_art || "/placeholder.png",
    };
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
    } catch (err) {
      return null;
    }
  }, [tokens, saveTokensToDb]);

  const callSpotifyApi = useCallback(
    async (action: string, params: Record<string, any> = {}) => {
      const accessToken = await ensureValidToken();
      if (!accessToken) throw new Error("Not connected");
      const { data, error } = await supabase.functions.invoke("spotify-player", {
        body: { action, accessToken, ...params },
      });
      if (error) throw error;
      return data;
    },
    [ensureValidToken],
  );

  const refreshPlaybackState = useCallback(async () => {
    try {
      const [playback, deviceList] = await Promise.all([callSpotifyApi("get_playback"), callSpotifyApi("get_devices")]);
      if (playback) {
        setPlaybackState({
          isPlaying: playback.is_playing,
          track: normalizeTrack(playback.item), // Normalize here
          progress: playback.progress_ms,
          volume: playback.device?.volume_percent ?? 100,
          device: playback.device,
        });
      }
      setDevices(deviceList?.devices || []);
    } catch (err) {
      console.error(err);
    }
  }, [callSpotifyApi]);

  const loadPlaylists = useCallback(async () => {
    const data = await callSpotifyApi("get_playlists");
    setPlaylists(data?.items || []);
  }, [callSpotifyApi]);

  const loadSavedTracks = useCallback(async () => {
    const data = await callSpotifyApi("get_saved_tracks");
    setSavedTracks(data?.items?.map((i: any) => normalizeTrack(i.track)) || []);
  }, [callSpotifyApi]);

  const loadRecentlyPlayed = useCallback(async () => {
    const data = await callSpotifyApi("get_recently_played");
    const items =
      data?.items?.map((i: any) => ({
        ...i,
        track: normalizeTrack(i.track),
      })) || [];
    setRecentlyPlayed(items);
  }, [callSpotifyApi]);

  const play = useCallback(
    async (uri?: string, uris?: string[]) => {
      await callSpotifyApi("play", { uri, uris, deviceId: webPlayerDeviceId || undefined });
      setTimeout(refreshPlaybackState, 500);
    },
    [callSpotifyApi, refreshPlaybackState, webPlayerDeviceId],
  );

  const pause = useCallback(async () => {
    await callSpotifyApi("pause");
    setTimeout(refreshPlaybackState, 500);
  }, [callSpotifyApi, refreshPlaybackState]);

  const next = useCallback(async () => {
    await callSpotifyApi("next");
    setTimeout(refreshPlaybackState, 500);
  }, [callSpotifyApi, refreshPlaybackState]);

  const previous = useCallback(async () => {
    await callSpotifyApi("previous");
    setTimeout(refreshPlaybackState, 500);
  }, [callSpotifyApi, refreshPlaybackState]);

  const seek = useCallback(
    async (positionMs: number) => {
      await callSpotifyApi("seek", { position: Math.floor(positionMs) });
      setPlaybackState((prev) => (prev ? { ...prev, progress: positionMs } : null));
    },
    [callSpotifyApi],
  );

  const setVolume = useCallback(
    async (volume: number) => {
      await callSpotifyApi("volume", { volume: Math.round(volume) });
      setPlaybackState((prev) => (prev ? { ...prev, volume } : null));
    },
    [callSpotifyApi],
  );

  const fadeVolume = useCallback(
    async (targetVolume: number, durationMs: number) => {
      const currentVolume = playbackState?.volume ?? 100;
      const steps = Math.max(10, Math.floor(durationMs / 100));
      const stepDuration = durationMs / steps;
      const volumeDelta = (targetVolume - currentVolume) / steps;

      for (let i = 1; i <= steps; i++) {
        const newVolume = Math.round(currentVolume + volumeDelta * i);
        await callSpotifyApi("volume", { volume: Math.max(0, Math.min(100, newVolume)) });
        await new Promise((resolve) => setTimeout(resolve, stepDuration));
      }
      setPlaybackState((prev) => (prev ? { ...prev, volume: targetVolume } : null));
    },
    [callSpotifyApi, playbackState?.volume],
  );

  const transferPlayback = useCallback(
    async (deviceId: string) => {
      await callSpotifyApi("transfer", { deviceId });
      setTimeout(refreshPlaybackState, 500);
    },
    [callSpotifyApi, refreshPlaybackState],
  );

  const initializeWebPlaybackSDK = useCallback(async () => {
    if (!tokens || sdkLoadedRef.current) return;
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);
    sdkLoadedRef.current = true;

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: "Harmony Hub Player",
        getOAuthToken: (cb) => cb(tokens.accessToken),
        volume: 0.5,
      });

      player.addListener("ready", ({ device_id }) => {
        setWebPlayerDeviceId(device_id);
        setWebPlayerReady(true);
        setIsPlayerReady(true);
      });

      player.addListener("player_state_changed", (state) => {
        if (!state) return;
        setPlaybackState({
          isPlaying: !state.paused,
          track: normalizeTrack(state.track_window?.current_track), // Normalize here
          progress: state.position,
          volume: 100,
          device: { id: webPlayerDeviceId || "", name: "Web Player", type: "Computer" },
        });
      });

      player.connect();
      playerRef.current = player;
    };
  }, [tokens, webPlayerDeviceId]);

  useEffect(() => {
    if (tokens && !isPlayerConnecting) initializeWebPlaybackSDK();
  }, [tokens, isPlayerConnecting, initializeWebPlaybackSDK]);

  useEffect(() => {
    const loadTokens = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
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

  // Handle OAuth callback from popup window
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "spotify-callback") return;

      const { code, error } = event.data;

      if (error) {
        toast({ title: "Spotify Connection Failed", description: error, variant: "destructive" });
        return;
      }

      if (code) {
        try {
          const { data, error: exchangeError } = await supabase.functions.invoke("spotify-auth", {
            body: { action: "exchange", code, redirectUri: REDIRECT_URI },
          });
          if (exchangeError) throw exchangeError;

          const newTokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
          };
          setTokens(newTokens);
          await saveTokensToDb(newTokens);
          toast({ title: "Spotify Connected", description: "Successfully connected to Spotify!" });
        } catch (err: any) {
          toast({ title: "Connection Failed", description: err.message || "Failed to connect", variant: "destructive" });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [saveTokensToDb, toast]);

  const connect = useCallback(async () => {
    const { data } = await supabase.functions.invoke("spotify-auth", {
      body: { action: "get_auth_url", redirectUri: REDIRECT_URI },
    });
    if (data?.authUrl) window.open(data.authUrl, "_blank", "width=500,height=700");
  }, []);

  const disconnect = () => {
    setTokens(null);
    setPlaybackState(null);
  };

  const value = {
    isConnected: !!tokens,
    isLoading,
    isPlayerReady,
    isPlayerConnecting,
    tokens,
    playbackState,
    devices,
    playlists,
    savedTracks,
    recentlyPlayed,
    webPlayerReady,
    webPlayerDeviceId,
    connect,
    disconnect,
    play,
    pause,
    next,
    previous,
    setVolume,
    fadeVolume,
    seek,
    loadPlaylists,
    loadSavedTracks,
    loadRecentlyPlayed,
    refreshPlaybackState,
    reinitializePlayer: async () => {},
    transferPlayback,
  };

  return <SpotifyContext.Provider value={value}>{children}</SpotifyContext.Provider>;
};

export const useSpotify = () => {
  const context = useContext(SpotifyContext);
  if (!context) throw new Error("useSpotify must be used within SpotifyProvider");
  return context;
};
