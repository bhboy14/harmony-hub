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

  // Load tokens from localStorage on mount
  useEffect(() => {
    if (!user) {
      setTokens(null);
      setIsLoading(false);
      return;
    }

    const stored = localStorage.getItem(`soundcloud_tokens_${user.id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setTokens(parsed);
      } catch (e) {
        console.error("Failed to parse SoundCloud tokens:", e);
      }
    }
    setIsLoading(false);
  }, [user]);

  // Save tokens to localStorage
  const saveTokens = useCallback((newTokens: SoundCloudTokens) => {
    if (!user) return;
    localStorage.setItem(`soundcloud_tokens_${user.id}`, JSON.stringify(newTokens));
    setTokens(newTokens);
  }, [user]);

  // Delete tokens
  const deleteTokens = useCallback(() => {
    if (!user) return;
    localStorage.removeItem(`soundcloud_tokens_${user.id}`);
    setTokens(null);
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
        saveTokens(newTokens);
        return newTokens.accessToken;
      } catch (error) {
        console.error("Token refresh failed:", error);
        deleteTokens();
        toast({ title: "SoundCloud session expired", description: "Please reconnect.", variant: "destructive" });
        return null;
      }
    }

    return tokens.accessToken;
  }, [tokens, session?.access_token, toast, saveTokens, deleteTokens]);

  const callSoundCloudApi = useCallback(async (action: string, params: Record<string, any> = {}) => {
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
        const userData = await callSoundCloudApi("get_me");
        setScUser(userData);
      } catch (error) {
        console.error("Failed to load SoundCloud user:", error);
      }
    };

    loadUser();
  }, [tokens, callSoundCloudApi]);

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
          saveTokens(newTokens);
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
  }, [toast, saveTokens, authLoading, session?.access_token]);

  const disconnect = useCallback(async () => {
    deleteTokens();
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
  }, [toast, deleteTokens]);

  const loadPlaylists = useCallback(async () => {
    try {
      const data = await callSoundCloudApi("get_playlists");
      setPlaylists(Array.isArray(data) ? data : data?.collection || []);
    } catch (error) {
      console.error("Failed to load playlists:", error);
    }
  }, [callSoundCloudApi]);

  const loadLikedTracks = useCallback(async () => {
    try {
      const data = await callSoundCloudApi("get_likes");
      const tracks = Array.isArray(data) 
        ? data.map((item: any) => item.track || item).filter(Boolean)
        : (data?.collection || []).map((item: any) => item.track || item).filter(Boolean);
      setLikedTracks(tracks);
    } catch (error) {
      console.error("Failed to load liked tracks:", error);
    }
  }, [callSoundCloudApi]);

  const searchTracks = useCallback(async (query: string): Promise<SoundCloudTrack[]> => {
    try {
      const data = await callSoundCloudApi("search", { query });
      return Array.isArray(data) ? data : data?.collection || [];
    } catch (error) {
      console.error("Failed to search tracks:", error);
      return [];
    }
  }, [callSoundCloudApi]);

  const play = useCallback(async (track: SoundCloudTrack) => {
    try {
      setCurrentTrack(track);
      
      // Get stream URL
      const streamData = await callSoundCloudApi("get_stream_url", { trackId: track.id });
      
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
  }, [callSoundCloudApi, toast]);

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
