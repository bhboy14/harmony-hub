import { useState, useCallback, useRef, useEffect } from "react";
import { Play, Trash2, Music, Search, Loader2, ListPlus, ListEnd, User, Layers, Plus, Download, ListMusic, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUnifiedLibrary, UnifiedTrack, UnifiedPlaylist } from "@/hooks/useUnifiedLibrary";
import { useMasterTracks, MasterTrack, Artist } from "@/hooks/useMasterTracks";
import { LocalUploader } from "@/components/LocalUploader";
import { SourceIcon } from "@/components/SourceIcon";
import { ArtistProfile } from "@/components/ArtistProfile";
import { useUnifiedAudio, AudioSource } from "@/contexts/UnifiedAudioContext";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useToast } from "@/hooks/use-toast";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LocalFolderTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  source: "local" | "streaming";
  albumArt?: string;
  url?: string;
}

interface UnifiedLibraryProps {
  onOpenSpotify?: () => void;
  onOpenYouTube?: () => void;
  localFolderTracks?: LocalFolderTrack[];
}

// Virtual scrolling constants
const ITEM_HEIGHT = 64;
const OVERSCAN_COUNT = 5;

export const UnifiedLibrary = ({ onOpenSpotify, onOpenYouTube, localFolderTracks = [] }: UnifiedLibraryProps) => {
  const { 
    tracks: dbTracks, 
    playlists,
    isLoading, 
    isImporting,
    deleteTrack, 
    loadTracks,
    loadPlaylists,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    importSpotifyPlaylist,
    getPlaylistTracks,
  } = useUnifiedLibrary();
  
  // Convert local folder tracks to UnifiedTrack format and merge with database tracks
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
  
  // Merge: database tracks + folder-scanned local tracks (avoid duplicates by title+artist)
  const tracks: UnifiedTrack[] = [...dbTracks];
  for (const localTrack of convertedLocalTracks) {
    const exists = tracks.some(
      (t) => 
        t.source === 'local' && 
        t.title.toLowerCase() === localTrack.title.toLowerCase() &&
        (t.artist || '').toLowerCase() === (localTrack.artist || '').toLowerCase()
    );
    if (!exists) {
      tracks.push(localTrack);
    }
  }
  const { 
    masterTracks, 
    isProcessing, 
    fetchArtistProfile, 
    filterMasterTracks 
  } = useMasterTracks(tracks);
  const unifiedAudio = useUnifiedAudio();
  const spotify = useSpotify();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<'all' | 'spotify' | 'youtube' | 'local' | 'soundcloud'>('all');
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('grouped');
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [isLoadingArtist, setIsLoadingArtist] = useState(false);
  const [activeTab, setActiveTab] = useState("tracks");
  
  // Playlist state
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDesc, setNewPlaylistDesc] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<UnifiedPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<UnifiedTrack[]>([]);
  const [isLoadingPlaylistTracks, setIsLoadingPlaylistTracks] = useState(false);
  
  // Virtual scrolling state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Filter tracks based on view mode
  const filteredData = viewMode === 'grouped' 
    ? filterMasterTracks(searchQuery, sourceFilter)
    : tracks.filter((track: UnifiedTrack) => {
        const matchesSearch = 
          track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (track.artist?.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesSource = sourceFilter === 'all' || track.source === sourceFilter;
        return matchesSearch && matchesSource;
      });

  // Calculate source counts
  const spotifyTracks = tracks.filter((t: UnifiedTrack) => t.source === 'spotify');
  const youtubeTracks = tracks.filter((t: UnifiedTrack) => t.source === 'youtube');
  const localTracks = tracks.filter((t: UnifiedTrack) => t.source === 'local');
  const soundcloudTracks = tracks.filter((t: UnifiedTrack) => t.source === 'soundcloud');

  // Virtual scrolling calculations
  const visibleCount = Math.ceil(600 / ITEM_HEIGHT);
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN_COUNT);
  const endIndex = Math.min(filteredData.length, startIndex + visibleCount + OVERSCAN_COUNT * 2);
  const visibleItems = filteredData.slice(startIndex, endIndex);
  const totalHeight = filteredData.length * ITEM_HEIGHT;
  const offsetY = startIndex * ITEM_HEIGHT;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const playTrack = (track: UnifiedTrack) => {
    if (track.source === 'spotify' && track.externalId) {
      spotify.play(undefined, [track.externalId]);
    } else if (track.source === 'youtube' && track.externalId) {
      unifiedAudio.playYouTubeVideo(track.externalId, track.title);
    } else if (track.source === 'local' && track.localUrl) {
      const durationMs = track.durationMs || 0;
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      unifiedAudio.playLocalTrack({
        id: track.id,
        title: track.title,
        artist: track.artist || '',
        duration: durationStr,
        url: track.localUrl,
        albumArt: track.albumArt || undefined,
      });
    }
  };

  const playMasterTrack = (master: MasterTrack) => {
    // Prefer Spotify, then local, then YouTube
    const spotifySource = master.sources.find(s => s.source === 'spotify');
    const localSource = master.sources.find(s => s.source === 'local');
    const youtubeSource = master.sources.find(s => s.source === 'youtube');
    
    const preferredTrack = spotifySource || localSource || youtubeSource || master.sources[0];
    if (preferredTrack) {
      playTrack(preferredTrack);
    }
  };

  const isCurrentTrack = (track: UnifiedTrack) => {
    return unifiedAudio.currentTrack?.id === track.id ||
           unifiedAudio.currentTrack?.id === track.externalId;
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '--:--';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const addTrackToQueue = (track: UnifiedTrack, playNext: boolean = false) => {
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

  const handleArtistClick = async (artistName: string) => {
    if (!artistName) return;
    
    setIsLoadingArtist(true);
    const artist = await fetchArtistProfile(artistName);
    setSelectedArtist(artist);
    setIsLoadingArtist(false);
  };

  // Playlist handlers
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    await createPlaylist(newPlaylistName.trim(), newPlaylistDesc.trim() || undefined);
    setNewPlaylistName("");
    setNewPlaylistDesc("");
    setIsCreateDialogOpen(false);
  };

  const handleImportSpotifyPlaylists = async () => {
    if (!spotify.isConnected) {
      toast({ title: "Not connected", description: "Connect to Spotify first", variant: "destructive" });
      return;
    }
    
    await spotify.loadPlaylists();
  };

  const handleImportPlaylist = async (spotifyPlaylist: any) => {
    // Fetch full playlist details with tracks
    try {
      const accessToken = spotify.tokens?.accessToken;
      if (!accessToken) return;
      
      toast({ title: "Importing...", description: `Importing "${spotifyPlaylist.name}"` });
      
      await importSpotifyPlaylist({
        id: spotifyPlaylist.id,
        name: spotifyPlaylist.name,
        description: spotifyPlaylist.description,
        images: spotifyPlaylist.images,
        tracks: spotifyPlaylist.tracks,
        uri: spotifyPlaylist.uri,
      });
    } catch (error) {
      console.error('Failed to import playlist:', error);
    }
  };

  const handleSelectPlaylist = async (playlist: UnifiedPlaylist) => {
    setSelectedPlaylist(playlist);
    setIsLoadingPlaylistTracks(true);
    const tracks = await getPlaylistTracks(playlist.id);
    setPlaylistTracks(tracks);
    setIsLoadingPlaylistTracks(false);
  };

  const handleAddToPlaylist = async (playlistId: string, track: UnifiedTrack) => {
    await addTrackToPlaylist(playlistId, track.id);
  };

  // Render a flat track row
  const renderTrackRow = (track: UnifiedTrack, index: number) => (
    <div
      key={track.id}
      className={`group flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/80 transition-colors cursor-pointer ${
        isCurrentTrack(track) ? 'bg-secondary' : ''
      }`}
      style={{ height: ITEM_HEIGHT }}
      onClick={() => playTrack(track)}
    >
      <div className="w-8 text-center">
        <span className="group-hover:hidden text-sm text-muted-foreground">
          {isCurrentTrack(track) && unifiedAudio.isPlaying ? (
            <span className="text-primary">▶</span>
          ) : (
            startIndex + index + 1
          )}
        </span>
        <Play className="h-4 w-4 hidden group-hover:block mx-auto text-foreground" />
      </div>

      <div className="w-10 h-10 rounded overflow-hidden bg-secondary flex-shrink-0">
        {track.albumArt ? (
          <img src={track.albumArt} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-medium truncate ${isCurrentTrack(track) ? 'text-primary' : 'text-foreground'}`}>
            {track.title}
          </p>
          <SourceIcon source={track.source} size="sm" />
        </div>
        <p 
          className="text-sm text-muted-foreground truncate hover:text-primary hover:underline cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            if (track.artist) handleArtistClick(track.artist);
          }}
        >
          {track.artist || 'Unknown Artist'}
        </p>
      </div>

      <span className="text-sm text-muted-foreground">{formatDuration(track.durationMs)}</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => addTrackToQueue(track, true)}>
            <ListPlus className="h-4 w-4 mr-2" />Play Next
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addTrackToQueue(track, false)}>
            <ListEnd className="h-4 w-4 mr-2" />Add to Queue
          </DropdownMenuItem>
          {playlists.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ListMusic className="h-4 w-4 mr-2" />Add to Playlist
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {playlists.map((playlist) => (
                    <DropdownMenuItem 
                      key={playlist.id} 
                      onClick={() => handleAddToPlaylist(playlist.id, track)}
                    >
                      {playlist.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
          {track.artist && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleArtistClick(track.artist!)}>
                <User className="h-4 w-4 mr-2" />View Artist
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={(e) => e.stopPropagation()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from library?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{track.title}" from your unified library.
              {track.source === 'local' && ' The file will also be deleted from storage.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTrack(track.id)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  // Render a master track row (grouped view)
  const renderMasterTrackRow = (master: MasterTrack, index: number) => {
    const primaryTrack = master.sources[0];
    const isPlaying = master.sources.some(s => isCurrentTrack(s));

    return (
      <div
        key={master.id}
        className={`group flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/80 transition-colors cursor-pointer ${
          isPlaying ? 'bg-secondary' : ''
        }`}
        style={{ height: ITEM_HEIGHT }}
        onClick={() => playMasterTrack(master)}
      >
        <div className="w-8 text-center">
          <span className="group-hover:hidden text-sm text-muted-foreground">
            {isPlaying && unifiedAudio.isPlaying ? (
              <span className="text-primary">▶</span>
            ) : (
              startIndex + index + 1
            )}
          </span>
          <Play className="h-4 w-4 hidden group-hover:block mx-auto text-foreground" />
        </div>

        <div className="w-10 h-10 rounded overflow-hidden bg-secondary flex-shrink-0 relative">
          {master.primaryAlbumArt ? (
            <img src={master.primaryAlbumArt} alt={master.canonicalTitle} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          {/* Multi-source indicator */}
          {master.sources.length > 1 && (
            <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-xs w-4 h-4 rounded-full flex items-center justify-center font-medium">
              {master.sources.length}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-medium truncate ${isPlaying ? 'text-primary' : 'text-foreground'}`}>
              {master.canonicalTitle}
            </p>
            {/* Show all source icons */}
            <TooltipProvider>
              <div className="flex items-center -space-x-1">
                {master.sources.map((source, idx) => (
                  <Tooltip key={idx}>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <SourceIcon source={source.source} size="sm" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {source.source.charAt(0).toUpperCase() + source.source.slice(1)}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </div>
          <p 
            className="text-sm text-muted-foreground truncate hover:text-primary hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (master.canonicalArtist) handleArtistClick(master.canonicalArtist.split(',')[0].trim());
            }}
          >
            {master.canonicalArtist || 'Unknown Artist'}
          </p>
        </div>

        <span className="text-sm text-muted-foreground">
          {formatDuration(primaryTrack.durationMs)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {master.sources.map((source, idx) => (
              <DropdownMenuItem key={idx} onClick={() => playTrack(source)}>
                <SourceIcon source={source.source} size="sm" className="mr-2" />
                Play from {source.source.charAt(0).toUpperCase() + source.source.slice(1)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => addTrackToQueue(primaryTrack, true)}>
              <ListPlus className="h-4 w-4 mr-2" />Play Next
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addTrackToQueue(primaryTrack, false)}>
              <ListEnd className="h-4 w-4 mr-2" />Add to Queue
            </DropdownMenuItem>
            {master.canonicalArtist && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleArtistClick(master.canonicalArtist!.split(',')[0].trim())}>
                  <User className="h-4 w-4 mr-2" />View Artist
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Unified Library</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {viewMode === 'grouped' 
              ? `${masterTracks.length} unique songs from ${tracks.length} sources`
              : `${tracks.length} tracks from all sources`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={viewMode === 'grouped' ? 'default' : 'outline'} 
                  size="icon"
                  onClick={() => setViewMode(viewMode === 'grouped' ? 'flat' : 'grouped')}
                >
                  <Layers className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {viewMode === 'grouped' ? 'Switch to flat view' : 'Switch to grouped view'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" onClick={loadTracks} disabled={isLoading || isProcessing}>
            {(isLoading || isProcessing) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Source Stats */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0 mb-4">
        {[
          { key: 'spotify' as const, label: 'Spotify', count: spotifyTracks.length, color: '#1DB954' },
          { key: 'youtube' as const, label: 'YouTube', count: youtubeTracks.length, color: '#FF0000' },
          { key: 'soundcloud' as const, label: 'SoundCloud', count: soundcloudTracks.length, color: '#FF5500' },
          { key: 'local' as const, label: 'Local', count: localTracks.length, color: 'hsl(var(--primary))' },
        ].map(({ key, label, count, color }) => (
          <button
            key={key}
            className={`p-3 rounded-lg border transition-all ${
              sourceFilter === key 
                ? 'border-primary bg-primary/10' 
                : 'border-border bg-secondary/50 hover:bg-secondary'
            }`}
            style={sourceFilter === key ? { borderColor: color, backgroundColor: `${color}15` } : {}}
            onClick={() => setSourceFilter(sourceFilter === key ? 'all' : key)}
          >
            <div className="flex items-center gap-2">
              <SourceIcon source={key} showTooltip={false} />
              <span className="font-medium text-foreground text-sm">{label}</span>
            </div>
            <p className="text-xl font-bold text-foreground mt-1">{count}</p>
          </button>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
        <TabsList className="bg-secondary flex-shrink-0 mb-3">
          <TabsTrigger value="tracks">
            {viewMode === 'grouped' ? 'Master Tracks' : 'All Tracks'}
          </TabsTrigger>
          <TabsTrigger value="playlists">
            Playlists ({playlists.length})
          </TabsTrigger>
          <TabsTrigger value="upload">Upload Local</TabsTrigger>
        </TabsList>

        <TabsContent value="tracks" className="flex-1 min-h-0 flex flex-col mt-0 space-y-3">
          {/* Search */}
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search your library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary border-0"
            />
          </div>

          {/* Track List with Virtual Scrolling */}
          {(isLoading || isProcessing) ? (
            <div className="flex items-center justify-center py-12 flex-1">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">
                {isProcessing ? 'Grouping tracks...' : 'Loading...'}
              </span>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-12 flex-1">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {tracks.length === 0 
                  ? "Your library is empty. Add tracks from Spotify, YouTube, or upload local files."
                  : "No tracks match your search."}
              </p>
            </div>
          ) : (
            <div 
              ref={scrollContainerRef}
              className="flex-1 min-h-0 overflow-auto rounded-lg scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
              onScroll={handleScroll}
            >
              <div style={{ height: totalHeight, position: 'relative' }}>
                <div style={{ transform: `translateY(${offsetY}px)` }}>
                  {viewMode === 'grouped' 
                    ? (visibleItems as MasterTrack[]).map((item, idx) => renderMasterTrackRow(item, idx))
                    : (visibleItems as UnifiedTrack[]).map((item, idx) => renderTrackRow(item, idx))
                  }
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Playlists Tab */}
        <TabsContent value="playlists" className="flex-1 min-h-0 flex flex-col mt-0 space-y-3">
          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Playlist
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Playlist</DialogTitle>
                  <DialogDescription>
                    Create a custom playlist to organize your music
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input 
                      id="name" 
                      placeholder="My Playlist"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input 
                      id="description" 
                      placeholder="A great collection of tracks..."
                      value={newPlaylistDesc}
                      onChange={(e) => setNewPlaylistDesc(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreatePlaylist} disabled={!newPlaylistName.trim()}>
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {spotify.isConnected && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isImporting}>
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Import from Spotify
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-auto">
                  {spotify.playlists.length === 0 ? (
                    <DropdownMenuItem onClick={handleImportSpotifyPlaylists}>
                      Load Spotify Playlists...
                    </DropdownMenuItem>
                  ) : (
                    spotify.playlists.map((pl: any) => (
                      <DropdownMenuItem 
                        key={pl.id} 
                        onClick={() => handleImportPlaylist(pl)}
                        className="flex items-center gap-2"
                      >
                        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-secondary">
                          {pl.images?.[0]?.url ? (
                            <img src={pl.images[0].url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ListMusic className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <span className="truncate">{pl.name}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {selectedPlaylist && (
              <Button variant="ghost" size="sm" onClick={() => { setSelectedPlaylist(null); setPlaylistTracks([]); }}>
                ← Back to Playlists
              </Button>
            )}
          </div>

          {/* Playlist Content */}
          {selectedPlaylist ? (
            // Show playlist tracks
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-4 mb-4 p-4 bg-secondary/50 rounded-lg">
                <div className="w-20 h-20 rounded overflow-hidden bg-secondary flex-shrink-0">
                  {selectedPlaylist.coverArt ? (
                    <img src={selectedPlaylist.coverArt} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ListMusic className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-foreground truncate">{selectedPlaylist.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedPlaylist.trackCount || 0} tracks</p>
                  {selectedPlaylist.sourcePlatform && (
                    <div className="flex items-center gap-1 mt-1">
                      <SourceIcon source={selectedPlaylist.sourcePlatform as any} size="sm" />
                      <span className="text-xs text-muted-foreground capitalize">{selectedPlaylist.sourcePlatform}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <ScrollArea className="flex-1">
                {isLoadingPlaylistTracks ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : playlistTracks.length === 0 ? (
                  <div className="text-center py-12">
                    <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No tracks in this playlist</p>
                  </div>
                ) : (
                  playlistTracks.map((track, idx) => renderTrackRow(track, idx))
                )}
              </ScrollArea>
            </div>
          ) : (
            // Show playlist grid
            <ScrollArea className="flex-1">
              {playlists.length === 0 ? (
                <div className="text-center py-12">
                  <ListMusic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No playlists yet</p>
                  <p className="text-sm text-muted-foreground">
                    Create a custom playlist or import from Spotify
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className="group relative p-3 bg-secondary/50 hover:bg-secondary rounded-lg cursor-pointer transition-colors"
                      onClick={() => handleSelectPlaylist(playlist)}
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-md mb-3 bg-secondary">
                        {playlist.coverArt ? (
                          <img src={playlist.coverArt} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ListMusic className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2">
                          {playlist.sourcePlatform && <SourceIcon source={playlist.sourcePlatform as any} size="sm" />}
                        </div>
                      </div>
                      <h4 className="font-medium text-foreground truncate">{playlist.name}</h4>
                      <p className="text-sm text-muted-foreground">{playlist.trackCount || 0} tracks</p>
                      
                      {/* Delete button */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive bg-background/80"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete playlist?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will delete "{playlist.name}" and remove all track associations. The tracks will remain in your library.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deletePlaylist(playlist.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="upload" className="flex-1 min-h-0 overflow-auto mt-0">
          <LocalUploader />
        </TabsContent>
      </Tabs>

      {/* Artist Profile Panel */}
      {(selectedArtist || isLoadingArtist) && (
        <ArtistProfile 
          artist={selectedArtist}
          isLoading={isLoadingArtist}
          onClose={() => setSelectedArtist(null)}
        />
      )}
    </div>
  );
};
