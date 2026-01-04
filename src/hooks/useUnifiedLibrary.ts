import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface UnifiedTrack {
  id: string;
  title: string;
  artist: string | null;
  albumArt: string | null;
  source: 'spotify' | 'youtube' | 'local';
  externalId: string | null; // Spotify URI or YouTube Video ID
  localUrl: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface UnifiedPlaylist {
  id: string;
  name: string;
  description: string | null;
  coverArt: string | null;
  sourcePlatform: string | null;
  externalId: string | null;
  trackCount?: number;
}

export const useUnifiedLibrary = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [playlists, setPlaylists] = useState<UnifiedPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Load tracks from database
  const loadTracks = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTracks(data.map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        albumArt: t.album_art,
        source: t.source as 'spotify' | 'youtube' | 'local',
        externalId: t.external_id,
        localUrl: t.local_url,
        durationMs: t.duration_ms,
        createdAt: t.created_at,
      })));
    } catch (error) {
      console.error('Failed to load tracks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load playlists from database
  const loadPlaylists = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('*, playlist_tracks(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPlaylists(data.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        coverArt: p.cover_art,
        sourcePlatform: p.source_platform,
        externalId: p.external_id,
        trackCount: p.playlist_tracks?.[0]?.count || 0,
      })));
    } catch (error) {
      console.error('Failed to load playlists:', error);
    }
  }, [user]);

  // Add track to library
  const addTrack = useCallback(async (track: Omit<UnifiedTrack, 'id' | 'createdAt'>) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('tracks')
        .insert({
          user_id: user.id,
          title: track.title,
          artist: track.artist,
          album_art: track.albumArt,
          source: track.source,
          external_id: track.externalId,
          local_url: track.localUrl,
          duration_ms: track.durationMs,
        })
        .select()
        .single();

      if (error) throw error;

      const newTrack: UnifiedTrack = {
        id: data.id,
        title: data.title,
        artist: data.artist,
        albumArt: data.album_art,
        source: data.source as 'spotify' | 'youtube' | 'local',
        externalId: data.external_id,
        localUrl: data.local_url,
        durationMs: data.duration_ms,
        createdAt: data.created_at,
      };

      setTracks(prev => [newTrack, ...prev]);
      return newTrack;
    } catch (error) {
      console.error('Failed to add track:', error);
      toast({ title: "Error", description: "Failed to add track", variant: "destructive" });
      return null;
    }
  }, [user, toast]);

  // Upload local file to Supabase storage
  const uploadLocalFile = useCallback(async (file: File): Promise<UnifiedTrack | null> => {
    if (!user) return null;

    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    
    try {
      setUploadProgress(0);

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('music-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('music-files')
        .getPublicUrl(uploadData.path);

      // Extract metadata from filename (basic parsing)
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const parts = nameWithoutExt.split(' - ');
      const artist = parts.length > 1 ? parts[0].trim() : null;
      const title = parts.length > 1 ? parts[1].trim() : nameWithoutExt;

      // Create audio element to get duration
      const audio = new Audio(urlData.publicUrl);
      let durationMs: number | null = null;
      
      try {
        await new Promise<void>((resolve, reject) => {
          audio.addEventListener('loadedmetadata', () => {
            durationMs = Math.round(audio.duration * 1000);
            resolve();
          });
          audio.addEventListener('error', reject);
          setTimeout(resolve, 5000); // Timeout after 5s
        });
      } catch {
        // Couldn't get duration, that's ok
      }

      // Add track to database
      const track = await addTrack({
        title,
        artist,
        albumArt: null,
        source: 'local',
        externalId: null,
        localUrl: urlData.publicUrl,
        durationMs,
      });

      setUploadProgress(null);
      toast({ title: "Success", description: `Added "${title}" to your library` });
      return track;
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadProgress(null);
      toast({ title: "Upload failed", description: "Could not upload file", variant: "destructive" });
      return null;
    }
  }, [user, addTrack, toast]);

  // Delete track
  const deleteTrack = useCallback(async (trackId: string) => {
    if (!user) return false;

    try {
      const track = tracks.find(t => t.id === trackId);
      
      // Delete from storage if local
      if (track?.source === 'local' && track.localUrl) {
        const path = track.localUrl.split('/music-files/')[1];
        if (path) {
          await supabase.storage.from('music-files').remove([path]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('tracks')
        .delete()
        .eq('id', trackId)
        .eq('user_id', user.id);

      if (error) throw error;

      setTracks(prev => prev.filter(t => t.id !== trackId));
      toast({ title: "Deleted", description: "Track removed from library" });
      return true;
    } catch (error) {
      console.error('Delete failed:', error);
      toast({ title: "Error", description: "Failed to delete track", variant: "destructive" });
      return false;
    }
  }, [user, tracks, toast]);

  // Import Spotify tracks to unified library
  const importSpotifyTrack = useCallback(async (spotifyTrack: {
    id: string;
    name: string;
    artists: { name: string }[];
    album?: { images?: { url: string }[] };
    uri: string;
    duration_ms: number;
  }) => {
    return addTrack({
      title: spotifyTrack.name,
      artist: spotifyTrack.artists.map(a => a.name).join(', '),
      albumArt: spotifyTrack.album?.images?.[0]?.url || null,
      source: 'spotify',
      externalId: spotifyTrack.uri,
      localUrl: null,
      durationMs: spotifyTrack.duration_ms,
    });
  }, [addTrack]);

  // Import YouTube video to unified library
  const importYouTubeTrack = useCallback(async (video: {
    id: string;
    title: string;
    thumbnail: string;
    channelTitle?: string;
    duration?: number;
  }) => {
    return addTrack({
      title: video.title,
      artist: video.channelTitle || null,
      albumArt: video.thumbnail,
      source: 'youtube',
      externalId: video.id,
      localUrl: null,
      durationMs: video.duration ? video.duration * 1000 : null,
    });
  }, [addTrack]);

  // Load data on mount
  useEffect(() => {
    if (user) {
      loadTracks();
      loadPlaylists();
    }
  }, [user, loadTracks, loadPlaylists]);

  return {
    tracks,
    playlists,
    isLoading,
    uploadProgress,
    loadTracks,
    loadPlaylists,
    addTrack,
    uploadLocalFile,
    deleteTrack,
    importSpotifyTrack,
    importYouTubeTrack,
  };
};
