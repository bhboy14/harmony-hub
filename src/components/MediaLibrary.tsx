import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  Music, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  HardDrive, 
  Cloud, 
  Search,
  ListMusic,
  MoreVertical,
  FolderOpen,
  RefreshCw,
  Loader2,
  X,
  Key
} from "lucide-react";
import { Track, Playlist } from "@/hooks/useMediaLibrary";
import { useState } from "react";

interface MediaLibraryProps {
  localTracks: Track[];
  streamingTracks: Track[];
  playlists: Playlist[];
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  setVolume: (v: number) => void;
  playTrack: (track: Track) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  selectFolder?: () => void;
  rescanFolder?: () => void;
  clearSavedFolder?: () => void;
  requestPermissionAndScan?: () => Promise<boolean>;
  isScanning?: boolean;
  folderName?: string | null;
  hasSavedFolder?: boolean;
  needsPermission?: boolean;
  isFileSystemSupported?: boolean;
}

export const MediaLibrary = ({
  localTracks,
  streamingTracks,
  playlists,
  currentTrack,
  isPlaying,
  volume,
  setVolume,
  playTrack,
  pauseTrack,
  resumeTrack,
  selectFolder,
  rescanFolder,
  clearSavedFolder,
  requestPermissionAndScan,
  isScanning = false,
  folderName = null,
  hasSavedFolder = false,
  needsPermission = false,
  isFileSystemSupported = true,
}: MediaLibraryProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filterTracks = (tracks: Track[]) => {
    if (!searchQuery) return tracks;
    const query = searchQuery.toLowerCase();
    return tracks.filter(
      t => t.title.toLowerCase().includes(query) || 
           t.artist.toLowerCase().includes(query)
    );
  };

  const TrackList = ({ tracks }: { tracks: Track[] }) => {
    const filtered = filterTracks(tracks);
    
    if (filtered.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {tracks.length === 0 ? (
            <div className="space-y-2">
              <Music className="h-12 w-12 mx-auto opacity-50" />
              <p>No tracks found</p>
              {selectFolder && (
                <Button variant="outline" onClick={selectFolder} className="mt-2">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Select Folder
                </Button>
              )}
            </div>
          ) : (
            <p>No matches for "{searchQuery}"</p>
          )}
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        {filtered.map((track) => (
          <div
            key={track.id}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer ${
              currentTrack?.id === track.id
                ? "bg-primary/20 border border-primary/30"
                : "bg-secondary/30 hover:bg-secondary/50"
            }`}
            onClick={() => playTrack(track)}
          >
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              {currentTrack?.id === track.id && isPlaying ? (
                <div className="flex items-center gap-0.5">
                  <div className="w-1 h-4 bg-primary animate-pulse rounded" />
                  <div className="w-1 h-3 bg-primary animate-pulse rounded delay-75" />
                  <div className="w-1 h-5 bg-primary animate-pulse rounded delay-150" />
                </div>
              ) : (
                <Music className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate ${currentTrack?.id === track.id ? "text-primary" : "text-foreground"}`}>
                {track.title}
              </p>
              <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
            </div>
            <span className="text-xs text-muted-foreground">{track.duration}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="glass-panel h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ListMusic className="h-5 w-5 text-accent" />
            Media Library
          </CardTitle>
          {folderName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
              {folderName}
            </div>
          )}
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search tracks..." 
            className="pl-9 bg-secondary/50 border-border/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <Tabs defaultValue="local" className="flex-1 flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="local" className="flex-1 gap-2">
              <HardDrive className="h-4 w-4" />
              Local ({localTracks.length})
            </TabsTrigger>
            <TabsTrigger value="streaming" className="flex-1 gap-2">
              <Cloud className="h-4 w-4" />
              Streaming
            </TabsTrigger>
            <TabsTrigger value="playlists" className="flex-1 gap-2">
              <ListMusic className="h-4 w-4" />
              Playlists
            </TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-y-auto mt-4 pr-2">
            <TabsContent value="local" className="m-0 space-y-4">
              {/* Saved Folder Permission Banner */}
              {isFileSystemSupported && hasSavedFolder && needsPermission && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Saved Folder: {folderName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Grant permission to access your music folder
                  </p>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={requestPermissionAndScan}
                      disabled={isScanning}
                    >
                      {isScanning ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Key className="h-4 w-4 mr-2" />
                      )}
                      Grant Access
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={clearSavedFolder}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Folder Controls */}
              {isFileSystemSupported && (!hasSavedFolder || !needsPermission) && (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    onClick={selectFolder}
                    disabled={isScanning}
                    className="flex-1"
                  >
                    {isScanning ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FolderOpen className="h-4 w-4 mr-2" />
                    )}
                    {folderName ? "Change Folder" : "Select Folder"}
                  </Button>
                  {folderName && !needsPermission && (
                    <>
                      <Button 
                        variant="outline" 
                        onClick={rescanFolder}
                        disabled={isScanning}
                        title="Rescan for new files"
                      >
                        {isScanning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        onClick={clearSavedFolder}
                        title="Clear saved folder"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              )}
              
              {!isFileSystemSupported && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-muted-foreground">
                  Your browser doesn't support local file access. Please use Chrome or Edge for this feature.
                </div>
              )}
              
              <TrackList tracks={localTracks} />
            </TabsContent>
            <TabsContent value="streaming" className="m-0">
              <div className="text-center py-8 text-muted-foreground">
                <Cloud className="h-12 w-12 mx-auto opacity-50 mb-2" />
                <p>Use the Spotify tab to access streaming music</p>
              </div>
            </TabsContent>
            <TabsContent value="playlists" className="m-0">
              <div className="space-y-3">
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                        <ListMusic className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{playlist.name}</p>
                        <p className="text-sm text-muted-foreground">{playlist.tracks.length} tracks</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Now Playing Bar */}
        {currentTrack && (
          <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                {isPlaying ? (
                  <div className="flex items-center gap-0.5">
                    <div className="w-1 h-4 bg-primary animate-pulse rounded" />
                    <div className="w-1 h-3 bg-primary animate-pulse rounded delay-75" />
                    <div className="w-1 h-5 bg-primary animate-pulse rounded delay-150" />
                  </div>
                ) : (
                  <Music className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{currentTrack.title}</p>
                <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button
                  variant="glow"
                  size="icon"
                  onClick={() => (isPlaying ? pauseTrack() : resumeTrack())}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[volume]}
                max={100}
                step={1}
                onValueChange={([v]) => setVolume(v)}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-8">{volume}%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};