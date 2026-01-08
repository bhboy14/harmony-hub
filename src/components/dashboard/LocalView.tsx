import { useState } from "react";
import { Play, Music, FolderOpen, RefreshCw, Loader2, HardDrive, Eye, Search, Volume2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMediaLibrary, Track } from "@/hooks/useMediaLibrary";
import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";

export const LocalView = () => {
  const mediaLibrary = useMediaLibrary();
  const unifiedAudio = useUnifiedAudio();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);

  const handlePlayTrack = (track: Track) => {
    setActiveTrackId(track.id);
    unifiedAudio.playLocalTrack({
      id: track.id,
      title: track.title,
      artist: track.artist || '',
      duration: track.duration,
      url: track.url || '',
      albumArt: track.albumArt || undefined,
    });
  };

  const filteredTracks = mediaLibrary.tracks.filter((track) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      track.title.toLowerCase().includes(query) ||
      (track.artist?.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <HardDrive className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Local Music</h1>
            <p className="text-muted-foreground text-sm">
              {mediaLibrary.folderName 
                ? `Scanning: ${mediaLibrary.folderName}` 
                : "Select a folder to scan for music files"
              }
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={mediaLibrary.selectFolder}
            disabled={mediaLibrary.isScanning}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            {mediaLibrary.folderName ? "Change Folder" : "Select Folder"}
          </Button>
          
          {mediaLibrary.folderName && (
            <>
              <Button 
                onClick={mediaLibrary.needsPermission ? mediaLibrary.requestPermissionAndScan : mediaLibrary.rescanFolder}
                disabled={mediaLibrary.isScanning}
                variant="outline"
                className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
              >
                {mediaLibrary.isScanning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {mediaLibrary.needsPermission ? "Grant Access" : "Rescan"}
              </Button>
              <Button 
                onClick={mediaLibrary.clearSavedFolder}
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </>
          )}
          
          {mediaLibrary.isWatching && (
            <Badge variant="outline" className="text-green-500 border-green-500/30 h-10 px-4">
              <Eye className="h-3 w-3 mr-1" /> Watching for changes
            </Badge>
          )}
        </div>
      </div>

      {/* Stats */}
      {mediaLibrary.tracks.length > 0 && (
        <div className="flex gap-4 flex-wrap">
          <div className="bg-card/40 rounded-xl p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Music className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mediaLibrary.tracks.length}</p>
              <p className="text-xs text-muted-foreground">Tracks found</p>
            </div>
          </div>
          
          {mediaLibrary.folderName && (
            <div className="bg-card/40 rounded-xl p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium truncate max-w-[200px]">{mediaLibrary.folderName}</p>
                <p className="text-xs text-muted-foreground">Current folder</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      {mediaLibrary.tracks.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search your music..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-secondary/30 border-border/50"
          />
        </div>
      )}

      {/* Track List */}
      {filteredTracks.length > 0 ? (
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wide border-b border-border/50">
            <span className="w-10">#</span>
            <span>Title</span>
            <span className="hidden sm:block w-24 text-right">Duration</span>
            <span className="w-10"></span>
          </div>
          
          {/* Tracks */}
          {filteredTracks.map((track, idx) => (
            <div
              key={track.id}
              className={`group grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 rounded-lg cursor-pointer transition-all ${
                activeTrackId === track.id 
                  ? 'bg-amber-500/20' 
                  : 'hover:bg-secondary/50'
              }`}
              onClick={() => handlePlayTrack(track)}
            >
              {/* Index / Play */}
              <div className="w-10 flex items-center justify-center">
                {activeTrackId === track.id ? (
                  <Volume2 className="h-4 w-4 text-amber-500 animate-pulse" />
                ) : (
                  <>
                    <span className="text-sm text-muted-foreground group-hover:hidden">{idx + 1}</span>
                    <Play className="h-4 w-4 hidden group-hover:block text-amber-500" />
                  </>
                )}
              </div>
              
              {/* Track Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-secondary">
                  {track.albumArt ? (
                    <img src={track.albumArt} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-amber-500/20">
                      <Music className="h-4 w-4 text-amber-500" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`font-medium truncate ${activeTrackId === track.id ? 'text-amber-500' : ''}`}>
                    {track.title}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">{track.artist || 'Unknown Artist'}</p>
                </div>
              </div>
              
              {/* Duration */}
              <span className="hidden sm:flex items-center text-sm text-muted-foreground w-24 justify-end">
                {track.duration}
              </span>
              
              {/* Actions */}
              <div className="w-10 flex items-center justify-center">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayTrack(track);
                  }}
                >
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : mediaLibrary.folderName ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Music className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No music found</p>
          <p className="text-sm">The selected folder doesn't contain any supported audio files</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-20 w-20 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-6">
            <FolderOpen className="h-10 w-10 text-amber-500" />
          </div>
          <h3 className="text-xl font-bold mb-2">No folder selected</h3>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Select a folder containing your music files (MP3, WAV, FLAC, M4A, AAC, OGG) to start listening.
          </p>
          <Button 
            onClick={mediaLibrary.selectFolder}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Select Folder
          </Button>
        </div>
      )}
    </div>
  );
};
