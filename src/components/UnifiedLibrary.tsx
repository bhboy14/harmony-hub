import { useState } from "react";
import { Play, Pause, Trash2, Music, Search, Filter, Loader2, ListPlus, ListEnd } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUnifiedLibrary, UnifiedTrack } from "@/hooks/useUnifiedLibrary";
import { LocalUploader } from "@/components/LocalUploader";
import { SourceIcon } from "@/components/SourceIcon";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

interface UnifiedLibraryProps {
  onOpenSpotify?: () => void;
  onOpenYouTube?: () => void;
}

export const UnifiedLibrary = ({ onOpenSpotify, onOpenYouTube }: UnifiedLibraryProps) => {
  const { tracks, isLoading, deleteTrack, loadTracks } = useUnifiedLibrary();
  const unifiedAudio = useUnifiedAudio();
  const spotify = useSpotify();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<'all' | 'spotify' | 'youtube' | 'local' | 'soundcloud'>('all');

  // Filter tracks
  const filteredTracks = tracks.filter(track => {
    const matchesSearch = 
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (track.artist?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSource = sourceFilter === 'all' || track.source === sourceFilter;
    
    return matchesSearch && matchesSource;
  });

  // Group by source for stats
  const spotifyTracks = tracks.filter(t => t.source === 'spotify');
  const youtubeTracks = tracks.filter(t => t.source === 'youtube');
  const localTracks = tracks.filter(t => t.source === 'local');

  const playTrack = (track: UnifiedTrack) => {
    if (track.source === 'spotify' && track.externalId) {
      spotify.play(undefined, [track.externalId]);
    } else if (track.source === 'youtube' && track.externalId) {
      unifiedAudio.playYouTubeVideo(track.externalId, track.title);
    } else if (track.source === 'local' && track.localUrl) {
      // Format duration from ms to M:SS
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
      toast({
        title: "Playing next",
        description: `"${track.title}" will play next`,
      });
    } else {
      unifiedAudio.addToQueue(queueTrack);
      toast({
        title: "Added to queue",
        description: `"${track.title}" added to queue`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Unified Library</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {tracks.length} tracks from all sources
          </p>
        </div>
        <Button variant="outline" onClick={loadTracks} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {/* Source Stats */}
      <div className="grid grid-cols-3 gap-4">
        <button
          className={`p-4 rounded-lg border transition-all ${
            sourceFilter === 'spotify' 
              ? 'border-[#1DB954] bg-[#1DB954]/10' 
              : 'border-border bg-secondary/50 hover:bg-secondary'
          }`}
          onClick={() => setSourceFilter(sourceFilter === 'spotify' ? 'all' : 'spotify')}
        >
          <div className="flex items-center gap-2">
            <SourceIcon source="spotify" showTooltip={false} />
            <span className="font-medium text-foreground">Spotify</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{spotifyTracks.length}</p>
        </button>

        <button
          className={`p-4 rounded-lg border transition-all ${
            sourceFilter === 'youtube' 
              ? 'border-[#FF0000] bg-[#FF0000]/10' 
              : 'border-border bg-secondary/50 hover:bg-secondary'
          }`}
          onClick={() => setSourceFilter(sourceFilter === 'youtube' ? 'all' : 'youtube')}
        >
          <div className="flex items-center gap-2">
            <SourceIcon source="youtube" showTooltip={false} />
            <span className="font-medium text-foreground">YouTube</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{youtubeTracks.length}</p>
        </button>

        <button
          className={`p-4 rounded-lg border transition-all ${
            sourceFilter === 'local' 
              ? 'border-primary bg-primary/10' 
              : 'border-border bg-secondary/50 hover:bg-secondary'
          }`}
          onClick={() => setSourceFilter(sourceFilter === 'local' ? 'all' : 'local')}
        >
          <div className="flex items-center gap-2">
            <SourceIcon source="local" showTooltip={false} />
            <span className="font-medium text-foreground">Local</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{localTracks.length}</p>
        </button>
      </div>

      <Tabs defaultValue="tracks" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="tracks">All Tracks</TabsTrigger>
          <TabsTrigger value="upload">Upload Local</TabsTrigger>
        </TabsList>

        <TabsContent value="tracks" className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search your library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary border-0"
            />
          </div>

          {/* Track List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="text-center py-12">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {tracks.length === 0 
                  ? "Your library is empty. Add tracks from Spotify, YouTube, or upload local files."
                  : "No tracks match your search."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTracks.map((track, index) => (
                <div
                  key={track.id}
                  className={`group flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/80 transition-colors cursor-pointer ${
                    isCurrentTrack(track) ? 'bg-secondary' : ''
                  }`}
                  onClick={() => playTrack(track)}
                >
                  {/* Index / Play Button */}
                  <div className="w-8 text-center">
                    <span className="group-hover:hidden text-sm text-muted-foreground">
                      {isCurrentTrack(track) && unifiedAudio.isPlaying ? (
                        <span className="text-primary">▶</span>
                      ) : (
                        index + 1
                      )}
                    </span>
                    <Play className="h-4 w-4 hidden group-hover:block mx-auto text-foreground" />
                  </div>

                  {/* Album Art */}
                  <div className="w-10 h-10 rounded overflow-hidden bg-secondary flex-shrink-0">
                    {track.albumArt ? (
                      <img src={track.albumArt} alt={track.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium truncate ${isCurrentTrack(track) ? 'text-primary' : 'text-foreground'}`}>
                        {track.title}
                      </p>
                      <SourceIcon source={track.source} size="sm" />
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{track.artist || 'Unknown Artist'}</p>
                  </div>

                  {/* Duration */}
                  <span className="text-sm text-muted-foreground">
                    {formatDuration(track.durationMs)}
                  </span>

                  {/* Queue Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => addTrackToQueue(track, true)}>
                        <ListPlus className="h-4 w-4 mr-2" />
                        Play Next
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addTrackToQueue(track, false)}>
                        <ListEnd className="h-4 w-4 mr-2" />
                        Add to Queue
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Delete Button */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                        <AlertDialogAction onClick={() => deleteTrack(track.id)}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upload">
          <LocalUploader />
        </TabsContent>
      </Tabs>
    </div>
  );
};
