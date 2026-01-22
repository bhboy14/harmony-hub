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
  needsReconnect: boolean;
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
  reconnect: () => Promise<void>;
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
const CLIENT_ID = "014bb7e5e5a44a1db69c4001c04b85da";

export const SpotifyProvider = ({ children }: { children: ReactNode }) => {
  const [tokens, setTokens] = useState<SpotifyTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlayerConnecting, setIsPlayerConnecting] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [playbackState, setPlaybackState] = useState<SpotifyPlaybackState | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [savedTracks, setSavedTracks] = useState<SpotifyTrack[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<any[]>([]);
  const [webPlayerReady, setWebPlayerReady] = useState(false);
  const [webPlayerDeviceId, setWebPlayerDeviceId] = useState<string | null>(null);
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const reconnectToastShownRef = useRef(false);

  const volumeChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isVolumeChangingRef = useRef(false);
  const pendingApiVolumeRef = useRef<number | null>(null);
  const apiVolumeTimerRef = useRef<number | null>(null);

  const { toast } = useToast();
  const { user, session } = useAuth();

  const normalizeTrack = (track: any): SpotifyTrack => {
    if (!track) return track;
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

  // Load tokens from DB on mount
  useEffect(() => {
    const loadTokens = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("spotify_tokens")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (data && !error) {
          const loadedTokens: SpotifyTokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: new Date(data.expires_at).getTime(),
          };
          setTokens(loadedTokens);
        }
      } catch (err) {
        console.error("Error loading Spotify tokens:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadTokens();
  }, [user]);

  const ensureValidToken = useCallback(async (): Promise<string | null> => {
    if (!tokens) return null;
    if (Date.now() < tokens.expiresAt - 60000) return tokens.accessToken;
    try {
      if (!session?.access_token) {
        console.error("No Supabase session for Spotify token refresh");
        return null;
      }
      
      const { data, error } = await supabase.functions.invoke("spotify-auth", {
        body: { action: "refresh", refreshToken: tokens.refreshToken },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      const t = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || tokens.refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
      };
      setTokens(t);
      setNeedsReconnect(false);
      reconnectToastShownRef.current = false;
      await saveTokensToDb(t);
      return t.accessToken;
    } catch (err: any) {
      console.error("Failed to refresh Spotify token:", err);
      
      // Check if this is an invalid/expired refresh token error
      const errorMsg = err?.message?.toLowerCase() || "";
      const isInvalidToken = 
        errorMsg.includes("invalid_grant") || 
        errorMsg.includes("refresh token") ||
        errorMsg.includes("expired") ||
        errorMsg.includes("revoked");
      
      if (isInvalidToken || err?.status === 400) {
        setNeedsReconnect(true);
        
        // Show toast only once per session
        if (!reconnectToastShownRef.current) {
          reconnectToastShownRef.current = true;
          toast({
            title: "Spotify Session Expired",
            description: "Your Spotify connection needs to be refreshed. Click to reconnect.",
            variant: "destructive",
            duration: 10000,
          });
        }
      }
      
      return null;
    }
  }, [tokens, saveTokensToDb, toast]);

  const callSpotifyApi = useCallback(
    async (action: string, params: Record<string, any> = {}) => {
      const accessToken = await ensureValidToken();
      if (!accessToken) throw new Error("Not connected");

      if (!session?.access_token) {
        // Session not available - log warning but don't throw to avoid cascading errors
        console.warn("Spotify API call skipped: No active session");
        return null;
      }

      try {
        const { data, error } = await supabase.functions.invoke("spotify-player", {
          body: { action, accessToken, ...params },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (error) throw error;
        return data;
      } catch (err: any) {
        if (err?.message?.includes("429")) console.warn("Spotify Rate Limit hit");
        throw err;
      }
    },
    [ensureValidToken, session?.access_token],
  );

  const refreshPlaybackState = useCallback(async () => {
    if (!tokens || !user) return;
    try {
      const [playback, deviceList] = await Promise.all([callSpotifyApi("get_playback"), callSpotifyApi("get_devices")]);

      // Skip state updates if API calls returned null (no session)
      if (playback === null && deviceList === null) return;

      if (playback && playback.item) {
        setPlaybackState((prev) => ({
          isPlaying: playback.is_playing,
          track: normalizeTrack(playback.item),
          progress: playback.progress_ms,
          volume: isVolumeChangingRef.current ? (prev?.volume ?? 100) : (playback.device?.volume_percent ?? 100),
          device: playback.device,
        }));
      } else if (playback === null) {
        // Only update to not playing if we got a valid null response (not a session error)
        setPlaybackState((prev) => (prev ? { ...prev, isPlaying: false } : null));
      }

      if (deviceList) {
        const rawDevices = deviceList?.devices || [];
        const byKey = new Map<string, any>();
        for (const d of rawDevices) {
          const key = `${d?.name || ""}|${d?.type || ""}`;
          if (!byKey.has(key) || d?.is_active) byKey.set(key, d);
        }
        setDevices(Array.from(byKey.values()));
      }
    } catch (err: any) {
      // Don't log auth-related errors to console spam
      if (!err?.message?.includes("Not connected") && !err?.message?.includes("authenticated")) {
        console.error("Error refreshing playback state:", err);
      }
    }
  }, [callSpotifyApi, tokens, user]);

  // Load playlists
  const loadPlaylists = useCallback(async () => {
    if (!tokens || !user) return;
    try {
      const data = await callSpotifyApi("get_playlists");
      if (data?.items) {
        setPlaylists(data.items);
      }
    } catch (err: any) {
      if (!err?.message?.includes("Not connected")) {
        console.error("Error loading playlists:", err);
      }
    }
  }, [callSpotifyApi, tokens, user]);

  // Load saved tracks
  const loadSavedTracks = useCallback(async () => {
    if (!tokens || !user) return;
    try {
      const data = await callSpotifyApi("get_saved_tracks");
      if (data?.items) {
        setSavedTracks(data.items.map((item: any) => normalizeTrack(item.track)));
      }
    } catch (err: any) {
      if (!err?.message?.includes("Not connected")) {
        console.error("Error loading saved tracks:", err);
      }
    }
  }, [callSpotifyApi, tokens, user]);

  // Load recently played
  const loadRecentlyPlayed = useCallback(async () => {
    if (!tokens || !user) return;
    try {
      const data = await callSpotifyApi("get_recently_played");
      if (data?.items) {
        setRecentlyPlayed(data.items);
      }
    } catch (err: any) {
      if (!err?.message?.includes("Not connected")) {
        console.error("Error loading recently played:", err);
      }
    }
  }, [callSpotifyApi, tokens, user]);

  // Auto-load library data when connected
  useEffect(() => {
    if (tokens && user) {
      loadPlaylists();
      loadSavedTracks();
      loadRecentlyPlayed();
    }
  }, [tokens, user, loadPlaylists, loadSavedTracks, loadRecentlyPlayed]);

  useEffect(() => {
    if (!tokens || !user) return;
    const interval = setInterval(refreshPlaybackState, 3000);
    return () => clearInterval(interval);
  }, [tokens, user, refreshPlaybackState]);

  const transferPlayback = useCallback(
    async (deviceId: string) => {
      await callSpotifyApi("transfer", { deviceId });
      setTimeout(refreshPlaybackState, 500);
    },
    [callSpotifyApi, refreshPlaybackState],
  );

  const initializeWebPlaybackSDK = useCallback(async () => {
    if (!tokens) return;

    const setupPlayer = () => {
      if (playerRef.current) return;

      const player = new window.Spotify.Player({
        name: "Harmony Hub Player",
        getOAuthToken: async (cb) => {
          const token = await ensureValidToken();
          if (token) cb(token);
        },
        volume: 0.5,
      });

      player.addListener("ready", async ({ device_id }) => {
        console.log("Spotify Web Player Ready:", device_id);
        setWebPlayerDeviceId(device_id);
        setWebPlayerReady(true);
        setIsPlayerReady(true);

        try {
          await callSpotifyApi("transfer", { deviceId: device_id });
          console.log("Playback transferred to local Hub Player");
        } catch (e) {
          console.warn("Could not auto-transfer playback:", e);
        }
      });

      player.addListener("player_state_changed", (state) => {
        if (!state) return;
        setPlaybackState({
          isPlaying: !state.paused,
          track: normalizeTrack(state.track_window.current_track),
          progress: state.position,
          volume: 100,
          device: {
            id: (player as any)._options?.id || "",
            name: "Harmony Hub Player",
            type: "Computer",
          },
        });
      });

      player.addListener("not_ready", ({ device_id }) => {
        console.log("Device has gone offline:", device_id);
        setWebPlayerReady(false);
        setIsPlayerReady(false);
      });

      player.addListener("initialization_error", ({ message }) => {
        console.error("Spotify SDK init error:", message);
      });

      player.addListener("authentication_error", ({ message }) => {
        console.error("Spotify auth error:", message);
      });

      player.addListener("account_error", ({ message }) => {
        console.error("Spotify account error (Premium required):", message);
        toast({
          title: "Spotify Premium Required",
          description: "Web playback requires a Spotify Premium account.",
          variant: "destructive",
        });
      });

      player.connect();
      playerRef.current = player;
    };

    if (window.Spotify) {
      setupPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = setupPlayer;
      if (!document.getElementById("spotify-player-script")) {
        const script = document.createElement("script");
        script.id = "spotify-player-script";
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [tokens, ensureValidToken, callSpotifyApi, toast]);

  useEffect(() => {
    if (tokens && !isPlayerConnecting) initializeWebPlaybackSDK();
  }, [tokens, isPlayerConnecting, initializeWebPlaybackSDK]);

  // Connect to Spotify (OAuth flow)
  const connect = useCallback(async () => {
    const scopes = [
      "user-read-private",
      "user-read-email",
      "user-read-playback-state",
      "user-modify-playback-state",
      "user-read-currently-playing",
      "user-read-recently-played",
      "user-library-read",
      "playlist-read-private",
      "playlist-read-collaborative",
      "streaming",
    ].join(" ");

    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}`;
    window.location.href = authUrl;
  }, []);

  // Reconnect to Spotify (clears tokens and restarts OAuth flow)
  const reconnect = useCallback(async () => {
    // Clear existing tokens from state and DB
    if (playerRef.current) {
      playerRef.current.disconnect();
      playerRef.current = null;
    }
    setTokens(null);
    setNeedsReconnect(false);
    reconnectToastShownRef.current = false;
    setPlaybackState(null);
    setWebPlayerReady(false);
    setWebPlayerDeviceId(null);
    setIsPlayerReady(false);

    if (user) {
      await supabase.from("spotify_tokens").delete().eq("user_id", user.id);
    }

    // Start fresh OAuth flow
    await connect();
  }, [user, connect]);

  // Disconnect from Spotify
  const disconnect = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.disconnect();
      playerRef.current = null;
    }
    setTokens(null);
    setPlaybackState(null);
    setDevices([]);
    setPlaylists([]);
    setSavedTracks([]);
    setRecentlyPlayed([]);
    setWebPlayerReady(false);
    setWebPlayerDeviceId(null);
    setIsPlayerReady(false);

    if (user) {
      supabase.from("spotify_tokens").delete().eq("user_id", user.id);
    }

    toast({
      title: "Disconnected",
      description: "Your Spotify account has been disconnected.",
    });
  }, [user, toast]);

  // Play
  const play = useCallback(
    async (uri?: string, uris?: string[]) => {
      const targetId = webPlayerDeviceId || playbackState?.device?.id;
      if (!targetId) {
        console.warn("No target device for playback");
        return;
      }
      await callSpotifyApi("play", { uri, uris, deviceId: targetId });
      setTimeout(refreshPlaybackState, 300);
    },
    [callSpotifyApi, refreshPlaybackState, webPlayerDeviceId, playbackState?.device?.id],
  );

  // Pause
  const pause = useCallback(async () => {
    const targetId = webPlayerDeviceId || playbackState?.device?.id;
    if (!targetId) return;
    await callSpotifyApi("pause", { deviceId: targetId });
    setTimeout(refreshPlaybackState, 300);
  }, [callSpotifyApi, refreshPlaybackState, webPlayerDeviceId, playbackState?.device?.id]);

  // Next track
  const next = useCallback(async () => {
    if (playerRef.current && webPlayerReady) {
      await playerRef.current.nextTrack();
    } else {
      const targetId = webPlayerDeviceId || playbackState?.device?.id;
      if (targetId) {
        await callSpotifyApi("next", { deviceId: targetId });
      }
    }
    setTimeout(refreshPlaybackState, 300);
  }, [callSpotifyApi, refreshPlaybackState, webPlayerDeviceId, playbackState?.device?.id, webPlayerReady]);

  // Previous track
  const previous = useCallback(async () => {
    if (playerRef.current && webPlayerReady) {
      await playerRef.current.previousTrack();
    } else {
      const targetId = webPlayerDeviceId || playbackState?.device?.id;
      if (targetId) {
        await callSpotifyApi("previous", { deviceId: targetId });
      }
    }
    setTimeout(refreshPlaybackState, 300);
  }, [callSpotifyApi, refreshPlaybackState, webPlayerDeviceId, playbackState?.device?.id, webPlayerReady]);

  // Seek
  const seek = useCallback(
    async (positionMs: number) => {
      const targetId = webPlayerDeviceId || playbackState?.device?.id;
      if (playerRef.current && webPlayerDeviceId && targetId === webPlayerDeviceId) {
        await playerRef.current.seek(Math.floor(positionMs));
        setPlaybackState((prev) => (prev ? { ...prev, progress: positionMs } : null));
        return;
      }
      await callSpotifyApi("seek", { position: Math.floor(positionMs), deviceId: targetId });
    },
    [callSpotifyApi, webPlayerDeviceId, playbackState?.device?.id],
  );

  // Set volume
  const setVolume = useCallback(
    async (volume: number) => {
      isVolumeChangingRef.current = true;
      if (volumeChangeTimeoutRef.current) clearTimeout(volumeChangeTimeoutRef.current);

      setPlaybackState((prev) => (prev ? { ...prev, volume } : null));
      const targetId = webPlayerDeviceId || playbackState?.device?.id;

      if (playerRef.current && webPlayerDeviceId && targetId === webPlayerDeviceId) {
        await playerRef.current.setVolume(Math.max(0, Math.min(1, volume / 100)));
      } else {
        pendingApiVolumeRef.current = Math.round(volume);
        if (apiVolumeTimerRef.current == null) {
          apiVolumeTimerRef.current = window.setTimeout(async () => {
            apiVolumeTimerRef.current = null;
            const v = pendingApiVolumeRef.current;
            pendingApiVolumeRef.current = null;
            if (v != null) await callSpotifyApi("volume", { volume: v, deviceId: targetId });
          }, 500);
        }
      }
      volumeChangeTimeoutRef.current = setTimeout(() => {
        isVolumeChangingRef.current = false;
      }, 2000);
    },
    [callSpotifyApi, webPlayerDeviceId, playbackState?.device?.id],
  );

  // Fade volume smoothly
  const fadeVolume = useCallback(
    async (targetVolume: number, durationMs: number) => {
      const startVolume = playbackState?.volume ?? 100;
      const steps = Math.max(10, Math.floor(durationMs / 50));
      const stepDuration = durationMs / steps;
      const volumeStep = (targetVolume - startVolume) / steps;

      for (let i = 0; i <= steps; i++) {
        const newVolume = Math.round(startVolume + volumeStep * i);
        await setVolume(Math.max(0, Math.min(100, newVolume)));
        await new Promise((resolve) => setTimeout(resolve, stepDuration));
      }
    },
    [playbackState?.volume, setVolume],
  );

  // Reinitialize player
  const reinitializePlayer = useCallback(async () => {
    if (playerRef.current) {
      playerRef.current.disconnect();
      playerRef.current = null;
    }
    setWebPlayerReady(false);
    setWebPlayerDeviceId(null);
    setIsPlayerReady(false);
    setIsPlayerConnecting(true);

    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsPlayerConnecting(false);
    // This will trigger the useEffect to reinitialize
  }, []);

  const value: SpotifyContextType = {
    isConnected: !!tokens,
    isLoading,
    isPlayerReady,
    isPlayerConnecting,
    needsReconnect,
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
    reconnect,
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
    reinitializePlayer,
    transferPlayback,
  };

  return <SpotifyContext.Provider value={value}>{children}</SpotifyContext.Provider>;
};

export const useSpotify = () => {
  const context = useContext(SpotifyContext);
  if (!context) throw new Error("useSpotify must be used within SpotifyProvider");
  return context;
};
