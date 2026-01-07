import { useState, useEffect } from "react";
import { Play, Pause, Search, Library, History, Plus, Music, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useUnifiedAudio, LocalTrackInfo } from "@/contexts/UnifiedAudioContext";
import { useUnifiedLibrary } from "@/hooks/useUnifiedLibrary";
import { useRecentlyPlayed } from "@/hooks/useRecentlyPlayed";
import { SourceIcon } from "@/components/SourceIcon";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

type SourceFilter = "all" | "spotify" | "youtube" | "local" | "soundcloud";

interface SearchResult {
  id: string;
  name: string;
  artist: string;
  albumArt?: string;
  source: "spotify" | "youtube" | "local" | "soundcloud";
  uri?: string;
  externalId?: string;
}

export const DashboardMusic = () => {
  const spotify = useSpotify();
  const unifiedAudio = useUnifiedAudio();
  const { tracks, addTrack } = useUnifiedLibrary();
  const { recentTracks, addTrack: addRecentTrack } = useRecentlyPlayed();
  const { toast } = useToast();
  
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<any[]>([]);

  // Load Spotify playlists
  useEffect(() => {
    if (spotify.isConnected && spotify.playlists) {
      setSpotifyPlaylists(spotify.playlists.slice(0, 8));
    }
  }, [spotify.isConnected, spotify.playlists]);

  // Track currently playing for recently played
  useEffect(() => {
    if (spotify.playbackState?.track && spotify.playbackState.isPlaying) {
      const track = spotify.playbackState.track;
      addRecentTrack({
        id: track.id,
        name: track.name,
        artist: track.artists.map((a: any) => a.name).join(", "),
        albumArt: track.album.images?.[0]?.url,
        uri: track.uri,
        source: "spotify",
      });
    }
  }, [spotify.playbackState?.track?.id, spotify.playbackState?.isPlaying]);

  // Search function
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results: SearchResult[] = [];

    try {
      // Search Spotify
      if ((filter === "all" || filter === "spotify") && spotify.isConnected) {
        const { data } = await supabase.functions.invoke("spotify-player", {
          body: { action: "search", query: searchQuery, type: "track", limit: 10 },
        });
        if (data?.tracks?.items) {
          results.push(...data.tracks.items.map((t: any) => ({
            id: t.id,
            name: t.name,
            artist: t.artists.map((a: any) => a.name).join(", "),
            albumArt: t.album.images?.[0]?.url,
            source: "spotify" as const,
            uri: t.uri,
            externalId: t.id,
          })));
        }
      }

      // Search YouTube
      if (filter === "all" || filter === "youtube") {
        const { data } = await supabase.functions.invoke("youtube-search", {
          body: { query: searchQuery, maxResults: 10 },
        });
        if (data?.items) {
          results.push(...data.items.map((v: any) => ({
            id: v.id.videoId,
            name: v.snippet.title,
            artist: v.snippet.channelTitle,
            albumArt: v.snippet.thumbnails?.medium?.url,
            source: "youtube" as const,
            externalId: v.id.videoId,
          })));
        }
      }

      // Search local library
      if (filter === "all" || filter === "local") {
        const localMatches = tracks
          .filter(t => t.source === "local")
          .filter(t => 
            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.artist?.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .slice(0, 10)
          .map(t => ({
            id: t.id,
            name: t.title,
            artist: t.artist || "Unknown",
            albumArt: t.albumArt || undefined,
            source: "local" as const,
          }));
        results.push(...localMatches);
      }

      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Play track
  const playTrack = async (result: SearchResult) => {
    try {
      if (result.source === "spotify" && result.uri) {
        await spotify.play(result.uri);
      } else if (result.source === "youtube" && result.externalId) {
        unifiedAudio.playYouTubeVideo(result.externalId, result.name);
      } else if (result.source === "local") {
        const localTrack = tracks.find(t => t.id === result.id);
        if (localTrack?.localUrl) {
          const trackInfo: LocalTrackInfo = {
            id: localTrack.id,
            title: localTrack.title,
            artist: localTrack.artist || "Unknown",
            albumArt: localTrack.albumArt || undefined,
            url: localTrack.localUrl,
            duration: String(localTrack.durationMs || 0),
          };
          await unifiedAudio.playLocalTrack(trackInfo);
        }
      }
    } catch (error: any) {
      toast({ title: "Playback Error", description: error.message, variant: "destructive" });
    }
  };

  // Add to library
  const addToLibrary = async (result: SearchResult) => {
    try {
      await addTrack({
        title: result.name,
        artist: result.artist,
        albumArt: result.albumArt || null,
        source: result.source,
        externalId: result.externalId || null,
        localUrl: null,
        durationMs: null,
      });
      toast({ title: "Added to Library", description: `${result.name} added` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add track", variant: "destructive" });
    }
  };

  // Play playlist
  const playPlaylist = async (playlist: any) => {
    try {
      await spotify.play(playlist.uri);
    } catch (error: any) {
      toast({ title: "Playback Error", description: error.message, variant: "destructive" });
    }
  };

  // Filter library tracks
  const filteredLibrary = tracks.filter(t => {
    if (filter === "all") return true;
    return t.source === filter;
  }).slice(0, 20);

  // Filter recent tracks
  const filteredRecent = recentTracks.filter(t => {
    if (filter === "all") return true;
    return t.source === filter;
  }).slice(0, 10);

  const isTrackPlaying = (id: string, source: string) => {
    if (source === "spotify") {
      return spotify.playbackState?.track?.id === id && spotify.playbackState?.isPlaying;
    }
    return unifiedAudio.currentTrack?.id === id && unifiedAudio.isPlaying;
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        {/* Search Bar */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search music across all sources..."
              className="pl-12 h-12 bg-secondary/50 border-0 rounded-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={isSearching}
            className="h-12 px-6 rounded-full"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>

        {/* Source Filters */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "spotify", "youtube", "soundcloud", "local"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "secondary"}
              size="sm"
              className={`rounded-full h-8 px-4 capitalize ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-secondary/50"
              }`}
              onClick={() => setFilter(f)}
            >
              {f === "spotify" && <SpotifyIcon />}
              {f === "youtube" && <SourceIcon source="youtube" size="sm" showTooltip={false} />}
              {f === "local" && <SourceIcon source="local" size="sm" showTooltip={false} />}
              <span className="ml-1.5">{f}</span>
            </Button>
          ))}
          
          {!spotify.isConnected && (
            <Button
              size="sm"
              onClick={spotify.connect}
              className="rounded-full h-8 px-4 bg-[#1DB954] text-black hover:bg-[#1ed760] ml-auto"
            >
              <SpotifyIcon />
              <span className="ml-1.5">Connect Spotify</span>
            </Button>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Results
            </h2>
            <div className="grid gap-2">
              {searchResults.map((result) => (
                <div
                  key={`${result.source}-${result.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-card/50 hover:bg-card transition-colors group"
                >
                  <div className="relative w-12 h-12 rounded overflow-hidden bg-secondary shrink-0">
                    {result.albumArt ? (
                      <img src={result.albumArt} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute bottom-0.5 left-0.5">
                      <SourceIcon source={result.source} size="sm" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{result.artist}</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => addToLibrary(result)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full bg-primary"
                      onClick={() => playTrack(result)}
                    >
                      {isTrackPlaying(result.id, result.source) ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spotify Playlists */}
        {spotify.isConnected && spotifyPlaylists.length > 0 && (filter === "all" || filter === "spotify") && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <SpotifyIcon />
              Your Playlists
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {spotifyPlaylists.map((playlist) => (
                <div
                  key={playlist.id}
                  className="group relative p-3 rounded-lg bg-card/50 hover:bg-card transition-colors cursor-pointer"
                  onClick={() => playPlaylist(playlist)}
                >
                  <div className="relative aspect-square rounded-md overflow-hidden mb-2">
                    {playlist.images?.[0]?.url ? (
                      <img src={playlist.images[0].url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center">
                        <Music className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="h-10 w-10 text-white" />
                    </div>
                  </div>
                  <p className="font-medium text-sm truncate">{playlist.name}</p>
                  <p className="text-xs text-muted-foreground">{playlist.tracks?.total || 0} tracks</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Library */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Library className="h-5 w-5" />
            Your Library
          </h2>
          {filteredLibrary.length > 0 ? (
            <div className="grid gap-2">
              {filteredLibrary.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-card/50 hover:bg-card transition-colors group cursor-pointer"
                  onClick={() => playTrack({
                    id: track.id,
                    name: track.title,
                    artist: track.artist || "Unknown",
                    albumArt: track.albumArt || undefined,
                    source: track.source as any,
                    externalId: track.externalId || undefined,
                  })}
                >
                  <div className="relative w-10 h-10 rounded overflow-hidden bg-secondary shrink-0">
                    {track.albumArt ? (
                      <img src={track.albumArt} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0">
                      <SourceIcon source={track.source as any} size="sm" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist || "Unknown"}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100"
                  >
                    {isTrackPlaying(track.id, track.source) ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4 ml-0.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground bg-card/30 rounded-lg">
              <Library className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No tracks in library yet</p>
              <p className="text-sm">Search and add tracks to build your collection</p>
            </div>
          )}
        </div>

        {/* Recently Played */}
        {filteredRecent.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History className="h-5 w-5" />
              Recently Played
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6">
              {filteredRecent.map((track) => (
                <div
                  key={`${track.source}-${track.id}-${track.playedAt}`}
                  className="flex-shrink-0 w-32 group cursor-pointer"
                  onClick={() => playTrack({
                    id: track.id,
                    name: track.name,
                    artist: track.artist,
                    albumArt: track.albumArt,
                    source: track.source as any,
                    uri: track.uri,
                  })}
                >
                  <div className="relative aspect-square rounded-md overflow-hidden mb-2">
                    {track.albumArt ? (
                      <img src={track.albumArt} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center">
                        <Music className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="h-8 w-8 text-white" />
                    </div>
                    <div className="absolute bottom-1 left-1">
                      <SourceIcon source={track.source as any} size="sm" />
                    </div>
                  </div>
                  <p className="text-sm font-medium truncate">{track.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
