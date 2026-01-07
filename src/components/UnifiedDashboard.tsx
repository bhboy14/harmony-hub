import { useState, useCallback, useRef, useEffect } from "react";
import { 
  Search, Play, Music, Loader2, Plus, Trash2, ListPlus, ListEnd, 
  Library, History, TrendingUp, Youtube, HardDrive, MoreHorizontal, 
  ListMusic, User, AlertCircle, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useUnifiedAudio, AudioSource } from "@/contexts/UnifiedAudioContext";
import { supabase } from "@/integrations/supabase/client";
import { useUnifiedLibrary, UnifiedTrack, UnifiedPlaylist } from "@/hooks/useUnifiedLibrary";
import { useRecentlyPlayed } from "@/hooks/useRecentlyPlayed";
import { useToast } from "@/hooks/use-toast";
import { SourceIcon } from "@/components/SourceIcon";
import { RecentlyPlayed } from "@/components/RecentlyPlayed";
import { PopularSongs } from "@/components/PopularSongs";
import { LocalUploader } from "@/components/LocalUploader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

interface SearchTrack {
  id: string;
  name: string;
  artist: string;
  albumArt?: string;
  uri?: string;
  videoId?: string;
  source: 'spotify' | 'youtube' | 'local';
}

interface LocalFolderTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  source: "local" | "streaming";
  albumArt?: string;
  url?: string;
}

interface UnifiedDashboardProps {
  localFolderTracks?: LocalFolderTrack[];
}

export const UnifiedDashboard = ({ localFolderTracks = [] }: UnifiedDashboardProps) => {
  const spotify = useSpotify();
  const unifiedAudio = useUnifiedAudio();
  const { toast } = useToast();
  
  // Library hook
  const { 
    tracks: dbTracks, 
    playlists,
    isLoading: libraryLoading, 
    deleteTrack, 
    createPlaylist,
    addTrackToPlaylist,
    importSpotifyTrack,
    importYouTubeTrack,
  } = useUnifiedLibrary();
  
  // Recently played
  const { recentTracks, addTrack: addRecentTrack } = useRecentlyPlayed();
  
  // State
  const [filter, setFilter] = useState<"all" | "spotify" | "youtube" | "local" | "soundcloud">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [spotifyResults, setSpotifyResults] = useState<SearchTrack[]>([]);
  const [youtubeResults, setYoutubeResults] = useState<SearchTrack[]>([]);
  const [localResults, setLocalResults] = useState<SearchTrack[]>([]);
  const [activeSearchFilter, setActiveSearchFilter] = useState<'all' | 'spotify' | 'youtube' | 'local'>('all');
  const [playError, setPlayError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Merge local folder tracks with DB tracks
  const convertedLocalTracks: UnifiedTrack[] = localFolderTracks.map((lt) => {
    const durationParts = lt.duration.split(':').map(Number);
    let durationMs = 0;
    if (durationParts.length === 3) {
      durationMs = (durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]) * 1000;
    } else if (durationParts.length === 2) {
      durationMs = (durationParts[0] * 60 + durationParts[1]) * 1000;
    }
    return {
      id: `local-folder-${lt.id}`,
      title: lt.title,
      artist: lt.artist || null,
      albumArt: lt.albumArt || null,
      source: 'local' as const,
      externalId: null,
      localUrl: lt.url || null,
      durationMs,
      createdAt: new Date().toISOString(),
    };
  });
  
  const allTracks: UnifiedTrack[] = [...dbTracks];
  for (const localTrack of convertedLocalTracks) {
    const exists = allTracks.some(
      (t) => t.source === 'local' && 
        t.title.toLowerCase() === localTrack.title.toLowerCase() &&
        (t.artist || '').toLowerCase() === (localTrack.artist || '').toLowerCase()
    );
    if (!exists) allTracks.push(localTrack);
  }

  // Track recently played from Spotify
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
  }, [spotify.playbackState?.track?.id, spotify.playbackState?.isPlaying, addRecentTrack]);

  // Filter library tracks
  const filteredLibraryTracks = allTracks.filter((track) => {
    const matchesSearch = searchQuery === "" ||
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (track.artist?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSource = filter === 'all' || track.source === filter;
    return matchesSearch && matchesSource;
  });

  // Filter recent tracks
  const filteredRecentTracks = recentTracks
    .filter((track) => filter === "all" || track.source === filter)
    .map((track) => ({
      ...track,
      title: track.name,
      coverUrl: track.albumArt || "",
      playedAt: new Date(track.playedAt).toISOString(),
    }));

  // Search functions
  const searchSpotify = async (query: string): Promise<SearchTrack[]> => {
    if (!spotify.isConnected || !spotify.tokens?.accessToken) return [];
    try {
      const response = await supabase.functions.invoke('spotify-player', {
        body: { action: 'search', accessToken: spotify.tokens.accessToken, query, type: 'track', limit: 8 },
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

  const searchYouTube = async (query: string): Promise<SearchTrack[]> => {
    try {
      const response = await supabase.functions.invoke('youtube-search', {
        body: { query, maxResults: 8 },
      });
      if (response.data?.items) {
        return response.data.items.map((item: any) => ({
          id: item.id.videoId,
          name: item.snippet.title,
          artist: item.snippet.channelTitle,
          albumArt: item.snippet.thumbnails?.medium?.url,
          videoId: item.id.videoId,
          source: 'youtube' as const,
        }));
      }
    } catch (error) {
      console.error('YouTube search failed:', error);
    }
    return [];
  };

  const searchLocal = (query: string): SearchTrack[] => {
    const lowerQuery = query.toLowerCase();
    return allTracks
      .filter(t => t.source === 'local' && (
        t.title.toLowerCase().includes(lowerQuery) || 
        (t.artist?.toLowerCase().includes(lowerQuery))
      ))
      .slice(0, 8)
      .map(t => ({
        id: t.id,
        name: t.title,
        artist: t.artist || 'Unknown',
        albumArt: t.albumArt || undefined,
        source: 'local' as const,
      }));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSpotifyResults([]);
      setYoutubeResults([]);
      setLocalResults([]);
      return;
    }
    setIsSearching(true);
    try {
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

  // Playback functions
  const playSearchTrack = async (track: SearchTrack) => {
    setPlayError(null);
    try {
      if (track.source === 'spotify' && track.uri) {
        await spotify.play(undefined, [track.uri]);
        spotify.refreshPlaybackState();
      } else if (track.source === 'youtube' && track.videoId) {
        unifiedAudio.playYouTubeVideo(track.videoId, track.name);
      } else if (track.source === 'local') {
        const libTrack = allTracks.find(t => t.id === track.id);
        if (libTrack?.localUrl) {
          unifiedAudio.playLocalTrack({
            id: libTrack.id,
            title: libTrack.title,
            artist: libTrack.artist || '',
            duration: formatDuration(libTrack.durationMs),
            url: libTrack.localUrl,
            albumArt: libTrack.albumArt || undefined,
          });
        }
      }
    } catch (error: any) {
      handlePlayError(error);
    }
  };

  const playLibraryTrack = (track: UnifiedTrack) => {
    setPlayError(null);
    try {
      if (track.source === 'spotify' && track.externalId) {
        spotify.play(undefined, [track.externalId]);
      } else if (track.source === 'youtube' && track.externalId) {
        unifiedAudio.playYouTubeVideo(track.externalId, track.title);
      } else if (track.source === 'local' && track.localUrl) {
        unifiedAudio.playLocalTrack({
          id: track.id,
          title: track.title,
          artist: track.artist || '',
          duration: formatDuration(track.durationMs),
          url: track.localUrl,
          albumArt: track.albumArt || undefined,
        });
      }
    } catch (error: any) {
      handlePlayError(error);
    }
  };

  const playRecentTrack = async (track: any) => {
    setPlayError(null);
    try {
      if (track.uri) await spotify.play(track.uri);
    } catch (error: any) {
      handlePlayError(error);
    }
  };

  const handlePlayError = (error: any) => {
    const msg = error?.message || "";
    if (msg.includes("No active device") || msg.includes("not found")) {
      setPlayError("No active Spotify device. Open Spotify on another device first.");
    } else if (msg.includes("Premium")) {
      setPlayError("Spotify Premium required for playback control.");
    } else if (msg.includes("rate limit") || msg.includes("429")) {
      setPlayError("Rate limited. Please wait a moment.");
    } else {
      setPlayError(msg || "Playback failed.");
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const addToQueue = (track: UnifiedTrack, playNext: boolean = false) => {
    const queueTrack = {
      id: track.id,
      title: track.title,
      artist: track.artist || 'Unknown Artist',
      albumArt: track.albumArt || undefined,
      duration: track.durationMs || 0,
      source: track.source as AudioSource,
      externalId: track.externalId || undefined,
      url: track.localUrl || undefined,
    };
    if (playNext) {
      unifiedAudio.playNext(queueTrack);
      toast({ title: "Playing next", description: `"${track.title}" will play next` });
    } else {
      unifiedAudio.addToQueue(queueTrack);
      toast({ title: "Added to queue", description: `"${track.title}" added to queue` });
    }
  };

  const addSearchTrackToLibrary = async (track: SearchTrack, e: React.MouseEvent) => {
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

  const isInLibrary = (track: SearchTrack) => {
    if (track.source === 'spotify') return dbTracks.some(t => t.externalId === track.uri);
    if (track.source === 'youtube') return dbTracks.some(t => t.externalId === track.videoId);
    return false;
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    await createPlaylist(newPlaylistName.trim());
    setNewPlaylistName("");
    setIsCreateDialogOpen(false);
  };

  // Search results
  const allSearchResults = [...spotifyResults, ...youtubeResults, ...localResults];
  const filteredSearchResults = activeSearchFilter === 'all' 
    ? allSearchResults 
    : allSearchResults.filter(t => t.source === activeSearchFilter);
  const hasSearchResults = allSearchResults.length > 0;

  // Spotify playlists for quick access
  const quickAccessItems = (spotify.playlists || []).slice(0, 6).map((p: any) => ({
    id: p.id,
    name: p.name,
    image: p.images?.[0]?.url,
    uri: p.uri,
    source: "spotify" as const,
  }));

  const madeForYou = (spotify.playlists || [])
    .filter((p: any) => 
      p.name?.toLowerCase().includes("mix") ||
      p.name?.toLowerCase().includes("daily") ||
      p.name?.toLowerCase().includes("discover")
    )
    .slice(0, 4);

  return (
    <div className="flex-1 flex overflow-hidden bg-background">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        {/* Search Bar */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search Spotify, YouTube, and local files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-12 h-12 bg-secondary/50 border-0 rounded-full text-sm placeholder:text-muted-foreground"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching} size="lg" className="h-12 px-6 rounded-full">
              {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            </Button>
          </div>

          {/* Source Filters */}
          <div className="flex gap-2 flex-wrap">
            {(["all", "spotify", "youtube", "local", "soundcloud"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "secondary"}
                size="sm"
                className={`rounded-full h-8 px-4 text-sm capitalize ${
                  filter === f ? "bg-primary text-primary-foreground" : "bg-secondary/50"
                }`}
                onClick={() => setFilter(f)}
              >
                {f === 'spotify' && <SpotifyIcon />}
                {f === 'youtube' && <Youtube className="h-3 w-3 mr-1" />}
                {f === 'local' && <HardDrive className="h-3 w-3 mr-1" />}
                <span className="ml-1">{f}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {playError && (
          <Alert variant="destructive" className="max-w-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Playback Error</AlertTitle>
            <AlertDescription>{playError}</AlertDescription>
          </Alert>
        )}

        {/* Search Results */}
        {hasSearchResults && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Search className="h-4 w-4" /> Search Results
              </h3>
              <div className="flex gap-1">
                {spotifyResults.length > 0 && (
                  <Button 
                    variant={activeSearchFilter === 'spotify' ? "default" : "ghost"} 
                    size="sm" className="h-7 text-xs gap-1"
                    onClick={() => setActiveSearchFilter(activeSearchFilter === 'spotify' ? 'all' : 'spotify')}
                  >
                    <SpotifyIcon /> {spotifyResults.length}
                  </Button>
                )}
                {youtubeResults.length > 0 && (
                  <Button 
                    variant={activeSearchFilter === 'youtube' ? "default" : "ghost"} 
                    size="sm" className="h-7 text-xs gap-1"
                    onClick={() => setActiveSearchFilter(activeSearchFilter === 'youtube' ? 'all' : 'youtube')}
                  >
                    <Youtube className="h-3 w-3" /> {youtubeResults.length}
                  </Button>
                )}
                {localResults.length > 0 && (
                  <Button 
                    variant={activeSearchFilter === 'local' ? "default" : "ghost"} 
                    size="sm" className="h-7 text-xs gap-1"
                    onClick={() => setActiveSearchFilter(activeSearchFilter === 'local' ? 'all' : 'local')}
                  >
                    <HardDrive className="h-3 w-3" /> {localResults.length}
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              {filteredSearchResults.slice(0, 10).map((track) => (
                <div
                  key={`${track.source}-${track.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-card/40 hover:bg-card/80 cursor-pointer group transition-all"
                  onClick={() => playSearchTrack(track)}
                >
                  {track.albumArt ? (
                    <img src={track.albumArt} alt="" className="w-12 h-12 rounded object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-secondary flex items-center justify-center">
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
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => addSearchTrackToLibrary(track, e)}>
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
          </div>
        )}

        {/* Connect Spotify Banner */}
        {!spotify.isConnected && (
          <div className="rounded-xl bg-gradient-to-br from-[#1DB954]/20 via-[#1DB954]/5 to-background border border-[#1DB954]/20 p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-14 w-14 bg-[#1DB954] rounded-full flex items-center justify-center">
                <SpotifyIcon />
              </div>
              <h3 className="text-2xl font-bold">Connect to Spotify</h3>
              <p className="text-muted-foreground max-w-md">
                Link your account to access playlists, daily mixes, and playback control.
              </p>
              <Button onClick={spotify.connect} className="bg-[#1DB954] text-black hover:bg-[#1ed760] rounded-full px-6">
                Connect Spotify
              </Button>
            </div>
          </div>
        )}

        {/* Quick Access / Library Grid */}
        {quickAccessItems.length > 0 && (filter === 'all' || filter === 'spotify') && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Library className="h-4 w-4" /> Quick Access
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {quickAccessItems.map((item) => (
                <div
                  key={item.id}
                  className="group relative flex flex-col gap-2 p-3 bg-card/40 hover:bg-card/80 rounded-lg cursor-pointer transition-all"
                  onClick={() => spotify.play(item.uri)}
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-md">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center">
                        <Music className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                      <Button size="icon" className="h-10 w-10 rounded-full bg-primary">
                        <Play className="h-5 w-5 fill-current" />
                      </Button>
                    </div>
                  </div>
                  <span className="font-medium text-sm truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Library Section (Collapsible) */}
        <div className="space-y-3">
          <button 
            onClick={() => setShowLibrary(!showLibrary)}
            className="flex items-center gap-2 text-lg font-semibold hover:text-primary transition-colors"
          >
            <ListMusic className="h-4 w-4" />
            Your Library ({filteredLibraryTracks.length})
            {showLibrary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {showLibrary && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <LocalUploader />
                <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> New Playlist
                </Button>
              </div>
              
              {/* Playlists */}
              {playlists.length > 0 && (
                <div className="flex gap-2 flex-wrap pb-2">
                  {playlists.map((pl) => (
                    <Badge key={pl.id} variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                      {pl.name}
                    </Badge>
                  ))}
                </div>
              )}
              
              {/* Track List */}
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {filteredLibraryTracks.slice(0, 50).map((track, idx) => (
                  <div
                    key={track.id}
                    className="group flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-all"
                    onClick={() => playLibraryTrack(track)}
                  >
                    <span className="w-6 text-xs text-muted-foreground text-center">{idx + 1}</span>
                    {track.albumArt ? (
                      <img src={track.albumArt} alt="" className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                        <Music className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{track.title}</p>
                        <SourceIcon source={track.source} size="sm" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{track.artist || 'Unknown'}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDuration(track.durationMs)}</span>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => addToQueue(track, true)}>
                          <ListPlus className="h-4 w-4 mr-2" /> Play Next
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addToQueue(track, false)}>
                          <ListEnd className="h-4 w-4 mr-2" /> Add to Queue
                        </DropdownMenuItem>
                        {playlists.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <ListMusic className="h-4 w-4 mr-2" /> Add to Playlist
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {playlists.map((pl) => (
                                  <DropdownMenuItem key={pl.id} onClick={() => addTrackToPlaylist(pl.id, track.id)}>
                                    {pl.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recently Played */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <History className="h-4 w-4" /> Recently Played
          </h3>
          <RecentlyPlayed recentTracks={filteredRecentTracks} onPlayTrack={playRecentTrack} />
        </div>

        {/* Made For You */}
        {spotify.isConnected && madeForYou.length > 0 && (filter === 'all' || filter === 'spotify') && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Made For You
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
              {madeForYou.map((item: any) => (
                <div
                  key={item.id}
                  className="flex-shrink-0 w-40 group cursor-pointer"
                  onClick={() => spotify.play(item.uri)}
                >
                  <div className="aspect-square rounded-md overflow-hidden mb-2">
                    <img src={item.images?.[0]?.url} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Mixed for you</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Popular Songs */}
      <div className="w-80 flex-shrink-0 border-l border-border/30 hidden lg:block bg-background/50">
        <ScrollArea className="h-full">
          <div className="p-4">
            <PopularSongs title="Popular Songs" />
          </div>
        </ScrollArea>
      </div>

      {/* Create Playlist Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Playlist</DialogTitle>
            <DialogDescription>Give your new playlist a name.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="playlist-name">Name</Label>
            <Input
              id="playlist-name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="My Playlist"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePlaylist}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
