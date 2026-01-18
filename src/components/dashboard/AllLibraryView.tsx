import { useState, useEffect } from "react";
import { Play, Music, Plus, Search, MoreHorizontal, ListPlus, ListEnd, ListMusic, Trash2, RefreshCw, Loader2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useUnifiedLibrary, UnifiedTrack } from "@/hooks/useUnifiedLibrary";
import { useSpotifyLibrarySync } from "@/hooks/useSpotifyLibrarySync";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useUnifiedAudio, AudioSource } from "@/contexts/UnifiedAudioContext";
import { useToast } from "@/hooks/use-toast";
import { SourceIcon } from "@/components/SourceIcon";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

export const AllLibraryView = () => {
  const { toast } = useToast();
  const spotify = useSpotify();
  const unifiedAudio = useUnifiedAudio();
  const mediaLibrary = useMediaLibrary();
  const librarySync = useSpotifyLibrarySync();
  const { 
    tracks: dbTracks, 
    playlists,
    isLoading, 
    deleteTrack, 
    createPlaylist,
    addTrackToPlaylist,
  } = useUnifiedLibrary();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "spotify" | "youtube" | "local">("all");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Convert synced Spotify tracks to UnifiedTrack format
  const spotifyTracks: UnifiedTrack[] = librarySync.syncedTracks.map((t) => ({
    id: `spotify-${t.spotifyId}`,
    title: t.title,
    artist: t.artist,
    albumArt: t.albumArt,
    source: 'spotify' as const,
    externalId: t.uri,
    localUrl: null,
    durationMs: t.durationMs,
    createdAt: t.addedAt,
  }));

  // Merge folder tracks with DB tracks
  const folderTracks = mediaLibrary.tracks.map((lt) => {
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

  // Combine all tracks: Spotify synced + DB tracks + local folder tracks
  const allTracks: UnifiedTrack[] = [];
  const seenIds = new Set<string>();

  // Add Spotify synced tracks first (highest priority)
  for (const track of spotifyTracks) {
    if (!seenIds.has(track.externalId || track.id)) {
      allTracks.push(track);
      seenIds.add(track.externalId || track.id);
    }
  }

  // Add DB tracks (avoid duplicates)
  for (const track of dbTracks) {
    const key = track.externalId || track.id;
    if (!seenIds.has(key)) {
      allTracks.push(track);
      seenIds.add(key);
    }
  }

  // Add local folder tracks
  for (const localTrack of folderTracks) {
    const exists = allTracks.some(
      (t) => t.source === 'local' && 
        t.title.toLowerCase() === localTrack.title.toLowerCase() &&
        (t.artist || '').toLowerCase() === (localTrack.artist || '').toLowerCase()
    );
    if (!exists) allTracks.push(localTrack);
  }

  const filteredTracks = allTracks.filter((track) => {
    const matchesSearch = searchQuery === "" ||
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (track.artist?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSource = sourceFilter === 'all' || track.source === sourceFilter;
    return matchesSearch && matchesSource;
  });

  const formatDuration = (ms: number | null) => {
    if (!ms) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const playTrack = (track: UnifiedTrack) => {
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

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    await createPlaylist(newPlaylistName.trim());
    setNewPlaylistName("");
    setIsCreateDialogOpen(false);
  };

  const counts = {
    all: allTracks.length,
    spotify: allTracks.filter(t => t.source === 'spotify').length,
    youtube: allTracks.filter(t => t.source === 'youtube').length,
    local: allTracks.filter(t => t.source === 'local').length,
  };

  const isLoadingAny = isLoading || librarySync.isLoading || librarySync.isSyncing;

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Your Library</h1>
            <div className="flex items-center gap-3 text-muted-foreground text-sm mt-1">
              <span className="flex items-center gap-1.5">
                <Music className="h-3.5 w-3.5" />
                {allTracks.length} tracks
              </span>
              {librarySync.isSyncing && (
                <span className="flex items-center gap-1 text-primary animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Syncing {librarySync.progress} tracks...
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => librarySync.resync()}
              disabled={librarySync.isSyncing}
              className="h-9"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${librarySync.isSyncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            <LocalUploader />
            <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(true)} className="h-9">
              <Plus className="h-4 w-4 mr-1.5" /> Playlist
            </Button>
          </div>
        </div>

        {/* Search & Filters - Improved layout */}
        <div className="flex flex-col gap-3">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tracks, artists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-secondary/30 border-border/50 rounded-lg"
            />
          </div>
          
          {/* Source Filter Pills */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={sourceFilter === 'all' ? "default" : "ghost"}
              size="sm"
              className={`rounded-full h-8 px-4 ${sourceFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50'}`}
              onClick={() => setSourceFilter('all')}
            >
              All
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] bg-background/20">
                {counts.all}
              </Badge>
            </Button>
            <Button
              variant={sourceFilter === 'spotify' ? "default" : "ghost"}
              size="sm"
              className={`rounded-full h-8 px-4 gap-1.5 ${sourceFilter === 'spotify' ? 'bg-[#1DB954] text-black' : 'bg-secondary/50'}`}
              onClick={() => setSourceFilter('spotify')}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Spotify
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-black/20">
                {counts.spotify}
              </Badge>
            </Button>
            <Button
              variant={sourceFilter === 'youtube' ? "default" : "ghost"}
              size="sm"
              className={`rounded-full h-8 px-4 gap-1.5 ${sourceFilter === 'youtube' ? 'bg-red-500 text-white' : 'bg-secondary/50'}`}
              onClick={() => setSourceFilter('youtube')}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              YouTube
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-white/20">
                {counts.youtube}
              </Badge>
            </Button>
            <Button
              variant={sourceFilter === 'local' ? "default" : "ghost"}
              size="sm"
              className={`rounded-full h-8 px-4 gap-1.5 ${sourceFilter === 'local' ? 'bg-amber-500 text-black' : 'bg-secondary/50'}`}
              onClick={() => setSourceFilter('local')}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              Local
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-black/20">
                {counts.local}
              </Badge>
            </Button>
          </div>
        </div>
      </div>

      {/* Playlists */}
      {playlists.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Playlists</h3>
          <div className="flex gap-2 flex-wrap">
            {playlists.map((pl) => (
              <Badge key={pl.id} variant="secondary" className="cursor-pointer hover:bg-secondary/80 py-1.5 px-3">
                <ListMusic className="h-3 w-3 mr-1.5" />
                {pl.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoadingAny && allTracks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading your library...</p>
          {librarySync.isSyncing && (
            <p className="text-sm text-muted-foreground mt-2">
              {librarySync.progress} / {librarySync.totalTracks || '...'} tracks synced
            </p>
          )}
        </div>
      )}

      {/* Track List - Improved */}
      {filteredTracks.length > 0 ? (
        <div className="space-y-1 bg-secondary/20 rounded-xl p-3">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-3 py-2.5 text-xs text-muted-foreground uppercase tracking-wide border-b border-border/30 mb-1">
            <span className="w-8 text-center">#</span>
            <span>Title</span>
            <span className="hidden md:block w-20 text-center">Source</span>
            <span className="hidden sm:block w-16 text-right">Duration</span>
            <span className="w-10"></span>
          </div>
          
          {/* Tracks */}
          <ScrollArea className="h-[calc(100vh-420px)] min-h-[300px]">
            <div className="space-y-0.5">
              {filteredTracks.map((track, idx) => (
                <div
                  key={track.id}
                  className="group grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-3 py-2.5 rounded-lg hover:bg-secondary/70 cursor-pointer transition-all border border-transparent hover:border-border/30"
                  onClick={() => playTrack(track)}
                >
                  <div className="w-8 flex items-center justify-center">
                    <span className="text-sm text-muted-foreground group-hover:hidden font-mono">{String(idx + 1).padStart(2, '0')}</span>
                    <div className="hidden group-hover:flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Play className="h-3.5 w-3.5 ml-0.5" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-md overflow-hidden flex-shrink-0 bg-secondary shadow-sm">
                      {track.albumArt ? (
                        <img src={track.albumArt} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
                          <Music className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate text-foreground">{track.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{track.artist || 'Unknown Artist'}</p>
                    </div>
                  </div>
                  
                  <div className="hidden md:flex items-center justify-center w-20">
                    <SourceIcon source={track.source} size="sm" />
                  </div>
                  
                  <span className="hidden sm:flex items-center text-xs text-muted-foreground w-16 justify-end font-mono">
                    {formatDuration(track.durationMs)}
                  </span>
                  
                  <div className="w-10 flex items-center justify-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" 
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
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
                      {!track.id.startsWith('local-folder-') && !track.id.startsWith('spotify-') && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive" 
                            onClick={() => deleteTrack(track.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Remove
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            </div>
          </ScrollArea>
        </div>
      ) : !isLoadingAny ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Music className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No tracks found</p>
          <p className="text-sm">
            {spotify.isConnected 
              ? "Your library is syncing automatically..." 
              : "Connect Spotify to import your music library"}
          </p>
        </div>
      ) : null}

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
