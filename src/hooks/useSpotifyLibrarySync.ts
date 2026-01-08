import { useState, useCallback, useEffect, useRef } from "react";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface SyncedTrack {
  id: string;
  spotifyId: string;
  uri: string;
  title: string;
  artist: string;
  albumArt: string | null;
  durationMs: number;
  addedAt: string;
  source: 'liked' | 'playlist';
  playlistName?: string;
}

interface SyncState {
  isLoading: boolean;
  isSyncing: boolean;
  progress: number;
  totalTracks: number;
  syncedTracks: SyncedTrack[];
  error: string | null;
  lastSyncTime: number | null;
}

// Recursive fetch with pagination
async function fetchAllPaginated<T>(
  fetchFn: (accessToken: string, offset: number, limit: number) => Promise<{ items: T[]; next: string | null; total: number }>,
  accessToken: string,
  limit = 50
): Promise<T[]> {
  const allItems: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetchFn(accessToken, offset, limit);
    allItems.push(...response.items);
    hasMore = response.next !== null && response.items.length > 0;
    offset += limit;
    
    // Small delay to avoid rate limiting
    if (hasMore) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return allItems;
}

export const useSpotifyLibrarySync = () => {
  const { user } = useAuth();
  const spotify = useSpotify();
  const [state, setState] = useState<SyncState>({
    isLoading: true,
    isSyncing: false,
    progress: 0,
    totalTracks: 0,
    syncedTracks: [],
    error: null,
    lastSyncTime: null,
  });
  
  const syncInProgressRef = useRef(false);
  const hasInitialSyncRef = useRef(false);

  // Call Spotify API through our edge function
  const callSpotifyApi = useCallback(async (action: string, params: Record<string, any> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !spotify.tokens?.accessToken) {
      throw new Error("Not authenticated");
    }

    const { data, error } = await supabase.functions.invoke("spotify-player", {
      body: { action, accessToken: spotify.tokens.accessToken, ...params },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) throw error;
    return data;
  }, [spotify.tokens?.accessToken]);

  // Fetch liked songs with pagination
  const fetchLikedSongs = useCallback(async (): Promise<SyncedTrack[]> => {
    const allTracks: SyncedTrack[] = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || !spotify.tokens?.accessToken) break;

        // Direct API call with offset
        const response = await fetch(
          `https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}`,
          {
            headers: { Authorization: `Bearer ${spotify.tokens.accessToken}` },
          }
        );

        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After') || '5';
            await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
            continue;
          }
          throw new Error(`Spotify API error: ${response.status}`);
        }

        const data = await response.json();
        
        for (const item of data.items || []) {
          const track = item.track;
          if (!track) continue;
          
          allTracks.push({
            id: track.id,
            spotifyId: track.id,
            uri: track.uri,
            title: track.name,
            artist: track.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
            albumArt: track.album?.images?.[0]?.url || null,
            durationMs: track.duration_ms,
            addedAt: item.added_at,
            source: 'liked',
          });
        }

        hasMore = data.next !== null;
        offset += limit;

        // Update progress
        setState(prev => ({
          ...prev,
          progress: allTracks.length,
          totalTracks: data.total || allTracks.length,
        }));

        // Rate limit protection
        if (hasMore) {
          await new Promise(r => setTimeout(r, 100));
        }
      } catch (err) {
        console.error('Error fetching liked songs:', err);
        break;
      }
    }

    return allTracks;
  }, [spotify.tokens?.accessToken]);

  // Fetch all playlists
  const fetchPlaylists = useCallback(async (): Promise<any[]> => {
    const allPlaylists: any[] = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await fetch(
          `https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`,
          {
            headers: { Authorization: `Bearer ${spotify.tokens?.accessToken}` },
          }
        );

        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After') || '5';
            await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
            continue;
          }
          break;
        }

        const data = await response.json();
        allPlaylists.push(...(data.items || []));
        hasMore = data.next !== null;
        offset += limit;

        if (hasMore) await new Promise(r => setTimeout(r, 100));
      } catch {
        break;
      }
    }

    return allPlaylists;
  }, [spotify.tokens?.accessToken]);

  // Fetch all tracks from a playlist
  const fetchPlaylistTracks = useCallback(async (playlistId: string, playlistName: string): Promise<SyncedTrack[]> => {
    const allTracks: SyncedTrack[] = [];
    let offset = 0;
    const limit = 100; // Playlists allow up to 100 items per request
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await fetch(
          `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(added_at,track(id,uri,name,duration_ms,artists(name),album(images))),next,total`,
          {
            headers: { Authorization: `Bearer ${spotify.tokens?.accessToken}` },
          }
        );

        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After') || '5';
            await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
            continue;
          }
          break;
        }

        const data = await response.json();

        for (const item of data.items || []) {
          const track = item.track;
          if (!track || !track.id) continue; // Skip local files or null tracks

          allTracks.push({
            id: track.id,
            spotifyId: track.id,
            uri: track.uri,
            title: track.name,
            artist: track.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
            albumArt: track.album?.images?.[0]?.url || null,
            durationMs: track.duration_ms,
            addedAt: item.added_at,
            source: 'playlist',
            playlistName,
          });
        }

        hasMore = data.next !== null;
        offset += limit;

        if (hasMore) await new Promise(r => setTimeout(r, 50));
      } catch {
        break;
      }
    }

    return allTracks;
  }, [spotify.tokens?.accessToken]);

  // Main sync function
  const syncLibrary = useCallback(async (force = false) => {
    if (!spotify.isConnected || !spotify.tokens?.accessToken) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    if (syncInProgressRef.current) return;

    // Check cache (5 min TTL)
    const cached = localStorage.getItem('spotify_library_cache');
    if (cached && !force) {
      try {
        const { tracks, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < 5 * 60 * 1000) { // 5 minutes
          setState(prev => ({
            ...prev,
            isLoading: false,
            syncedTracks: tracks,
            lastSyncTime: timestamp,
          }));
          return;
        }
      } catch {}
    }

    syncInProgressRef.current = true;
    setState(prev => ({ ...prev, isSyncing: true, progress: 0, error: null }));

    try {
      // Step 1: Fetch all liked songs
      console.log('[LibrarySync] Fetching liked songs...');
      const likedSongs = await fetchLikedSongs();
      console.log(`[LibrarySync] Fetched ${likedSongs.length} liked songs`);

      // Step 2: Fetch all playlists
      console.log('[LibrarySync] Fetching playlists...');
      const playlists = await fetchPlaylists();
      console.log(`[LibrarySync] Found ${playlists.length} playlists`);

      // Step 3: Fetch tracks from each playlist
      const playlistTracks: SyncedTrack[] = [];
      for (let i = 0; i < playlists.length; i++) {
        const playlist = playlists[i];
        if (!playlist?.id) continue;

        console.log(`[LibrarySync] Fetching playlist ${i + 1}/${playlists.length}: ${playlist.name}`);
        const tracks = await fetchPlaylistTracks(playlist.id, playlist.name);
        playlistTracks.push(...tracks);

        setState(prev => ({
          ...prev,
          progress: likedSongs.length + playlistTracks.length,
        }));
      }

      // Step 4: Deduplicate by Spotify track ID
      const trackMap = new Map<string, SyncedTrack>();
      
      // Liked songs take priority
      for (const track of likedSongs) {
        trackMap.set(track.spotifyId, track);
      }
      
      // Then playlist tracks (won't overwrite liked songs)
      for (const track of playlistTracks) {
        if (!trackMap.has(track.spotifyId)) {
          trackMap.set(track.spotifyId, track);
        }
      }

      const allTracks = Array.from(trackMap.values());
      console.log(`[LibrarySync] Total unique tracks: ${allTracks.length}`);

      // Cache the result
      const cacheData = {
        tracks: allTracks,
        timestamp: Date.now(),
      };
      localStorage.setItem('spotify_library_cache', JSON.stringify(cacheData));

      setState({
        isLoading: false,
        isSyncing: false,
        progress: allTracks.length,
        totalTracks: allTracks.length,
        syncedTracks: allTracks,
        error: null,
        lastSyncTime: Date.now(),
      });
    } catch (err: any) {
      console.error('[LibrarySync] Sync failed:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        isSyncing: false,
        error: err.message || 'Sync failed',
      }));
    } finally {
      syncInProgressRef.current = false;
    }
  }, [spotify.isConnected, spotify.tokens?.accessToken, fetchLikedSongs, fetchPlaylists, fetchPlaylistTracks]);

  // Auto-sync on mount when Spotify is connected
  useEffect(() => {
    if (spotify.isConnected && spotify.tokens?.accessToken && !hasInitialSyncRef.current) {
      hasInitialSyncRef.current = true;
      syncLibrary();
    }
  }, [spotify.isConnected, spotify.tokens?.accessToken, syncLibrary]);

  // Force resync function
  const resync = useCallback(() => {
    localStorage.removeItem('spotify_library_cache');
    hasInitialSyncRef.current = false;
    syncLibrary(true);
  }, [syncLibrary]);

  return {
    ...state,
    syncLibrary,
    resync,
    spotifyConnected: spotify.isConnected,
  };
};
