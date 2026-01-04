import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface SoundCloudTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface SoundCloudUser {
  id: number;
  username: string;
  avatar_url: string;
  full_name: string;
}

interface SoundCloudTrack {
  id: number;
  title: string;
  user: { username: string };
  artwork_url: string | null;
  duration: number;
  stream_url?: string;
  permalink_url: string;
}

interface SoundCloudPlaylist {
  id: number;
  title: string;
  artwork_url: string | null;
  track_count: number;
  user: { username: string };
  tracks?: SoundCloudTrack[];
}

interface SoundCloudContextType {
  isConnected: boolean;
  isLoading: boolean;
  tokens: SoundCloudTokens | null;
  user: SoundCloudUser | null;
  playlists: SoundCloudPlaylist[];
  likedTracks: SoundCloudTrack[];
  currentTrack: SoundCloudTrack | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  play: (track: SoundCloudTrack) => Promise<void>;
  pause: () => void;
  resume: () => void;
  setVolume: (volume: number) => void;
  seek: (position: number) => void;
  loadPlaylists: () => Promise<void>;
  loadLikedTracks: () => Promise<void>;
  searchTracks: (query: string) => Promise<SoundCloudTrack[]>;
}

const SoundCloudContext = createContext<SoundCloudContextType | null>(null);

const REDIRECT_URI = typeof window !== "undefined" ? `${window.location.origin}/soundcloud-callback` : "";

export const SoundCloudProvider = ({ children }: { children: ReactNode }) => {
  const [tokens, setTokens] = useState<SoundCloudTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scUser, setScUser] = useState<SoundCloudUser | null>(null);
  const [playlists, setPlaylists] = useState<SoundCloudPlaylist[]>([]);
  const [likedTracks, setLikedTracks] = useState<SoundCloudTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<SoundCloudTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolumeState] = useState(100);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const { user, session, isLoading: authLoading } = useAuth();

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume / 100;
    }

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [volume]);

  // Load tokens from database on mount
  useEffect(() => {
    const loadTokensFromDb = async () => {
      if (!user) {
        setTokens(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_api_tokens')
          .select('*')
          .eq('user_id', user.id)
          .eq('provider', 'soundcloud')
          .maybeSingle();

        if (error) {
          console.error('Error loading SoundCloud tokens:', error);
        } else if (data) {
          setTokens({
            accessToken: data.access_token,
            refreshToken: data.refresh_token || '',
            expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : 0,
          });
        }
      } catch (err) {
        console.error('Failed to load SoundCloud tokens:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTokensFromDb();
  }, [user]);

  // Save tokens to database
  const saveTokensToDb = useCallback(async (newTokens: SoundCloudTokens) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_api_tokens')
        .upsert({
          user_id: user.id,
          provider: 'soundcloud',
          access_token: newTokens.accessToken,
          refresh_token: newTokens.refreshToken || null,
          expires_at: newTokens.expiresAt ? new Date(newTokens.expiresAt).toISOString() : null,
        }, { onConflict: 'user_id,provider' });

      if (error) {
        console.error('Error saving SoundCloud tokens:', error);
      }
    } catch (err) {
      console.error('Failed to save SoundCloud tokens:', err);
    }
  }, [user]);

  // Delete tokens from database
  const deleteTokensFromDb = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_api_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', 'soundcloud');

      if (error) {
        console.error('Error deleting SoundCloud tokens:', error);
      }
    } catch (err) {
      console.error('Failed to delete SoundCloud tokens:', err);
    }
  }, [user]);

  // Ensure valid token
  const ensureValidToken = useCallback(async (): Promise<string | null> => {
    if (!tokens) return null;

    // SoundCloud tokens don't expire if scope is "non-expiring"
    // But check if we need to refresh anyway
    if (tokens.expiresAt && Date.now() > tokens.expiresAt - 60000) {
      console.log("Refreshing SoundCloud token...");
      try {
        if (!session?.access_token) throw new Error("Missing session");

        const { data, error } = await supabase.functions.invoke("soundcloud-auth", {
          body: { action: "refresh", refreshToken: tokens.refreshToken },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (error) throw error;

        const newTokens: SoundCloudTokens = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || tokens.refreshToken,
          expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : 0,
        };
        setTokens(newTokens);
        await saveTokensToDb(newTokens);
        return newTokens.accessToken;
      } catch (error) {
        console.error("Token refresh failed:", error);
        setTokens(null);
        await deleteTokensFromDb();
        toast({ title: "SoundCloud session expired", description: "Please reconnect.", variant: "destructive" });
        return null;
      }
    }

    return tokens.accessToken;
  }, [tokens, session?.access_token, toast, saveTokensToDb, deleteTokensFromDb]);

  // Call SoundCloud API via Edge Function proxy (token never touches client)
  const callSoundCloudApi = useCallback(async (action: string, params: Record<string, any> = {}) => {
    if (!session?.access_token) throw new Error("Not authenticated");

    // For actions that don't require the access token in request (proxy handles it)
    const { data, error } = await supabase.functions.invoke("soundcloud-proxy", {
      body: { action, ...params },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, [session?.access_token]);

  // Legacy API call for backward compatibility during transition
  const callSoundCloudApiLegacy = useCallback(async (action: string, params: Record<string, any> = {}) => {
    const accessToken = await ensureValidToken();
    if (!accessToken) throw new Error("Not connected to SoundCloud");

    const { data, error } = await supabase.functions.invoke("soundcloud-player", {
      body: { action, accessToken, ...params },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, [ensureValidToken, session?.access_token]);

  // Load user data when connected
  useEffect(() => {
    if (!tokens) {
      setScUser(null);
      return;
    }

    const loadUser = async () => {
      try {
        const userData = await callSoundCloudApiLegacy("get_me");
        setScUser(userData);
      } catch (error) {
        console.error("Failed to load SoundCloud user:", error);
      }
    };

    loadUser();
  }, [tokens, callSoundCloudApiLegacy]);

  const connect = useCallback(async () => {
    setIsLoading(true);
    try {
      if (authLoading || !session?.access_token) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("soundcloud-auth", {
        body: { action: "get_auth_url", redirectUri: REDIRECT_URI },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      // Open SoundCloud auth in a popup
      const width = 450;
      const height = 730;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      window.open(
        data.authUrl,
        "SoundCloud Login",
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (error) {
      console.error("SoundCloud connect error:", error);
      toast({ title: "Failed to connect", description: "Could not initiate SoundCloud login.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, authLoading, session?.access_token]);

  // Handle callback from popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Validate origin matches our application to prevent malicious postMessage attacks
      if (event.origin !== window.location.origin) {
        console.warn('Rejected postMessage from untrusted origin:', event.origin);
        return;
      }
      
      if (event.data?.type === "soundcloud-callback" && event.data.code) {
        setIsLoading(true);
        try {
          if (authLoading || !session?.access_token) {
            throw new Error("Not authenticated");
          }

          const { data, error } = await supabase.functions.invoke("soundcloud-auth", {
            body: { action: "exchange", code: event.data.code, redirectUri: REDIRECT_URI },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });

          if (error) throw error;

          const newTokens: SoundCloudTokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || "",
            expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : 0,
          };
          setTokens(newTokens);
          await saveTokensToDb(newTokens);
          toast({ title: "Connected to SoundCloud", description: "Your SoundCloud account is now linked." });
        } catch (error) {
          console.error("Token exchange error:", error);
          toast({ title: "Connection failed", description: "Could not complete SoundCloud login.", variant: "destructive" });
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
    setScUser(null);
    setPlaylists([]);
    setLikedTracks([]);
    setCurrentTrack(null);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    toast({ title: "Disconnected", description: "SoundCloud account unlinked." });
  }, [toast, deleteTokensFromDb]);

  const loadPlaylists = useCallback(async () => {
    try {
      const data = await callSoundCloudApiLegacy("get_playlists");
      setPlaylists(Array.isArray(data) ? data : data?.collection || []);
    } catch (error) {
      console.error("Failed to load playlists:", error);
    }
  }, [callSoundCloudApiLegacy]);

  const loadLikedTracks = useCallback(async () => {
    try {
      const data = await callSoundCloudApiLegacy("get_likes");
      const tracks = Array.isArray(data) 
        ? data.map((item: any) => item.track || item).filter(Boolean)
        : (data?.collection || []).map((item: any) => item.track || item).filter(Boolean);
      setLikedTracks(tracks);
    } catch (error) {
      console.error("Failed to load liked tracks:", error);
    }
  }, [callSoundCloudApiLegacy]);

  const searchTracks = useCallback(async (query: string): Promise<SoundCloudTrack[]> => {
    try {
      const data = await callSoundCloudApiLegacy("search", { query });
      return Array.isArray(data) ? data : data?.collection || [];
    } catch (error) {
      console.error("Failed to search tracks:", error);
      return [];
    }
  }, [callSoundCloudApiLegacy]);

  const play = useCallback(async (track: SoundCloudTrack) => {
    try {
      setCurrentTrack(track);
      
      // Get stream URL via proxy
      const streamData = await callSoundCloudApiLegacy("get_stream_url", { trackId: track.id });
      
      if (streamData?.stream_url && audioRef.current) {
        audioRef.current.src = streamData.stream_url;
        audioRef.current.play();
        setIsPlaying(true);
      } else {
        throw new Error("Could not get stream URL");
      }
    } catch (error) {
      console.error("Failed to play track:", error);
      toast({ title: "Playback failed", description: "Could not play this track.", variant: "destructive" });
    }
  }, [callSoundCloudApiLegacy, toast]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol / 100;
    }
  }, []);

  const seek = useCallback((position: number) => {
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = (position / 100) * audioRef.current.duration;
    }
  }, []);

  return (
    <SoundCloudContext.Provider
      value={{
        isConnected: !!tokens,
        isLoading,
        tokens,
        user: scUser,
        playlists,
        likedTracks,
        currentTrack,
        isPlaying,
        progress,
        volume,
        connect,
        disconnect,
        play,
        pause,
        resume,
        setVolume,
        seek,
        loadPlaylists,
        loadLikedTracks,
        searchTracks,
      }}
    >
      {children}
    </SoundCloudContext.Provider>
  );
};

export const useSoundCloud = () => {
  const context = useContext(SoundCloudContext);
  if (!context) {
    throw new Error("useSoundCloud must be used within a SoundCloudProvider");
  }
  return context;
};
