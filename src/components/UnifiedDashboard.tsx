import { useState, useCallback } from "react";
import { Search, Loader2, Youtube, HardDrive, Play, Plus, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { useUnifiedLibrary } from "@/hooks/useUnifiedLibrary";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SpotifyView } from "@/components/dashboard/SpotifyView";
import { YouTubeView } from "@/components/dashboard/YouTubeView";
import { LocalView } from "@/components/dashboard/LocalView";
import { AllLibraryView } from "@/components/dashboard/AllLibraryView";
import { SourceIcon } from "@/components/SourceIcon";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

interface SearchResult {
  id: string;
  name: string;
  artist: string;
  albumArt?: string;
  uri?: string;
  videoId?: string;
  source: 'spotify' | 'youtube' | 'local';
}

interface UnifiedDashboardProps {
  localFolderTracks?: any[];
}

export const UnifiedDashboard = ({ localFolderTracks = [] }: UnifiedDashboardProps) => {
  const spotify = useSpotify();
  const unifiedAudio = useUnifiedAudio();
  const { importSpotifyTrack, importYouTubeTrack, tracks: libraryTracks } = useUnifiedLibrary();
  const { toast } = useToast();
  
  const [activeView, setActiveView] = useState<"all" | "spotify" | "youtube" | "local">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const searchSpotify = useCallback(async (query: string): Promise<SearchResult[]> => {
    if (!spotify.isConnected || !spotify.tokens?.accessToken) return [];
    
    try {
      const response = await supabase.functions.invoke('spotify-player', {
        body: {
          action: 'search',
          accessToken: spotify.tokens.accessToken,
          query,
          type: 'track',
          limit: 8,
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
  }, [spotify.isConnected, spotify.tokens?.accessToken]);

  const searchYouTube = useCallback(async (query: string): Promise<SearchResult[]> => {
    try {
      const response = await supabase.functions.invoke('youtube-search', {
        body: { query, maxResults: 8 },
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
  }, []);

  const searchLocal = useCallback((query: string): SearchResult[] => {
    const lowerQuery = query.toLowerCase();
    return localFolderTracks
      .filter(track => 
        track.name?.toLowerCase().includes(lowerQuery) || 
        track.artist?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5)
      .map(track => ({
        ...track,
        source: 'local' as const,
      }));
  }, [localFolderTracks]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    
    setIsSearching(true);
    setShowResults(true);

    try {
      const [spotifyTracks, youtubeTracks] = await Promise.all([
        searchSpotify(searchQuery),
        searchYouTube(searchQuery),
      ]);
      
      const localMatches = searchLocal(searchQuery);
      const results = [...spotifyTracks, ...youtubeTracks, ...localMatches];
      setSearchResults(results);
      // Avoid leaving an invisible full-screen click-catcher active when there are no results.
      setShowResults(results.length > 0);
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: "Search failed",
        description: "There was an error searching. Please try again.",
        variant: "destructive",
      });
      setShowResults(false);
    } finally {
      setIsSearching(false);
    }
  };

  const playTrack = async (track: SearchResult) => {
    if (track.source === 'spotify' && track.uri) {
      try {
        const isContext = track.uri.includes(':playlist:') || track.uri.includes(':album:');
        if (isContext) {
          await spotify.play(track.uri);
        } else {
          await spotify.play(undefined, [track.uri]);
        }
        spotify.refreshPlaybackState();
      } catch (error) {
        console.error('Failed to play Spotify track:', error);
      }
    } else if (track.source === 'youtube' && track.videoId) {
      unifiedAudio.playYouTubeVideo(track.videoId, track.name);
    } else if (track.source === 'local') {
      unifiedAudio.playLocalTrack({
        id: track.id,
        title: track.name,
        artist: track.artist,
        duration: '0:00',
      });
    }
    setShowResults(false);
    setSearchQuery("");
  };

  const addToLibrary = async (track: SearchResult, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (track.source === 'spotify' && track.uri) {
      await importSpotifyTrack({
        id: track.id,
        name: track.name,
        artists: [{ name: track.artist }],
        album: { images: track.albumArt ? [{ url: track.albumArt }] : [] },
        uri: track.uri,
        duration_ms: 0,
      });
      toast({ title: "Added to library", description: track.name });
    } else if (track.source === 'youtube' && track.videoId) {
      await importYouTubeTrack({
        id: track.videoId,
        title: track.name,
        thumbnail: track.albumArt || '',
        channelTitle: track.artist,
      });
      toast({ title: "Added to library", description: track.name });
    }
  };

  const isInLibrary = (track: SearchResult) => {
    if (track.source === 'spotify') {
      return libraryTracks.some(t => t.externalId === track.uri);
    } else if (track.source === 'youtube') {
      return libraryTracks.some(t => t.externalId === track.videoId);
    }
    return false;
  };

  const filters = [
    { key: 'all', label: 'All', icon: null, activeClass: 'bg-primary text-primary-foreground' },
    { key: 'spotify', label: 'Spotify', icon: <SpotifyIcon />, activeClass: 'bg-[#1DB954] text-black' },
    { key: 'youtube', label: 'YouTube', icon: <Youtube className="h-4 w-4" />, activeClass: 'bg-red-500 text-white' },
    { key: 'local', label: 'Local', icon: <HardDrive className="h-4 w-4" />, activeClass: 'bg-amber-500 text-black' },
  ];

  const resultCounts = {
    all: searchResults.length,
    spotify: searchResults.filter(r => r.source === 'spotify').length,
    youtube: searchResults.filter(r => r.source === 'youtube').length,
    local: searchResults.filter(r => r.source === 'local').length,
  };

  const filteredResults = activeView === 'all' 
    ? searchResults 
    : searchResults.filter(r => r.source === activeView);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
      {/* Search Bar - Always visible */}
      <div className="mb-4 relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Spotify, YouTube & Local files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              className="pl-10 h-12 text-base bg-secondary/50 border-border/50"
            />
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={isSearching} 
            size="lg"
            className="h-12 px-6"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-xl z-50 max-h-[60vh] overflow-y-auto">
            <div className="p-3 border-b border-border/50 flex flex-wrap gap-1.5">
              {resultCounts.spotify > 0 && (
                <Badge variant="outline" className="text-xs bg-[#1DB954]/10 text-[#1DB954] border-[#1DB954]/30">
                  <SpotifyIcon /> <span className="ml-1">{resultCounts.spotify}</span>
                </Badge>
              )}
              {resultCounts.youtube > 0 && (
                <Badge variant="outline" className="text-xs bg-red-500/10 text-red-500 border-red-500/30">
                  <Youtube className="h-3 w-3" /> <span className="ml-1">{resultCounts.youtube}</span>
                </Badge>
              )}
              {resultCounts.local > 0 && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/30">
                  <HardDrive className="h-3 w-3" /> <span className="ml-1">{resultCounts.local}</span>
                </Badge>
              )}
            </div>
            
            <div className="divide-y divide-border/30">
              {filteredResults.map((track) => (
                <div
                  key={`${track.source}-${track.id}`}
                  className="flex items-center gap-3 p-3 hover:bg-secondary/50 cursor-pointer group transition-all"
                  onClick={() => playTrack(track)}
                >
                  {track.albumArt ? (
                    <img src={track.albumArt} alt="" className="w-12 h-12 rounded shadow object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                      <Music className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{track.name}</p>
                      <SourceIcon source={track.source} size="sm" />
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {track.source !== 'local' && !isInLibrary(track) && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-9 w-9"
                        onClick={(e) => addToLibrary(track, e)}
                        title="Add to library"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-9 w-9">
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            <button 
              className="w-full p-3 text-center text-sm text-muted-foreground hover:bg-secondary/30 transition-colors"
              onClick={() => setShowResults(false)}
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {showResults && searchResults.length > 0 && (
        <div
          className="fixed inset-y-0 right-0 left-0 md:left-[72px] z-40"
          onClick={() => setShowResults(false)}
        />
      )}

      {/* Navigation Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={activeView === f.key ? "default" : "outline"}
            size="sm"
            className={`rounded-full h-9 md:h-10 px-4 md:px-5 text-xs md:text-sm gap-2 font-medium transition-all ${
              activeView === f.key 
                ? f.activeClass
                : 'bg-secondary/30 border-border/50 hover:bg-secondary/60'
            }`}
            onClick={() => setActiveView(f.key as any)}
          >
            {f.icon}
            <span className="hidden xs:inline">{f.label}</span>
          </Button>
        ))}
      </div>

      {/* View Content */}
      <div className="animate-fade-in">
        {activeView === "all" && <AllLibraryView />}
        {activeView === "spotify" && <SpotifyView />}
        {activeView === "youtube" && <YouTubeView />}
        {activeView === "local" && <LocalView />}
      </div>
    </div>
  );
};
