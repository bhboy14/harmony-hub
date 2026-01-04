import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { UnifiedTrack } from "@/hooks/useUnifiedLibrary";
import { groupTracksByMaster, getCanonicalInfo, isMatchingTrack } from "@/lib/fuzzyMatch";

export interface MasterTrack {
  id: string;
  canonicalTitle: string;
  canonicalArtist: string | null;
  primaryAlbumArt: string | null;
  genre: string | null;
  decade: string | null;
  sources: UnifiedTrack[];
  createdAt: string;
}

export interface Artist {
  id: string;
  name: string;
  spotifyId: string | null;
  biography: string | null;
  bannerUrl: string | null;
  profileImage: string | null;
  genres: string[];
  popularity: number | null;
  followers: number | null;
}

export const useMasterTracks = (tracks: UnifiedTrack[]) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [masterTracks, setMasterTracks] = useState<MasterTrack[]>([]);
  const [artists, setArtists] = useState<Map<string, Artist>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);

  // Group tracks into master tracks using fuzzy matching
  const groupTracks = useCallback(async () => {
    if (!user || tracks.length === 0) {
      setMasterTracks([]);
      return;
    }

    setIsProcessing(true);
    console.log('Grouping tracks into master tracks...');

    try {
      // Use the fuzzy matching algorithm to group tracks
      const groups = groupTracksByMaster(tracks);
      
      const masters: MasterTrack[] = [];
      
      for (const [key, groupTracks] of groups) {
        const canonical = getCanonicalInfo(groupTracks);
        
        // Find the best album art (prefer Spotify, then non-null)
        const spotifyTrack = groupTracks.find(t => t.source === 'spotify');
        const albumArt = spotifyTrack?.albumArt || 
          groupTracks.find(t => t.albumArt)?.albumArt || null;
        
        masters.push({
          id: key, // Use the canonical key as ID for now
          canonicalTitle: canonical.title,
          canonicalArtist: canonical.artist,
          primaryAlbumArt: albumArt,
          genre: null,
          decade: null,
          sources: groupTracks,
          createdAt: groupTracks[0].createdAt,
        });
      }
      
      // Sort by creation date
      masters.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setMasterTracks(masters);
      console.log(`Grouped ${tracks.length} tracks into ${masters.length} master tracks`);
      
    } catch (error) {
      console.error('Failed to group tracks:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [user, tracks]);

  // Fetch artist profile from database or Spotify
  const fetchArtistProfile = useCallback(async (artistName: string): Promise<Artist | null> => {
    if (!artistName) return null;
    
    // Check cache first
    if (artists.has(artistName.toLowerCase())) {
      return artists.get(artistName.toLowerCase())!;
    }

    try {
      // Check database first
      const { data: existingArtist } = await supabase
        .from('artists')
        .select('*')
        .ilike('name', artistName)
        .single();

      if (existingArtist) {
        const artist: Artist = {
          id: existingArtist.id,
          name: existingArtist.name,
          spotifyId: existingArtist.spotify_id,
          biography: existingArtist.biography,
          bannerUrl: existingArtist.banner_url,
          profileImage: existingArtist.profile_image,
          genres: existingArtist.genres || [],
          popularity: existingArtist.popularity,
          followers: existingArtist.followers,
        };
        
        setArtists(prev => new Map(prev).set(artistName.toLowerCase(), artist));
        return artist;
      }

      // Fetch from Spotify
      const { data, error } = await supabase.functions.invoke('spotify-artist', {
        body: { action: 'search_artist', artistName }
      });

      if (error || !data?.artist) {
        console.log('Could not fetch artist from Spotify:', artistName);
        return null;
      }

      // Save to database
      const { data: savedArtist, error: saveError } = await supabase
        .from('artists')
        .upsert({
          name: data.artist.name,
          spotify_id: data.artist.spotify_id,
          biography: data.artist.biography,
          banner_url: data.artist.banner_url,
          profile_image: data.artist.profile_image,
          genres: data.artist.genres,
          popularity: data.artist.popularity,
          followers: data.artist.followers,
        }, {
          onConflict: 'name'
        })
        .select()
        .single();

      if (saveError) {
        console.error('Failed to save artist:', saveError);
      }

      const artist: Artist = {
        id: savedArtist?.id || data.artist.spotify_id,
        name: data.artist.name,
        spotifyId: data.artist.spotify_id,
        biography: data.artist.biography,
        bannerUrl: data.artist.banner_url,
        profileImage: data.artist.profile_image,
        genres: data.artist.genres || [],
        popularity: data.artist.popularity,
        followers: data.artist.followers,
      };

      setArtists(prev => new Map(prev).set(artistName.toLowerCase(), artist));
      return artist;

    } catch (error) {
      console.error('Error fetching artist:', error);
      return null;
    }
  }, [artists]);

  // Auto-fetch missing artwork for local tracks
  const fetchMissingArtwork = useCallback(async (track: UnifiedTrack): Promise<string | null> => {
    if (track.albumArt || track.source !== 'local') return track.albumArt;
    
    try {
      const { data, error } = await supabase.functions.invoke('spotify-artist', {
        body: { 
          action: 'search_artwork',
          title: track.title,
          artist: track.artist
        }
      });

      if (error || !data?.artwork) return null;
      
      // Update the track in database
      await supabase
        .from('tracks')
        .update({ album_art: data.artwork })
        .eq('id', track.id);
      
      return data.artwork;
    } catch (error) {
      console.error('Failed to fetch artwork:', error);
      return null;
    }
  }, []);

  // Get unique artists from master tracks
  const getUniqueArtists = useCallback((): string[] => {
    const artistSet = new Set<string>();
    masterTracks.forEach(mt => {
      if (mt.canonicalArtist) {
        // Handle multiple artists separated by comma
        mt.canonicalArtist.split(',').forEach(a => {
          artistSet.add(a.trim());
        });
      }
    });
    return Array.from(artistSet);
  }, [masterTracks]);

  // Filter master tracks
  const filterMasterTracks = useCallback((
    searchQuery: string,
    sourceFilter: 'all' | 'spotify' | 'youtube' | 'local' | 'soundcloud',
    genreFilter?: string,
    decadeFilter?: string
  ): MasterTrack[] => {
    return masterTracks.filter(mt => {
      // Search filter
      const matchesSearch = !searchQuery || 
        mt.canonicalTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mt.canonicalArtist?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Source filter - check if any source matches
      const matchesSource = sourceFilter === 'all' || 
        mt.sources.some(s => s.source === sourceFilter);
      
      // Genre filter (if implemented)
      const matchesGenre = !genreFilter || mt.genre === genreFilter;
      
      // Decade filter (if implemented)
      const matchesDecade = !decadeFilter || mt.decade === decadeFilter;
      
      return matchesSearch && matchesSource && matchesGenre && matchesDecade;
    });
  }, [masterTracks]);

  // Re-group when tracks change
  useEffect(() => {
    groupTracks();
  }, [groupTracks]);

  return {
    masterTracks,
    isProcessing,
    artists,
    fetchArtistProfile,
    fetchMissingArtwork,
    getUniqueArtists,
    filterMasterTracks,
    groupTracks,
  };
};
