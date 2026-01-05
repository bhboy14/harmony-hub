import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { fetchSoundCloud, getStreamUrl } from "@/lib/soundcloud";
import { useToast } from "@/hooks/use-toast";

// Define the shape of a Track and Playlist
export interface Track {
  id: number;
  title: string;
  user: { username: string };
  artwork_url: string;
  duration: number;
  stream_url?: string;
}

export interface Playlist {
  id: number;
  title: string;
  artwork_url: string;
  tracks_count: number;
}

// Complete Context Type Definition
interface SoundCloudContextType {
  isConnected: boolean;
  isConnecting: boolean; // Renamed from isLoading to match your error if needed, or map isLoading -> isConnecting
  isLoading: boolean; // Added to satisfy error
  user: any | null; // Renamed from userProfile to user
  playlists: Playlist[];
  likedTracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  play: (track: Track) => Promise<void>;
  pause: () => void;
  resume: () => void;
  setVolume: (vol: number) => void;
  loadPlaylists: () => Promise<void>;
  loadLikedTracks: () => Promise<void>;
}

const SoundCloudContext = createContext<SoundCloudContextType | undefined>(undefined);

export const SoundCloudProvider = ({ children }: { children: React.ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);

  // Data State
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);

  // Player State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolumeState] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // Initialize Audio Element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.addEventListener("timeupdate", () => {
      if (audioRef.current) {
        setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
      }
    });
    audioRef.current.addEventListener("ended", () => setIsPlaying(false));
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  // 1. Auto-Authentication on Mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem("SC_OAUTH_TOKEN");

      if (token) {
        console.log("SoundCloudContext: Found hardcoded token, authenticating...");
        try {
          const profile = await fetchSoundCloud("/me");
          if (profile && !profile.errors) {
            setUser(profile);
            setIsConnected(true);
            // Load initial data
            await loadPlaylists();
            await loadLikedTracks();
          } else {
            console.warn("SoundCloudContext: Token invalid.");
          }
        } catch (error) {
          console.error("SoundCloudContext: Auth failed", error);
        }
      }
      setIsLoading(false);
    };
    initializeAuth();
  }, []);

  const connect = async () => {
    setIsLoading(true);
    // Fallback: Manually trigger re-auth check or login flow here
    window.location.reload();
  };

  const disconnect = async () => {
    setUser(null);
    setIsConnected(false);
    setPlaylists([]);
    setLikedTracks([]);
    toast({ title: "Disconnected from SoundCloud" });
  };

  const loadPlaylists = async () => {
    const data = await fetchSoundCloud("/me/playlists");
    if (data && Array.isArray(data)) setPlaylists(data);
  };

  const loadLikedTracks = async () => {
    const data = await fetchSoundCloud("/me/likes/tracks");
    if (data && Array.isArray(data)) setLikedTracks(data);
  };

  // --- Player Controls ---

  const play = async (track: Track) => {
    if (!audioRef.current) return;

    try {
      // If same track, just toggle
      if (currentTrack?.id === track.id) {
        resume();
        return;
      }

      console.log("Playing track:", track.title);
      setCurrentTrack(track);
      setIsPlaying(true);

      // Get authenticated stream URL
      // Note: Some tracks might not have stream_url directly; usually /tracks/:id/stream
      let streamUrl = track.stream_url;
      if (!streamUrl) {
        // Fallback construction if API didn't return it
        streamUrl = `https://api.soundcloud.com/tracks/${track.id}/stream`;
      }

      const finalUrl = await getStreamUrl(streamUrl);

      audioRef.current.src = finalUrl;
      audioRef.current.volume = volume;
      await audioRef.current.play();
    } catch (error) {
      console.error("Playback error:", error);
      toast({ title: "Playback Failed", description: "Could not stream this track.", variant: "destructive" });
      setIsPlaying(false);
    }
  };

  const pause = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const resume = () => {
    if (audioRef.current && currentTrack) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const setVolume = (vol: number) => {
    setVolumeState(vol);
    if (audioRef.current) audioRef.current.volume = vol;
  };

  return (
    <SoundCloudContext.Provider
      value={{
        isConnected,
        isConnecting: isLoading, // Map loading state
        isLoading,
        user,
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
        loadPlaylists,
        loadLikedTracks,
      }}
    >
      {children}
    </SoundCloudContext.Provider>
  );
};

export const useSoundCloud = () => {
  const context = useContext(SoundCloudContext);
  if (context === undefined) {
    throw new Error("useSoundCloud must be used within a SoundCloudProvider");
  }
  return context;
};
