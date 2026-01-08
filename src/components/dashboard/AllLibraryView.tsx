import { useState } from "react";
import { Play, Music, Plus, Search, MoreHorizontal, ListPlus, ListEnd, ListMusic, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useUnifiedLibrary, UnifiedTrack } from "@/hooks/useUnifiedLibrary";
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

export const AllLibraryView = () => {
  const { toast } = useToast();
  const spotify = useSpotify();
  const unifiedAudio = useUnifiedAudio();
  const mediaLibrary = useMediaLibrary();
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

  const allTracks: UnifiedTrack[] = [...dbTracks];
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Your Library</h1>
            <p className="text-muted-foreground text-sm">{allTracks.length} tracks from all sources</p>
          </div>
          <div className="flex gap-2">
            <LocalUploader />
            <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Playlist
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search your library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-secondary/30 border-border/50"
            />
          </div>
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'spotify', label: 'Spotify' },
              { key: 'youtube', label: 'YouTube' },
              { key: 'local', label: 'Local' },
            ].map((f) => (
              <Button
                key={f.key}
                variant={sourceFilter === f.key ? "default" : "outline"}
                size="sm"
                className="rounded-full h-9"
                onClick={() => setSourceFilter(f.key as any)}
              >
                {f.label}
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {counts[f.key as keyof typeof counts]}
                </Badge>
              </Button>
            ))}
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

      {/* Track List */}
      {filteredTracks.length > 0 ? (
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wide border-b border-border/50">
            <span className="w-8">#</span>
            <span>Title</span>
            <span className="hidden md:block w-20 text-center">Source</span>
            <span className="hidden sm:block w-16 text-right">Duration</span>
            <span className="w-8"></span>
          </div>
          
          {/* Tracks */}
          {filteredTracks.map((track, idx) => (
            <div
              key={track.id}
              className="group grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2.5 rounded-lg hover:bg-secondary/50 cursor-pointer transition-all"
              onClick={() => playTrack(track)}
            >
              <div className="w-8 flex items-center justify-center">
                <span className="text-sm text-muted-foreground group-hover:hidden">{idx + 1}</span>
                <Play className="h-4 w-4 hidden group-hover:block text-primary" />
              </div>
              
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-secondary">
                  {track.albumArt ? (
                    <img src={track.albumArt} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{track.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artist || 'Unknown'}</p>
                </div>
              </div>
              
              <div className="hidden md:flex items-center justify-center w-20">
                <SourceIcon source={track.source} size="sm" />
              </div>
              
              <span className="hidden sm:flex items-center text-xs text-muted-foreground w-16 justify-end">
                {formatDuration(track.durationMs)}
              </span>
              
              <div className="w-8 flex items-center justify-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 opacity-0 group-hover:opacity-100" 
                      onClick={(e) => e.stopPropagation()}
                    >
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
                    {!track.id.startsWith('local-folder-') && (
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
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Music className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No tracks found</p>
          <p className="text-sm">Import from Spotify, YouTube, or upload local files</p>
        </div>
      )}

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
