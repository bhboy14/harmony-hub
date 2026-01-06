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
  externalId: string | null;
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
  const [isImporting, setIsImporting] = useState(false);

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

  // Create a new custom playlist
  const createPlaylist = useCallback(async (name: string, description?: string): Promise<UnifiedPlaylist | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('playlists')
        .insert({
          user_id: user.id,
          name,
          description: description || null,
          source_platform: 'local',
        })
        .select()
        .single();

      if (error) throw error;

      const newPlaylist: UnifiedPlaylist = {
        id: data.id,
        name: data.name,
        description: data.description,
        coverArt: data.cover_art,
        sourcePlatform: data.source_platform,
        externalId: data.external_id,
        trackCount: 0,
      };

      setPlaylists(prev => [newPlaylist, ...prev]);
      toast({ title: "Success", description: `Playlist "${name}" created` });
      return newPlaylist;
    } catch (error) {
      console.error('Failed to create playlist:', error);
      toast({ title: "Error", description: "Failed to create playlist", variant: "destructive" });
      return null;
    }
  }, [user, toast]);

  // Add track to playlist
  const addTrackToPlaylist = useCallback(async (playlistId: string, trackId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Get current max position
      const { data: existingTracks } = await supabase
        .from('playlist_tracks')
        .select('position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = (existingTracks?.[0]?.position ?? -1) + 1;

      const { error } = await supabase
        .from('playlist_tracks')
        .insert({
          playlist_id: playlistId,
          track_id: trackId,
          position: nextPosition,
        });

      if (error) throw error;

      // Update playlist track count locally
      setPlaylists(prev => prev.map(p => 
        p.id === playlistId 
          ? { ...p, trackCount: (p.trackCount || 0) + 1 }
          : p
      ));

      toast({ title: "Added", description: "Track added to playlist" });
      return true;
    } catch (error) {
      console.error('Failed to add track to playlist:', error);
      toast({ title: "Error", description: "Failed to add track to playlist", variant: "destructive" });
      return false;
    }
  }, [user, toast]);

  // Delete playlist
  const deletePlaylist = useCallback(async (playlistId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Delete playlist tracks first (cascade should handle this but being explicit)
      await supabase
        .from('playlist_tracks')
        .delete()
        .eq('playlist_id', playlistId);

      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId)
        .eq('user_id', user.id);

      if (error) throw error;

      setPlaylists(prev => prev.filter(p => p.id !== playlistId));
      toast({ title: "Deleted", description: "Playlist removed" });
      return true;
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      toast({ title: "Error", description: "Failed to delete playlist", variant: "destructive" });
      return false;
    }
  }, [user, toast]);

  // Import Spotify playlist with tracks
  const importSpotifyPlaylist = useCallback(async (spotifyPlaylist: {
    id: string;
    name: string;
    description?: string;
    images?: { url: string }[];
    tracks?: { items?: { track: any }[] };
    uri: string;
  }): Promise<UnifiedPlaylist | null> => {
    if (!user) return null;

    setIsImporting(true);
    try {
      // Check if playlist already imported
      const { data: existing } = await supabase
        .from('playlists')
        .select('id')
        .eq('user_id', user.id)
        .eq('external_id', spotifyPlaylist.id)
        .eq('source_platform', 'spotify')
        .maybeSingle();

      if (existing) {
        toast({ title: "Already imported", description: `"${spotifyPlaylist.name}" is already in your library` });
        setIsImporting(false);
        return null;
      }

      // Create playlist
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .insert({
          user_id: user.id,
          name: spotifyPlaylist.name,
          description: spotifyPlaylist.description || null,
          cover_art: spotifyPlaylist.images?.[0]?.url || null,
          source_platform: 'spotify',
          external_id: spotifyPlaylist.id,
        })
        .select()
        .single();

      if (playlistError) throw playlistError;

      // Import tracks if available
      const trackItems = spotifyPlaylist.tracks?.items || [];
      let importedCount = 0;

      for (let i = 0; i < trackItems.length; i++) {
        const item = trackItems[i];
        const track = item?.track;
        if (!track) continue;

        // Check if track already exists
        const { data: existingTrack } = await supabase
          .from('tracks')
          .select('id')
          .eq('user_id', user.id)
          .eq('external_id', track.uri)
          .maybeSingle();

        let trackId = existingTrack?.id;

        if (!trackId) {
          // Add track to library
          const { data: newTrack, error: trackError } = await supabase
            .from('tracks')
            .insert({
              user_id: user.id,
              title: track.name,
              artist: track.artists?.map((a: any) => a.name).join(', ') || null,
              album_art: track.album?.images?.[0]?.url || null,
              source: 'spotify',
              external_id: track.uri,
              duration_ms: track.duration_ms,
            })
            .select()
            .single();

          if (!trackError && newTrack) {
            trackId = newTrack.id;
          }
        }

        if (trackId) {
          // Add to playlist
          await supabase
            .from('playlist_tracks')
            .insert({
              playlist_id: playlistData.id,
              track_id: trackId,
              position: i,
            });
          importedCount++;
        }
      }

      const newPlaylist: UnifiedPlaylist = {
        id: playlistData.id,
        name: playlistData.name,
        description: playlistData.description,
        coverArt: playlistData.cover_art,
        sourcePlatform: playlistData.source_platform,
        externalId: playlistData.external_id,
        trackCount: importedCount,
      };

      setPlaylists(prev => [newPlaylist, ...prev]);
      await loadTracks(); // Refresh tracks list
      
      toast({ 
        title: "Playlist imported", 
        description: `"${spotifyPlaylist.name}" with ${importedCount} tracks` 
      });
      
      return newPlaylist;
    } catch (error) {
      console.error('Failed to import Spotify playlist:', error);
      toast({ title: "Error", description: "Failed to import playlist", variant: "destructive" });
      return null;
    } finally {
      setIsImporting(false);
    }
  }, [user, toast, loadTracks]);

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
      
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const picture = metadata.common.picture[0];
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

  // Upload album art to storage
  const uploadAlbumArt = useCallback(async (blobUrl: string, userId: string, trackFileName: string): Promise<string | null> => {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      
      const ext = blob.type.split('/')[1] || 'jpg';
      const fileName = `${userId}/artwork/${Date.now()}-${trackFileName.replace(/\.[^/.]+$/, "")}.${ext}`;
      
      const { data, error } = await supabase.storage
        .from('music-files')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('music-files')
        .getPublicUrl(data.path);

      URL.revokeObjectURL(blobUrl);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Failed to upload album art:', error);
      return null;
    }
  }, []);

  // Upload local file
  const uploadLocalFile = useCallback(async (file: File): Promise<UnifiedTrack | null> => {
    if (!user) return null;

    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    
    try {
      setUploadProgress(0);

      const metadata = await extractMetadata(file);

      setUploadProgress(20);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('music-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setUploadProgress(60);

      const { data: urlData } = supabase.storage
        .from('music-files')
        .getPublicUrl(uploadData.path);

      let permanentAlbumArtUrl: string | null = null;
      if (metadata.albumArt) {
        permanentAlbumArtUrl = await uploadAlbumArt(metadata.albumArt, user.id, file.name);
      }

      setUploadProgress(80);

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
            setTimeout(resolve, 5000);
          });
        } catch {
          // Couldn't get duration
        }
      }

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
      
      if (track?.source === 'local' && track.localUrl) {
        const path = track.localUrl.split('/music-files/')[1];
        if (path) {
          await supabase.storage.from('music-files').remove([path]);
        }
        if (track.albumArt && track.albumArt.includes('/music-files/')) {
          const artPath = track.albumArt.split('/music-files/')[1];
          if (artPath) {
            await supabase.storage.from('music-files').remove([artPath]);
          }
        }
      }

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

  // Import helpers
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

  // Get playlist tracks
  const getPlaylistTracks = useCallback(async (playlistId: string): Promise<UnifiedTrack[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('playlist_tracks')
        .select(`
          position,
          tracks (*)
        `)
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true });

      if (error) throw error;

      return data
        .filter((item: any) => item.tracks)
        .map((item: any) => ({
          id: item.tracks.id,
          title: item.tracks.title,
          artist: item.tracks.artist,
          albumArt: item.tracks.album_art,
          source: item.tracks.source as 'spotify' | 'youtube' | 'local' | 'soundcloud',
          externalId: item.tracks.external_id,
          localUrl: item.tracks.local_url,
          durationMs: item.tracks.duration_ms,
          createdAt: item.tracks.created_at,
        }));
    } catch (error) {
      console.error('Failed to get playlist tracks:', error);
      return [];
    }
  }, [user]);

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
    isImporting,
    uploadProgress,
    loadTracks,
    loadPlaylists,
    addTrack,
    uploadLocalFile,
    deleteTrack,
    importSpotifyTrack,
    importYouTubeTrack,
    importSoundCloudTrack,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    importSpotifyPlaylist,
    getPlaylistTracks,
  };
};
