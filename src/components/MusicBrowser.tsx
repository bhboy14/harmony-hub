import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Play, Music, Loader2, TrendingUp, Youtube, HardDrive, ExternalLink, Plus } from "lucide-react";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useUnifiedLibrary } from "@/hooks/useUnifiedLibrary";
import { useToast } from "@/hooks/use-toast";
import { SourceIcon } from "@/components/SourceIcon";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

export interface Track {
  id: string;
  name: string;
  artist: string;
  albumArt?: string;
  uri?: string;
  videoId?: string;
  source: 'spotify' | 'youtube' | 'local';
}

interface MusicBrowserProps {
  onOpenFullLibrary: () => void;
  localTracks?: Track[];
}

export const MusicBrowser = ({ onOpenFullLibrary, localTracks = [] }: MusicBrowserProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [spotifyResults, setSpotifyResults] = useState<Track[]>([]);
  const [youtubeResults, setYoutubeResults] = useState<Track[]>([]);
  const [localResults, setLocalResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'spotify' | 'youtube' | 'local'>('all');
  
  const spotify = useSpotify();
  const unifiedAudio = useUnifiedAudio();
  const { importSpotifyTrack, importYouTubeTrack, tracks: libraryTracks } = useUnifiedLibrary();
  const { toast } = useToast();

  // Check if track is already in library
  const isInLibrary = (track: Track) => {
    if (track.source === 'spotify') {
      return libraryTracks.some(t => t.externalId === track.uri);
    } else if (track.source === 'youtube') {
      return libraryTracks.some(t => t.externalId === track.videoId);
    }
    return false;
  };

  const addToLibrary = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (track.source === 'spotify' && track.uri) {
      // Parse the Spotify track data
      const spotifyItem = spotifyResults.find(t => t.id === track.id);
      if (spotifyItem) {
        await importSpotifyTrack({
          id: track.id,
          name: track.name,
          artists: [{ name: track.artist }],
          album: { images: track.albumArt ? [{ url: track.albumArt }] : [] },
          uri: track.uri,
          duration_ms: 0, // We don't have this in search results
        });
      }
    } else if (track.source === 'youtube' && track.videoId) {
      await importYouTubeTrack({
        id: track.videoId,
        title: track.name,
        thumbnail: track.albumArt || '',
        channelTitle: track.artist,
      });
    }
  };

  const searchSpotify = async (query: string): Promise<Track[]> => {
    if (!spotify.isConnected || !spotify.tokens?.accessToken) return [];
    
    try {
      const response = await supabase.functions.invoke('spotify-player', {
        body: {
          action: 'search',
          accessToken: spotify.tokens.accessToken,
          query,
          type: 'track',
          limit: 5,
        },
      });

      if (response.data?.tracks?.items) {
        return response.data.tracks.items.map((item: any) => ({
          id: item.id,
          name: item.name,
          artist: item.artists.map((a: any) => a.name).join(', '),
          albumArt: item.album.images[0]?.url,
          uri: item.uri,
          source: 'spotify' as const,
        }));
      }
    } catch (error) {
      console.error('Spotify search failed:', error);
    }
    return [];
  };

  const searchYouTube = async (query: string): Promise<Track[]> => {
    try {
      const response = await supabase.functions.invoke('youtube-search', {
        body: { query, maxResults: 5 },
      });

      if (response.data?.items) {
        return response.data.items.map((item: any) => ({
          id: item.id.videoId,
          name: item.snippet.title,
          artist: item.snippet.channelTitle,
          albumArt: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
          videoId: item.id.videoId,
          source: 'youtube' as const,
        }));
      }
    } catch (error) {
      console.error('YouTube search failed:', error);
    }
    return [];
  };

  const searchLocal = (query: string): Track[] => {
    const lowerQuery = query.toLowerCase();
    return localTracks.filter(
      track => 
        track.name.toLowerCase().includes(lowerQuery) || 
        track.artist.toLowerCase().includes(lowerQuery)
    ).slice(0, 5);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSpotifyResults([]);
    setYoutubeResults([]);
    setLocalResults([]);

    try {
      // Search all sources in parallel
      const [spotifyTracks, youtubeTracks] = await Promise.all([
        searchSpotify(searchQuery),
        searchYouTube(searchQuery),
      ]);
      
      const localMatches = searchLocal(searchQuery);

      setSpotifyResults(spotifyTracks);
      setYoutubeResults(youtubeTracks);
      setLocalResults(localMatches);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const playTrack = async (track: Track) => {
    if (track.source === 'spotify' && track.uri) {
      try {
        const isContext = track.uri.includes(':playlist:') || track.uri.includes(':album:');
        if (isContext) {
          await spotify.play(track.uri);
        } else {
          // Track URI
          await spotify.play(undefined, [track.uri]);
        }
        spotify.refreshPlaybackState();
      } catch (error) {
        console.error('Failed to play Spotify track:', error);
      }
    } else if (track.source === 'youtube' && track.videoId) {
      unifiedAudio.playYouTubeVideo(track.videoId, track.name);
    } else if (track.source === 'local') {
      // Handle local track playback through unified audio
      unifiedAudio.playLocalTrack({
        id: track.id,
        title: track.name,
        artist: track.artist,
        duration: '0:00',
      });
    }
  };

  // Combine and filter results
  const allResults = [...spotifyResults, ...youtubeResults, ...localResults];
  const filteredResults = activeFilter === 'all' 
    ? allResults 
    : allResults.filter(t => t.source === activeFilter);

  const hasResults = allResults.length > 0;
  const resultCounts = {
    all: allResults.length,
    spotify: spotifyResults.length,
    youtube: youtubeResults.length,
    local: localResults.length,
  };

  // Featured tracks from Spotify playlists
  const featuredTracks: Track[] = spotify.playlists?.slice(0, 4).map((playlist: any) => ({
    id: playlist.id,
    name: playlist.name,
    artist: `${playlist.tracks?.total || 0} tracks`,
    albumArt: playlist.images?.[0]?.url,
    uri: playlist.uri,
    source: 'spotify' as const,
  })) || [];

  const getSourceBadge = (source: 'spotify' | 'youtube' | 'local') => {
    switch (source) {
      case 'spotify':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-[#1DB954]/10 text-[#1DB954] border-[#1DB954]/30">Spotify</Badge>;
      case 'youtube':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-[#FF0000]/10 text-[#FF0000] border-[#FF0000]/30">YouTube</Badge>;
      case 'local':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">Local</Badge>;
    }
  };

  return (
    <Card className="glass-panel h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Music className="h-5 w-5 text-primary" />
            Music Browser
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onOpenFullLibrary} className="text-xs gap-1">
            Full Library <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Unified Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Spotify, YouTube & Local..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching} size="icon">
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {/* Source Filter Pills */}
        {hasResults && (
          <div className="flex gap-1.5 flex-wrap">
            <Button 
              variant={activeFilter === 'all' ? "default" : "outline"} 
              size="sm" 
              className="h-7 text-xs px-2.5"
              onClick={() => setActiveFilter('all')}
            >
              All ({resultCounts.all})
            </Button>
            {resultCounts.spotify > 0 && (
              <Button 
                variant={activeFilter === 'spotify' ? "default" : "outline"} 
                size="sm" 
                className="h-7 text-xs px-2.5 gap-1"
                style={activeFilter === 'spotify' ? { backgroundColor: "#1DB954" } : {}}
                onClick={() => setActiveFilter('spotify')}
              >
                <SpotifyIcon /> {resultCounts.spotify}
              </Button>
            )}
            {resultCounts.youtube > 0 && (
              <Button 
                variant={activeFilter === 'youtube' ? "default" : "outline"} 
                size="sm" 
                className="h-7 text-xs px-2.5 gap-1"
                style={activeFilter === 'youtube' ? { backgroundColor: "#FF0000" } : {}}
                onClick={() => setActiveFilter('youtube')}
              >
                <Youtube className="h-3.5 w-3.5" /> {resultCounts.youtube}
              </Button>
            )}
            {resultCounts.local > 0 && (
              <Button 
                variant={activeFilter === 'local' ? "default" : "outline"} 
                size="sm" 
                className="h-7 text-xs px-2.5 gap-1"
                onClick={() => setActiveFilter('local')}
              >
                <HardDrive className="h-3.5 w-3.5" /> {resultCounts.local}
              </Button>
            )}
          </div>
        )}

        {/* Search Results */}
        {hasResults && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Search className="h-3 w-3" /> Search Results
            </p>
            {filteredResults.map((track) => (
              <div
                key={`${track.source}-${track.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer group transition-all"
                onClick={() => playTrack(track)}
              >
                {track.albumArt ? (
                  <img src={track.albumArt} alt="" className="w-10 h-10 rounded shadow object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                    <Music className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{track.name}</p>
                    <SourceIcon source={track.source} size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {track.source !== 'local' && !isInLibrary(track) && (
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8"
                      onClick={(e) => addToLibrary(track, e)}
                      title="Add to library"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8">
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Connection Status / Empty State */}
        {!hasResults && (
          <div className="space-y-4">
            {/* Quick Connect Buttons */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 gap-2"
                style={spotify.isConnected ? { borderColor: "#1DB954", color: "#1DB954" } : {}}
                onClick={() => !spotify.isConnected && spotify.connect()}
              >
                <SpotifyIcon />
                {spotify.isConnected ? "Connected" : "Connect Spotify"}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 gap-2"
                onClick={onOpenFullLibrary}
              >
                <HardDrive className="h-4 w-4" />
                Local Files
              </Button>
            </div>

            {/* Featured Playlists when Spotify is connected */}
            {spotify.isConnected && featuredTracks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Your Playlists
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {featuredTracks.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-all"
                      onClick={() => playTrack(item)}
                    >
                      {item.albumArt ? (
                        <img src={item.albumArt} alt="" className="w-10 h-10 rounded shadow object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                          <Music className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt to search */}
            {!spotify.isConnected && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Connect Spotify or search YouTube to find music
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
