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

  const volumeChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isVolumeChangingRef = useRef(false);
  const lastApiVolumeCallAtRef = useRef(0);
  const pendingApiVolumeRef = useRef<number | null>(null);
  const apiVolumeTimerRef = useRef<number | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();

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
      if (!session?.access_token) throw new Error("Not authenticated");

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
    [ensureValidToken],
  );

  const refreshPlaybackState = useCallback(async () => {
    if (!tokens) return;
    try {
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
        setPlaybackState((prev) => (prev ? { ...prev, isPlaying: false } : null));
      }

      const rawDevices = deviceList?.devices || [];
      const byKey = new Map<string, any>();
      for (const d of rawDevices) {
        const key = `${d?.name || ""}|${d?.type || ""}`;
        if (!byKey.has(key) || d?.is_active) byKey.set(key, d);
      }
      setDevices(Array.from(byKey.values()));
    } catch (err) {
      console.error("Error refreshing playback state:", err);
    }
  }, [callSpotifyApi, tokens]);

  useEffect(() => {
    if (!tokens) return;
    const interval = setInterval(refreshPlaybackState, 3000);
    return () => clearInterval(interval);
  }, [tokens, refreshPlaybackState]);

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

        // AUTO-TRANSFER: Ensure the SDK actually starts taking control
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
  }, [tokens, ensureValidToken, callSpotifyApi]);

  useEffect(() => {
    if (tokens && !isPlayerConnecting) initializeWebPlaybackSDK();
  }, [tokens, isPlayerConnecting, initializeWebPlaybackSDK]);

  // Public API Methods
  const play = useCallback(
    async (uri?: string, uris?: string[]) => {
      const targetId = webPlayerDeviceId || playbackState?.device?.id;
      if (!targetId) return;
      await callSpotifyApi("play", { uri, uris, deviceId: targetId });
      setTimeout(refreshPlaybackState, 300);
    },
    [callSpotifyApi, refreshPlaybackState, webPlayerDeviceId, playbackState?.device?.id],
  );

  const pause = useCallback(async () => {
    const targetId = webPlayerDeviceId || playbackState?.device?.id;
    if (!targetId) return;
    await callSpotifyApi("pause", { deviceId: targetId });
    setTimeout(refreshPlaybackState, 300);
  }, [callSpotifyApi, refreshPlaybackState, webPlayerDeviceId, playbackState?.device?.id]);

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

  const value: SpotifyContextType = {
    isConnected: !!tokens,
    isLoading,
    isPlayerReady,
    isPlayerConnecting,
    tokens,
    playbackState,
    devices,
    playlists: [],
    savedTracks: [],
    recentlyPlayed: [],
    webPlayerReady,
    webPlayerDeviceId,
    connect: async () => {},
    disconnect: () => {},
    play,
    pause,
    next: async () => {},
    previous: async () => {},
    setVolume,
    fadeVolume: async () => {},
    seek,
    loadPlaylists: async () => {},
    loadSavedTracks: async () => {},
    loadRecentlyPlayed: async () => {},
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
