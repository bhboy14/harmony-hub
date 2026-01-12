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

  // Simple in-memory caching
  const playlistsCacheRef = useRef<{ ts: number; items: any[] } | null>(null);
  const savedTracksCacheRef = useRef<{ ts: number; items: SpotifyTrack[] } | null>(null);
  const recentlyPlayedCacheRef = useRef<{ ts: number; items: any[] } | null>(null);

  // Track when we're actively changing volume to prevent refresh from overwriting
  const volumeChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isVolumeChangingRef = useRef(false);

  const pendingApiVolumeRef = useRef<number | null>(null);
  const apiVolumeTimerRef = useRef<number | null>(null);
  const lastApiVolumeCallAtRef = useRef(0);
  const { toast } = useToast();
  const { user } = useAuth();

  const normalizeTrack = (track: any): SpotifyTrack => {
    if (!track) return track;
    // Handle both SDK structure and Web API structure
    const images = track.album?.images || [];
    const albumArt = images[0]?.url || track.album_art || "/placeholder.png";
    return {
      ...track,
      albumArt,
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

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      try {
        const { data, error } = await supabase.functions.invoke("spotify-player", {
          body: { action, accessToken, ...params },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (error) throw error;
        return data;
      } catch (err: any) {
        const msg = err?.message || "";
        if (msg.includes("429")) {
          console.warn("Spotify Rate Limit hit");
        }
        throw err;
      }
    },
    [ensureValidToken],
  );

  const refreshPlaybackState = useCallback(async () => {
    if (!tokens) return;
    try {
      // Parallel fetch for speed
      const [playback, deviceList] = await Promise.all([callSpotifyApi("get_playback"), callSpotifyApi("get_devices")]);

      if (playback && playback.item) {
        setPlaybackState((prev) => ({
          isPlaying: playback.is_playing,
          track: normalizeTrack(playback.item),
          progress: playback.progress_ms,
          volume: isVolumeChangingRef.current ? (prev?.volume ?? 100) : (playback.device?.volume_percent ?? 100),
          device: playback.device,
        }));
      } else if (playback === null) {
        // Not playing anything
        // Keep old state mostly, or set isPlaying false
        setPlaybackState((prev) => (prev ? { ...prev, isPlaying: false } : null));
      }

      const rawDevices: any[] = deviceList?.devices || [];
      const byKey = new Map<string, any>();
      for (const d of rawDevices) {
        const key = `${d?.name || ""}|${d?.type || ""}`;
        const existing = byKey.get(key);
        if (!existing || d?.is_active) byKey.set(key, d);
      }
      setDevices(Array.from(byKey.values()));
    } catch (err) {
      console.error("Error refreshing playback state:", err);
    }
  }, [callSpotifyApi, tokens]);

  // POLL PLAYBACK STATE (Fixes "Not Showing" issue)
  useEffect(() => {
    if (!tokens) return;
    const interval = setInterval(() => {
      // Only poll if we haven't received a high-speed event recently
      // But for now, simple polling is safer to ensure sync.
      refreshPlaybackState();
    }, 3000);
    return () => clearInterval(interval);
  }, [tokens, refreshPlaybackState]);

  const loadPlaylists = useCallback(async () => {
    const ttlMs = 5 * 60 * 1000;
    const cached = playlistsCacheRef.current;
    if (cached && Date.now() - cached.ts < ttlMs) {
      setPlaylists(cached.items);
      return;
    }
    const data = await callSpotifyApi("get_playlists");
    const items = data?.items || [];
    playlistsCacheRef.current = { ts: Date.now(), items };
    setPlaylists(items);
  }, [callSpotifyApi]);

  const loadSavedTracks = useCallback(async () => {
    const ttlMs = 5 * 60 * 1000;
    const cached = savedTracksCacheRef.current;
    if (cached && Date.now() - cached.ts < ttlMs) {
      setSavedTracks(cached.items);
      return;
    }
    const data = await callSpotifyApi("get_saved_tracks");
    const items = data?.items?.map((i: any) => normalizeTrack(i.track)) || [];
    savedTracksCacheRef.current = { ts: Date.now(), items };
    setSavedTracks(items);
  }, [callSpotifyApi]);

  const loadRecentlyPlayed = useCallback(async () => {
    const ttlMs = 30 * 1000;
    const cached = recentlyPlayedCacheRef.current;
    if (cached && Date.now() - cached.ts < ttlMs) {
      setRecentlyPlayed(cached.items);
      return;
    }
    const data = await callSpotifyApi("get_recently_played");
    const items = data?.items?.map((i: any) => ({ ...i, track: normalizeTrack(i.track) })) || [];
    recentlyPlayedCacheRef.current = { ts: Date.now(), items };
    setRecentlyPlayed(items);
  }, [callSpotifyApi]);

  const getActiveDevice = useCallback(async (): Promise<string | null> => {
    let targetDeviceId = webPlayerDeviceId || playbackState?.device?.id;
    if (targetDeviceId) return targetDeviceId;

    try {
      const deviceList = await callSpotifyApi("get_devices");
      const availableDevices = deviceList?.devices || [];

      if (availableDevices.length === 0) {
        toast({
          title: "No Spotify Device",
          description: "Open Spotify on a device to start listening.",
          variant: "destructive",
        });
        return null;
      }

      const webPlayer = availableDevices.find((d: any) => d.name === "Harmony Hub Player");
      const firstDevice = availableDevices[0];
      targetDeviceId = webPlayer?.id || firstDevice?.id;

      if (targetDeviceId) {
        await callSpotifyApi("transfer", { deviceId: targetDeviceId });
      }
      return targetDeviceId;
    } catch (err) {
      console.error("Failed to get devices:", err);
      return null;
    }
  }, [callSpotifyApi, webPlayerDeviceId, playbackState?.device?.id, toast]);

  const play = useCallback(
    async (uri?: string, uris?: string[]) => {
      const targetDeviceId = await getActiveDevice();
      if (!targetDeviceId) return;
      await callSpotifyApi("play", { uri, uris, deviceId: targetDeviceId });
      setTimeout(refreshPlaybackState, 300);
    },
    [callSpotifyApi, refreshPlaybackState, getActiveDevice],
  );

  const pause = useCallback(async () => {
    const targetDeviceId = await getActiveDevice();
    if (!targetDeviceId) return;
    await callSpotifyApi("pause", { deviceId: targetDeviceId });
    setTimeout(refreshPlaybackState, 300);
  }, [callSpotifyApi, refreshPlaybackState, getActiveDevice]);

  const next = useCallback(async () => {
    const targetDeviceId = await getActiveDevice();
    if (!targetDeviceId) return;
    await callSpotifyApi("next", { deviceId: targetDeviceId });
    setTimeout(refreshPlaybackState, 300);
  }, [callSpotifyApi, refreshPlaybackState, getActiveDevice]);

  const previous = useCallback(async () => {
    const targetDeviceId = await getActiveDevice();
    if (!targetDeviceId) return;
    await callSpotifyApi("previous", { deviceId: targetDeviceId });
    setTimeout(refreshPlaybackState, 300);
  }, [callSpotifyApi, refreshPlaybackState, getActiveDevice]);

  const seek = useCallback(
    async (positionMs: number) => {
      const targetDeviceId = webPlayerDeviceId || playbackState?.device?.id;
      // Local seek if web player is active (smoother)
      if (playerRef.current && webPlayerDeviceId && targetDeviceId === webPlayerDeviceId) {
        await playerRef.current.seek(Math.floor(positionMs));
        setPlaybackState((prev) => (prev ? { ...prev, progress: positionMs } : null));
        return;
      }
      await callSpotifyApi("seek", { position: Math.floor(positionMs), deviceId: targetDeviceId });
      setPlaybackState((prev) => (prev ? { ...prev, progress: positionMs } : null));
    },
    [callSpotifyApi, webPlayerDeviceId, playbackState?.device?.id],
  );

  const setVolume = useCallback(
    async (volume: number) => {
      isVolumeChangingRef.current = true;
      if (volumeChangeTimeoutRef.current) clearTimeout(volumeChangeTimeoutRef.current);

      setPlaybackState((prev) => (prev ? { ...prev, volume } : null));
      const targetDeviceId = webPlayerDeviceId || playbackState?.device?.id;

      if (playerRef.current && webPlayerDeviceId && targetDeviceId === webPlayerDeviceId) {
        await playerRef.current.setVolume(Math.max(0, Math.min(1, volume / 100)));
      } else {
        pendingApiVolumeRef.current = Math.round(volume);
        const MIN_INTERVAL_MS = 500;
        const now = Date.now();
        const waitMs = Math.max(0, MIN_INTERVAL_MS - (now - lastApiVolumeCallAtRef.current));

        if (apiVolumeTimerRef.current == null) {
          apiVolumeTimerRef.current = window.setTimeout(async () => {
            apiVolumeTimerRef.current = null;
            const v = pendingApiVolumeRef.current;
            pendingApiVolumeRef.current = null;
            if (v == null) return;
            lastApiVolumeCallAtRef.current = Date.now();
            await callSpotifyApi("volume", { volume: v, deviceId: targetDeviceId });
          }, waitMs);
        }
      }
      volumeChangeTimeoutRef.current = setTimeout(() => {
        isVolumeChangingRef.current = false;
      }, 2000);
    },
    [callSpotifyApi, webPlayerDeviceId, playbackState?.device?.id],
  );

  const fadeVolume = useCallback(
    async (targetVolume: number, durationMs: number) => {
      const currentVolume = playbackState?.volume ?? 100;
      const steps = Math.max(10, Math.floor(durationMs / 100));
      const stepDuration = durationMs / steps;
      const volumeDelta = (targetVolume - currentVolume) / steps;
      const targetDeviceId = webPlayerDeviceId || playbackState?.device?.id;

      for (let i = 1; i <= steps; i++) {
        const newVolume = Math.round(currentVolume + volumeDelta * i);
        await callSpotifyApi("volume", { volume: Math.max(0, Math.min(100, newVolume)), deviceId: targetDeviceId });
        await new Promise((resolve) => setTimeout(resolve, stepDuration));
      }
      setPlaybackState((prev) => (prev ? { ...prev, volume: targetVolume } : null));
    },
    [callSpotifyApi, playbackState?.volume, webPlayerDeviceId, playbackState?.device?.id],
  );

  const transferPlayback = useCallback(
    async (deviceId: string) => {
      await callSpotifyApi("transfer", { deviceId });
      setTimeout(refreshPlaybackState, 500);
    },
    [callSpotifyApi, refreshPlaybackState],
  );

  // INITIALIZE PLAYER (Robust handling)
  const initializeWebPlaybackSDK = useCallback(async () => {
    if (!tokens) return;

    // Define initialization logic
    const setupPlayer = () => {
      if (playerRef.current) return; // Already initialized

      const player = new window.Spotify.Player({
        name: "Harmony Hub Player",
        getOAuthToken: async (cb) => {
          const token = await ensureValidToken();
          if (token) cb(token);
        },
        volume: 0.5,
      });

      player.addListener("ready", ({ device_id }) => {
        console.log("Spotify Web Player Ready:", device_id);
        setWebPlayerDeviceId(device_id);
        setWebPlayerReady(true);
        setIsPlayerReady(true);
        // Optional: Auto-connect logic here if desired
      });

      player.addListener("not_ready", ({ device_id }) => {
        console.log("Device ID has gone offline", device_id);
        setWebPlayerReady(false);
      });

      player.addListener("player_state_changed", (state) => {
        if (!state) return;
        setPlaybackState({
          isPlaying: !state.paused,
          track: normalizeTrack(state.track_window.current_track),
          progress: state.position,
          volume: 100, // Web player always reports 1 (100%)
          device: {
            id: player._options.id || "", // Internal ID if available
            name: "Harmony Hub Player",
            type: "Computer",
          },
        });
      });

      player.connect();
      playerRef.current = player;
    };

    // If SDK is already ready, setup immediately
    if (window.Spotify) {
      setupPlayer();
    } else {
      // Otherwise wait for the event
      window.onSpotifyWebPlaybackSDKReady = setupPlayer;
      if (!document.getElementById("spotify-player-script")) {
        const script = document.createElement("script");
        script.id = "spotify-player-script";
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [tokens, ensureValidToken]);

  // Trigger init
  useEffect(() => {
    if (tokens && !isPlayerConnecting) {
      initializeWebPlaybackSDK();
    }
  }, [tokens, isPlayerConnecting, initializeWebPlaybackSDK]);

  // Clean up
  useEffect(() => {
    const handleBeforeUnload = () => {
      playerRef.current?.disconnect();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Initial Token Load
  useEffect(() => {
    const loadTokens = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      const { data } = await supabase.from("spotify_tokens").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setTokens({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: new Date(data.expires_at).getTime(),
        });
      }
      setIsLoading(false);
    };
    loadTokens();
  }, [user]);

  // Auth Callback Handling
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
          toast({
            title: "Connection Failed",
            description: err.message || "Failed to connect",
            variant: "destructive",
          });
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
    playerRef.current?.disconnect();
    setTokens(null);
    setPlaybackState(null);
  };

  const value: SpotifyContextType = {
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

export const useSpotify = (): SpotifyContextType => {
  const context = useContext(SpotifyContext);
  if (!context) throw new Error("useSpotify must be used within SpotifyProvider");
  return context;
};
