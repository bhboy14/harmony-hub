import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, Play, Pause, SkipForward, SkipBack, Library, Youtube, HardDrive, ExternalLink } from "lucide-react";
import { useSpotify } from "@/contexts/SpotifyContext";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

interface QuickLibraryProps {
  onOpenFullLibrary: () => void;
}

export const QuickLibrary = ({ onOpenFullLibrary }: QuickLibraryProps) => {
  const spotify = useSpotify();
  const { playbackState, isConnected, play, pause, next, previous, connect } = spotify;

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Library className="h-5 w-5 text-primary" />
            Quick Library
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onOpenFullLibrary} className="text-xs gap-1">
            Open Full <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source Buttons */}
        <div className="flex gap-2">
          <Button 
            variant={isConnected ? "default" : "outline"} 
            size="sm" 
            className="flex-1 gap-2"
            style={isConnected ? { backgroundColor: "#1DB954" } : {}}
            onClick={() => !isConnected && connect()}
          >
            <SpotifyIcon />
            Spotify
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={onOpenFullLibrary}>
            <Youtube className="h-4 w-4 text-[#FF0000]" />
            YouTube
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={onOpenFullLibrary}>
            <HardDrive className="h-4 w-4" />
            Local
          </Button>
        </div>

        {/* Now Playing / Connect Prompt */}
        {isConnected && playbackState?.track ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-[#1DB954]/10 to-primary/5 border border-[#1DB954]/20">
              {playbackState.track.album.images[0] && (
                <img 
                  src={playbackState.track.album.images[0].url}
                  alt=""
                  className="w-14 h-14 rounded-lg shadow-md"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {playbackState.track.name}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {playbackState.track.artists.map(a => a.name).join(", ")}
                </p>
              </div>
            </div>
            
            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-2">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={previous}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                className="h-11 w-11 rounded-full"
                style={{ backgroundColor: "#1DB954" }}
                onClick={() => playbackState.isPlaying ? pause() : play()}
              >
                {playbackState.isPlaying ? (
                  <Pause className="h-5 w-5 text-black" />
                ) : (
                  <Play className="h-5 w-5 text-black ml-0.5" />
                )}
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={next}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : isConnected ? (
          <div className="text-center py-4 text-muted-foreground">
            <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No track playing</p>
            <p className="text-xs">Start playing on any Spotify device</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-[#1DB954] mx-auto mb-2"><SpotifyIcon /></div>
            <p className="text-sm text-muted-foreground mb-3">Connect to control playback</p>
            <Button 
              size="sm" 
              onClick={connect}
              style={{ backgroundColor: "#1DB954" }}
              className="text-black"
            >
              Connect Spotify
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
