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
  MoreVertical
} from "lucide-react";
import { Track, Playlist } from "@/hooks/useMediaLibrary";

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
}: MediaLibraryProps) => {
  const TrackList = ({ tracks }: { tracks: Track[] }) => (
    <div className="space-y-2">
      {tracks.map((track) => (
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
            <Music className="h-5 w-5 text-muted-foreground" />
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

  return (
    <Card className="glass-panel h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ListMusic className="h-5 w-5 text-accent" />
            Media Library
          </CardTitle>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search tracks..." 
            className="pl-9 bg-secondary/50 border-border/50"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <Tabs defaultValue="local" className="flex-1 flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="local" className="flex-1 gap-2">
              <HardDrive className="h-4 w-4" />
              Local
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
            <TabsContent value="local" className="m-0">
              <TrackList tracks={localTracks} />
            </TabsContent>
            <TabsContent value="streaming" className="m-0">
              <TrackList tracks={streamingTracks} />
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
                <Music className="h-6 w-6 text-primary" />
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
