import { useState, useEffect, useCallback } from "react";

export interface RecentTrack {
  id: string;
  name: string;
  artist: string;
  albumArt?: string;
  uri?: string;
  videoId?: string;
  source: 'spotify' | 'youtube' | 'local';
  playedAt: number;
}

const STORAGE_KEY = "recently_played_tracks";
const MAX_TRACKS = 20;

export const useRecentlyPlayed = () => {
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentTracks(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load recently played:", error);
    }
  }, []);

  // Save to localStorage whenever tracks change
  const saveToStorage = useCallback((tracks: RecentTrack[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
    } catch (error) {
      console.error("Failed to save recently played:", error);
    }
  }, []);

  const addTrack = useCallback((track: Omit<RecentTrack, 'playedAt'>) => {
    setRecentTracks((prev) => {
      // Remove existing entry if present
      const filtered = prev.filter((t) => t.id !== track.id);
      
      // Add new track at the beginning
      const newTrack: RecentTrack = {
        ...track,
        playedAt: Date.now(),
      };
      
      const updated = [newTrack, ...filtered].slice(0, MAX_TRACKS);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  const clearHistory = useCallback(() => {
    setRecentTracks([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    recentTracks,
    addTrack,
    clearHistory,
  };
};
