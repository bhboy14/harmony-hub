import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
  uri: string;
}

interface SpotifyPlaybackState {
  isPlaying: boolean;
  track: SpotifyTrack | null;
  progress: number;
  volume: number;
  device: { id: string; name: string; type: string } | null;
}

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
}

interface SpotifyContextType {
  isConnected: boolean;
  isLoading: boolean;
  tokens: SpotifyTokens | null;
  playbackState: SpotifyPlaybackState | null;
  devices: SpotifyDevice[];
  playlists: SpotifyPlaylist[];
  savedTracks: SpotifyTrack[];
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  play: (uri?: string, uris?: string[]) => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  fadeVolume: (targetVolume: number, durationMs: number) => Promise<void>;
  transferPlayback: (deviceId: string) => Promise<void>;
  refreshPlaybackState: () => Promise<void>;
  loadPlaylists: () => Promise<void>;
  loadSavedTracks: () => Promise<void>;
}

const SpotifyContext = createContext<SpotifyContextType | null>(null);

const REDIRECT_URI = typeof window !== "undefined" ? `${window.location.origin}/spotify-callback` : "";

export const SpotifyProvider = ({ children }: { children: ReactNode }) => {
  const [tokens, setTokens] = useState<SpotifyTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackState, setPlaybackState] = useState<SpotifyPlaybackState | null>(null);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [savedTracks, setSavedTracks] = useState<SpotifyTrack[]>([]);
  const { toast } = useToast();
  const { user, session, isLoading: authLoading } = useAuth();

  // Load tokens from database on mount or when user changes
  useEffect(() => {
    const loadTokensFromDb = async () => {
      if (!user) {
        setTokens(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('spotify_tokens')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error loading Spotify tokens:', error);
        } else if (data) {
          setTokens({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: new Date(data.expires_at).getTime(),
          });
        }
      } catch (err) {
        console.error('Failed to load Spotify tokens:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTokensFromDb();
  }, [user]);

  // Save tokens to database
  const saveTokensToDb = useCallback(async (newTokens: SpotifyTokens) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('spotify_tokens')
        .upsert({
          user_id: user.id,
          access_token: newTokens.accessToken,
          refresh_token: newTokens.refreshToken,
          expires_at: new Date(newTokens.expiresAt).toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('Error saving Spotify tokens:', error);
      }
    } catch (err) {
      console.error('Failed to save Spotify tokens:', err);
    }
  }, [user]);

  // Delete tokens from database
  const deleteTokensFromDb = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('spotify_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting Spotify tokens:', error);
      }
    } catch (err) {
      console.error('Failed to delete Spotify tokens:', err);
    }
  }, [user]);

  // Refresh token if expired
  const ensureValidToken = useCallback(async (): Promise<string | null> => {
    if (!tokens) return null;

    if (Date.now() < tokens.expiresAt - 60000) {
      return tokens.accessToken;
    }

    console.log("Refreshing Spotify token...");
    try {
      if (!session?.access_token) throw new Error("Missing session");

      const { data, error } = await supabase.functions.invoke("spotify-auth", {
        body: { action: "refresh", refreshToken: tokens.refreshToken },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      const newTokens: SpotifyTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || tokens.refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
      };
      setTokens(newTokens);
      await saveTokensToDb(newTokens);
      return newTokens.accessToken;
    } catch (error) {
      console.error("Token refresh failed:", error);
      setTokens(null);
      await deleteTokensFromDb();
      toast({ title: "Spotify session expired", description: "Please reconnect.", variant: "destructive" });
      return null;
    }
  }, [tokens, session?.access_token, toast, saveTokensToDb, deleteTokensFromDb]);

  const callSpotifyApi = useCallback(async (action: string, params: Record<string, any> = {}) => {
    const accessToken = await ensureValidToken();
    if (!accessToken) throw new Error("Not connected to Spotify");

    const { data, error } = await supabase.functions.invoke("spotify-player", {
      body: { action, accessToken, ...params },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, [ensureValidToken, session?.access_token]);

  const connect = useCallback(async () => {
    setIsLoading(true);
    try {
      if (authLoading || !session?.access_token) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("spotify-auth", {
        body: { action: "get_auth_url", redirectUri: REDIRECT_URI },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      
      // Open Spotify auth in a popup
      const width = 450;
      const height = 730;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;
      
      window.open(
        data.authUrl,
        "Spotify Login",
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (error) {
      console.error("Spotify connect error:", error);
      toast({ title: "Failed to connect", description: "Could not initiate Spotify login.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, authLoading, session?.access_token]);

  // Handle callback from popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "spotify-callback" && event.data.code) {
        setIsLoading(true);
        try {
          if (authLoading || !session?.access_token) {
            throw new Error("Not authenticated");
          }

          const { data, error } = await supabase.functions.invoke("spotify-auth", {
            body: { action: "exchange", code: event.data.code, redirectUri: REDIRECT_URI },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });

          if (error) throw error;

          const newTokens: SpotifyTokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
          };
          setTokens(newTokens);
          await saveTokensToDb(newTokens);
          toast({ title: "Connected to Spotify", description: "Your Spotify account is now linked." });
        } catch (error) {
          console.error("Token exchange error:", error);
          toast({ title: "Connection failed", description: "Could not complete Spotify login.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [toast, saveTokensToDb, authLoading, session?.access_token]);

  const disconnect = useCallback(async () => {
    await deleteTokensFromDb();
    setTokens(null);
    setPlaybackState(null);
    setDevices([]);
    setPlaylists([]);
    setSavedTracks([]);
    toast({ title: "Disconnected", description: "Spotify account unlinked." });
  }, [toast, deleteTokensFromDb]);

  const refreshPlaybackState = useCallback(async () => {
    try {
      const [playback, deviceList] = await Promise.all([
        callSpotifyApi("get_playback"),
        callSpotifyApi("get_devices"),
      ]);

      if (playback) {
        setPlaybackState({
          isPlaying: playback.is_playing,
          track: playback.item,
          progress: playback.progress_ms,
          volume: playback.device?.volume_percent ?? 100,
          device: playback.device,
        });
      } else {
        setPlaybackState(null);
      }

      setDevices(deviceList?.devices || []);
    } catch (error) {
      console.error("Failed to refresh playback:", error);
    }
  }, [callSpotifyApi]);

  // Background token refresh scheduler - proactively refresh tokens before expiry
  useEffect(() => {
    if (!tokens || !session?.access_token) return;

    const scheduleRefresh = () => {
      const timeUntilExpiry = tokens.expiresAt - Date.now();
      // Refresh 5 minutes before expiry, or immediately if less than 5 min left
      const refreshIn = Math.max(timeUntilExpiry - 5 * 60 * 1000, 0);
      
      console.log(`Spotify token refresh scheduled in ${Math.round(refreshIn / 1000 / 60)} minutes`);
      
      return setTimeout(async () => {
        console.log("Background: Refreshing Spotify token...");
        try {
          const { data, error } = await supabase.functions.invoke("spotify-auth", {
            body: { action: "refresh", refreshToken: tokens.refreshToken },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });

          if (error) throw error;

          const newTokens: SpotifyTokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || tokens.refreshToken,
            expiresAt: Date.now() + data.expires_in * 1000,
          };
          setTokens(newTokens);
          await saveTokensToDb(newTokens);
          console.log("Background: Spotify token refreshed successfully");
        } catch (error) {
          console.error("Background token refresh failed:", error);
        }
      }, refreshIn);
    };

    const timeoutId = scheduleRefresh();
    return () => clearTimeout(timeoutId);
  }, [tokens, session?.access_token, saveTokensToDb]);

  // Poll playback state when connected
  useEffect(() => {
    if (!tokens) return;

    refreshPlaybackState();
    const interval = setInterval(refreshPlaybackState, 5000);
    return () => clearInterval(interval);
  }, [tokens, refreshPlaybackState]);

  const play = useCallback(async (uri?: string, uris?: string[]) => {
    // Get current devices to find an active one or select first available
    const deviceList = await callSpotifyApi("get_devices");
    const availableDevices = deviceList?.devices || [];
    
    // Find active device, or use first available device
    let targetDeviceId: string | undefined;
    const activeDevice = availableDevices.find((d: SpotifyDevice) => d.is_active);
    
    if (activeDevice) {
      targetDeviceId = activeDevice.id;
    } else if (availableDevices.length > 0) {
      // No active device, transfer to first available device
      targetDeviceId = availableDevices[0].id;
      toast({ 
        title: "Activating device", 
        description: `Starting playback on ${availableDevices[0].name}` 
      });
    } else {
      toast({ 
        title: "No devices available", 
        description: "Open Spotify on a device first (phone, computer, or speaker)", 
        variant: "destructive" 
      });
      return;
    }

    await callSpotifyApi("play", { uri, uris, deviceId: targetDeviceId });
    setTimeout(refreshPlaybackState, 500);
  }, [callSpotifyApi, refreshPlaybackState, toast]);

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

  const setVolume = useCallback(async (volume: number) => {
    await callSpotifyApi("volume", { volume: Math.round(volume) });
    setPlaybackState((prev) => prev ? { ...prev, volume } : null);
  }, [callSpotifyApi]);

  const fadeVolume = useCallback(async (targetVolume: number, durationMs: number) => {
    const startVolume = playbackState?.volume ?? 100;
    const steps = 20;
    const stepDuration = durationMs / steps;
    const volumeStep = (targetVolume - startVolume) / steps;

    for (let i = 1; i <= steps; i++) {
      const newVolume = Math.round(startVolume + volumeStep * i);
      await setVolume(Math.max(0, Math.min(100, newVolume)));
      await new Promise((r) => setTimeout(r, stepDuration));
    }
  }, [playbackState?.volume, setVolume]);

  const transferPlayback = useCallback(async (deviceId: string) => {
    await callSpotifyApi("transfer", { deviceId });
    setTimeout(refreshPlaybackState, 1000);
  }, [callSpotifyApi, refreshPlaybackState]);

  const loadPlaylists = useCallback(async () => {
    const data = await callSpotifyApi("get_playlists");
    setPlaylists(data?.items || []);
  }, [callSpotifyApi]);

  const loadSavedTracks = useCallback(async () => {
    const data = await callSpotifyApi("get_saved_tracks");
    setSavedTracks(data?.items?.map((i: any) => i.track) || []);
  }, [callSpotifyApi]);

  return (
    <SpotifyContext.Provider
      value={{
        isConnected: !!tokens,
        isLoading,
        tokens,
        playbackState,
        devices,
        playlists,
        savedTracks,
        connect,
        disconnect,
        play,
        pause,
        next,
        previous,
        setVolume,
        fadeVolume,
        transferPlayback,
        refreshPlaybackState,
        loadPlaylists,
        loadSavedTracks,
      }}
    >
      {children}
    </SpotifyContext.Provider>
  );
};

export const useSpotify = () => {
  const context = useContext(SpotifyContext);
  if (!context) {
    throw new Error("useSpotify must be used within a SpotifyProvider");
  }
  return context;
};
