import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// ... [Keep your existing global Window interface and SpotifyPlayerInstance/Token/Track interfaces exactly as they are] ...

interface SpotifyContextType {
  isConnected: boolean;
  isLoading: boolean;
  isPlayerReady: boolean;
  isPlayerConnecting: boolean;
  tokens: SpotifyTokens | null;
  playbackState: SpotifyPlaybackState | null;
  devices: SpotifyDevice[];
  playlists: SpotifyPlaylist[];
  savedTracks: SpotifyTrack[];
  recentlyPlayed: SpotifyRecentlyPlayedItem[];
  webPlayerReady: boolean;
  webPlayerDeviceId: string | null;
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
  loadRecentlyPlayed: () => Promise<void>;
  activateWebPlayer: () => Promise<void>;
  reinitializePlayer: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>; // Added to interface
}

const SpotifyContext = createContext<SpotifyContextType | null>(null);

const REDIRECT_URI = typeof window !== "undefined" ? `${window.location.origin}/spotify-callback` : "";

export const SpotifyProvider = ({ children }: { children: ReactNode }) => {
  const [tokens, setTokens] = useState<SpotifyTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlayerConnecting, setIsPlayerConnecting] = useState(false);
  const [playbackState, setPlaybackState] = useState<SpotifyPlaybackState | null>(null);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [savedTracks, setSavedTracks] = useState<SpotifyTrack[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<SpotifyRecentlyPlayedItem[]>([]);
  const [webPlayerReady, setWebPlayerReady] = useState(false);
  const [webPlayerDeviceId, setWebPlayerDeviceId] = useState<string | null>(null);
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const sdkLoadedRef = useRef(false);
  const autoTransferAttemptedRef = useRef(false);
  const { toast } = useToast();
  const { user, session, isLoading: authLoading } = useAuth();

  // FIX: Seek implementation inside the Provider
  const seek = useCallback(
    async (positionMs: number) => {
      try {
        const accessToken = tokens?.accessToken;
        if (!accessToken) throw new Error("Not connected to Spotify");

        const { data, error } = await supabase.functions.invoke("spotify-player", {
          body: {
            action: "seek",
            accessToken: accessToken,
            position: Math.floor(positionMs),
            deviceId: playbackState?.device?.id || webPlayerDeviceId,
          },
        });

        if (error) throw error;

        // Optimistically update progress
        setPlaybackState((prev) => (prev ? { ...prev, progress: positionMs } : null));
      } catch (err) {
        console.error("Error seeking:", err);
      }
    },
    [tokens, playbackState, webPlayerDeviceId],
  );

  // ... [Keep all your existing useEffects and callback functions: loadTokensFromDb, saveTokensToDb, ensureValidToken, callSpotifyApi, etc.] ...

  // FINAL FIX: Correct return statement listing all values explicitly
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
        transferPlayback,
        refreshPlaybackState,
        loadPlaylists,
        loadSavedTracks,
        loadRecentlyPlayed,
        activateWebPlayer,
        reinitializePlayer,
        seek, // Include the fixed seek function here
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
