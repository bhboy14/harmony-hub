import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import * as musicMetadata from "music-metadata-browser";

export interface UnifiedTrack {
  id: string;
  title: string;
  artist: string | null;
  albumArt: string | null;
  source: 'spotify' | 'youtube' | 'local' | 'soundcloud';
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
        source: t.source as 'spotify' | 'youtube' | 'local' | 'soundcloud',
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
        source: data.source as 'spotify' | 'youtube' | 'local' | 'soundcloud',
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

  // Extract metadata from audio file
  const extractMetadata = useCallback(async (file: File): Promise<{
    title: string;
    artist: string | null;
    albumArt: string | null;
    durationMs: number | null;
  }> => {
    try {
      const metadata = await musicMetadata.parseBlob(file);
      
      let albumArtUrl: string | null = null;
      
      // Extract album art if present
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const picture = metadata.common.picture[0];
        // Convert Buffer to Uint8Array for Blob compatibility
        const uint8Array = new Uint8Array(picture.data);
        const blob = new Blob([uint8Array], { type: picture.format });
        albumArtUrl = URL.createObjectURL(blob);
      }

      const durationMs = metadata.format.duration 
        ? Math.round(metadata.format.duration * 1000) 
        : null;

      return {
        title: metadata.common.title || file.name.replace(/\.[^/.]+$/, ""),
        artist: metadata.common.artist || metadata.common.albumartist || null,
        albumArt: albumArtUrl,
        durationMs,
      };
    } catch (error) {
      console.error('Failed to extract metadata:', error);
      // Fallback to filename parsing
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const parts = nameWithoutExt.split(' - ');
      return {
        title: parts.length > 1 ? parts[1].trim() : nameWithoutExt,
        artist: parts.length > 1 ? parts[0].trim() : null,
        albumArt: null,
        durationMs: null,
      };
    }
  }, []);

  // Upload album art to storage and get URL
  const uploadAlbumArt = useCallback(async (blobUrl: string, userId: string, trackFileName: string): Promise<string | null> => {
    try {
      // Fetch the blob from the object URL
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      
      // Generate filename
      const ext = blob.type.split('/')[1] || 'jpg';
      const fileName = `${userId}/artwork/${Date.now()}-${trackFileName.replace(/\.[^/.]+$/, "")}.${ext}`;
      
      // Upload to storage
      const { data, error } = await supabase.storage
        .from('music-files')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('music-files')
        .getPublicUrl(data.path);

      // Revoke the temporary blob URL
      URL.revokeObjectURL(blobUrl);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Failed to upload album art:', error);
      return null;
    }
  }, []);

  // Upload local file to Supabase storage with metadata extraction
  const uploadLocalFile = useCallback(async (file: File): Promise<UnifiedTrack | null> => {
    if (!user) return null;

    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    
    try {
      setUploadProgress(0);

      // Extract metadata first
      console.log('Extracting metadata from:', file.name);
      const metadata = await extractMetadata(file);
      console.log('Extracted metadata:', metadata);

      setUploadProgress(20);

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('music-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setUploadProgress(60);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('music-files')
        .getPublicUrl(uploadData.path);

      // Upload album art if extracted
      let permanentAlbumArtUrl: string | null = null;
      if (metadata.albumArt) {
        permanentAlbumArtUrl = await uploadAlbumArt(metadata.albumArt, user.id, file.name);
      }

      setUploadProgress(80);

      // If we couldn't get duration from metadata, try with audio element
      let durationMs = metadata.durationMs;
      if (!durationMs) {
        const audio = new Audio(urlData.publicUrl);
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
      }

      // Add track to database
      const track = await addTrack({
        title: metadata.title,
        artist: metadata.artist,
        albumArt: permanentAlbumArtUrl,
        source: 'local',
        externalId: null,
        localUrl: urlData.publicUrl,
        durationMs,
      });

      setUploadProgress(null);
      toast({ title: "Success", description: `Added "${metadata.title}" to your library` });
      return track;
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadProgress(null);
      toast({ title: "Upload failed", description: "Could not upload file", variant: "destructive" });
      return null;
    }
  }, [user, addTrack, toast, extractMetadata, uploadAlbumArt]);

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
        // Also delete album art if it exists
        if (track.albumArt && track.albumArt.includes('/music-files/')) {
          const artPath = track.albumArt.split('/music-files/')[1];
          if (artPath) {
            await supabase.storage.from('music-files').remove([artPath]);
          }
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

  // Import SoundCloud track to unified library
  const importSoundCloudTrack = useCallback(async (scTrack: {
    id: number;
    title: string;
    user: { username: string };
    artwork_url: string | null;
    duration: number;
  }) => {
    return addTrack({
      title: scTrack.title,
      artist: scTrack.user.username,
      albumArt: scTrack.artwork_url,
      source: 'soundcloud',
      externalId: String(scTrack.id),
      localUrl: null,
      durationMs: scTrack.duration,
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
    importSoundCloudTrack,
  };
};
