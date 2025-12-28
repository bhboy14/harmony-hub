import { useEffect } from "react";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Music2, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Bluetooth,
  MonitorSpeaker,
  Smartphone,
  Laptop,
  LogOut,
  Loader2,
  ListMusic,
  Lock
} from "lucide-react";

// Spotify brand icon
const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const getDeviceIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case "computer": return <Laptop className="h-4 w-4" />;
    case "smartphone": return <Smartphone className="h-4 w-4" />;
    case "speaker": return <MonitorSpeaker className="h-4 w-4" />;
    default: return <Bluetooth className="h-4 w-4" />;
  }
};

export const SpotifyPlayer = () => {
  const { 
    isConnected, 
    isLoading, 
    playbackState, 
    devices,
    playlists,
    savedTracks,
    connect, 
    disconnect,
    play,
    pause,
    next,
    previous,
    setVolume,
    transferPlayback,
    loadPlaylists,
    loadSavedTracks,
  } = useSpotify();
  
  const { hasPermission } = useAuth();
  const canControl = hasPermission('dj');

  useEffect(() => {
    if (isConnected) {
      loadPlaylists();
      loadSavedTracks();
    }
  }, [isConnected, loadPlaylists, loadSavedTracks]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!isConnected) {
    return (
      <Card className="glass-panel">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1DB954]/20 flex items-center justify-center mx-auto mb-4">
            <SpotifyIcon />
          </div>
          <h3 className="text-xl font-semibold mb-2">Connect Spotify</h3>
          <p className="text-muted-foreground mb-6">
            Link your Spotify Premium account to stream music and control playback
          </p>
          <Button 
            onClick={connect} 
            disabled={isLoading}
            className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <SpotifyIcon />
            )}
            Connect with Spotify
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="text-[#1DB954]"><SpotifyIcon /></div>
            Spotify Player
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={disconnect}>
            <LogOut className="h-4 w-4 mr-1" />
            Disconnect
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden space-y-4">
        {/* Now Playing */}
        {playbackState?.track ? (
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#1DB954]/20 to-primary/10 border border-[#1DB954]/30">
            <div className="flex gap-4">
              {playbackState.track.album.images[0] && (
                <img 
                  src={playbackState.track.album.images[0].url} 
                  alt="Album art"
                  className="w-20 h-20 rounded-lg shadow-lg"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg truncate">{playbackState.track.name}</p>
                <p className="text-muted-foreground truncate">
                  {playbackState.track.artists.map(a => a.name).join(", ")}
                </p>
                <p className="text-xs text-muted-foreground truncate">{playbackState.track.album.name}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 space-y-1">
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#1DB954] transition-all duration-1000"
                  style={{ width: `${(playbackState.progress / playbackState.track.duration_ms) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(playbackState.progress)}</span>
                <span>{formatTime(playbackState.track.duration_ms)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <Button variant="ghost" size="icon" onClick={previous} disabled={!canControl}>
                <SkipBack className="h-5 w-5" />
              </Button>
              <Button 
                variant="glow" 
                size="lg"
                className="bg-[#1DB954] hover:bg-[#1ed760] text-black disabled:opacity-50"
                onClick={() => playbackState.isPlaying ? pause() : play()}
                disabled={!canControl}
              >
                {playbackState.isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={next} disabled={!canControl}>
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>
            {!canControl && (
              <p className="text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" /> Only DJs and Admins can control playback
              </p>
            )}

            {/* Volume */}
            <div className="flex items-center gap-3 mt-4">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[playbackState.volume]}
                max={100}
                step={1}
                onValueChange={([v]) => setVolume(v)}
                className="flex-1"
                disabled={!canControl}
              />
              <span className="text-xs text-muted-foreground w-8">{playbackState.volume}%</span>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-secondary/30 text-center">
            <Music2 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No active playback</p>
            <p className="text-xs text-muted-foreground mt-1">Start playing on any Spotify device</p>
          </div>
        )}

        {/* Devices */}
        {devices.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Available Devices</p>
            <div className="grid gap-2">
              {devices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => canControl && transferPlayback(device.id)}
                  disabled={!canControl}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                    device.is_active 
                      ? "bg-[#1DB954]/20 border border-[#1DB954]/30" 
                      : "bg-secondary/30 hover:bg-secondary/50"
                  } ${!canControl ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {getDeviceIcon(device.type)}
                  <span className="flex-1 text-left text-sm">{device.name}</span>
                  {device.is_active && (
                    <span className="text-xs text-[#1DB954]">Playing</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Playlists & Library */}
        <Tabs defaultValue="playlists" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full">
            <TabsTrigger value="playlists" className="flex-1">Playlists</TabsTrigger>
            <TabsTrigger value="saved" className="flex-1">Saved Tracks</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-y-auto mt-2">
            <TabsContent value="playlists" className="m-0">
              <div className="space-y-2">
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={() => canControl && play(`spotify:playlist:${playlist.id}`)}
                    disabled={!canControl}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all ${!canControl ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {playlist.images[0] ? (
                      <img src={playlist.images[0].url} alt="" className="w-10 h-10 rounded" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                        <ListMusic className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium truncate">{playlist.name}</p>
                      <p className="text-xs text-muted-foreground">{playlist.tracks.total} tracks</p>
                    </div>
                  </button>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="saved" className="m-0">
              <div className="space-y-2">
                {savedTracks.slice(0, 20).map((track) => (
                  <button
                    key={track.id}
                    onClick={() => canControl && play(undefined, [track.uri])}
                    disabled={!canControl}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all ${!canControl ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {track.album.images[0] ? (
                      <img src={track.album.images[0].url} alt="" className="w-10 h-10 rounded" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                        <Music2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium truncate">{track.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {track.artists.map(a => a.name).join(", ")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
};
