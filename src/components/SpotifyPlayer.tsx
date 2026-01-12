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
  Lock,
} from "lucide-react";

// Spotify brand icon
const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

const getDeviceIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case "computer":
      return <Laptop className="h-4 w-4" />;
    case "smartphone":
      return <Smartphone className="h-4 w-4" />;
    case "speaker":
      return <MonitorSpeaker className="h-4 w-4" />;
    default:
      return <Bluetooth className="h-4 w-4" />;
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
    seek, // Ensure seek is available from context
  } = useSpotify();

  const { hasPermission } = useAuth();
  const canControl = hasPermission("dj");

  useEffect(() => {
    if (isConnected) {
      loadPlaylists();
      loadSavedTracks();
    }
  }, [isConnected, loadPlaylists, loadSavedTracks]);

  // FIX: Normalization helper for inconsistent time units
  const normalizeToSeconds = (time: number | undefined) => {
    if (time === undefined || isNaN(time) || time < 0) return 0;
    // If time is > 36000 (10 hours in seconds), it's milliseconds from Spotify
    return time > 36000 ? time / 1000 : time;
  };

  const formatTime = (time: number | undefined) => {
    const totalSeconds = Math.floor(normalizeToSeconds(time));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <SpotifyIcon />}
            Connect with Spotify
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-4 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="text-[#1DB954]">
              <SpotifyIcon />
            </div>
            Spotify Player
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={disconnect}>
            <LogOut className="h-4 w-4 mr-1" />
            Disconnect
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden space-y-4">
        {/* Now Playing Section */}
        {playbackState?.track ? (
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#1DB954]/20 to-primary/10 border border-[#1DB954]/30 shrink-0">
            <div className="flex gap-4">
              {(playbackState.track.albumArt || playbackState.track.album?.images?.[0]?.url) && (
                <img
                  src={playbackState.track.albumArt || playbackState.track.album?.images?.[0]?.url}
                  alt="Album art"
                  className="w-20 h-20 rounded-lg shadow-lg object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg truncate">{playbackState.track.name}</p>
                <p className="text-muted-foreground truncate">
                  {playbackState.track.artists.map((a) => a.name).join(", ")}
                </p>
                <p className="text-xs text-muted-foreground truncate">{playbackState.track.album.name}</p>
              </div>
            </div>

            {/* Progress bar FIX */}
            <div className="mt-4 space-y-2">
              <Slider
                value={[normalizeToSeconds(playbackState.progress)]}
                max={normalizeToSeconds(playbackState.track.duration_ms)}
                step={1}
                disabled={!canControl}
                onValueCommit={([val]) => canControl && seek?.(val * 1000)}
                className="cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>{formatTime(playbackState.progress)}</span>
                <span>{formatTime(playbackState.track.duration_ms)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 mt-2">
              <Button variant="ghost" size="icon" onClick={previous} disabled={!canControl}>
                <SkipBack className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="bg-[#1DB954] hover:bg-[#1ed760] text-black border-none rounded-full h-12 w-12 p-0"
                onClick={() => (playbackState.isPlaying ? pause() : play())}
                disabled={!canControl}
              >
                {playbackState.isPlaying ? (
                  <Pause className="h-6 w-6 fill-current" />
                ) : (
                  <Play className="h-6 w-6 fill-current ml-0.5" />
                )}
              </Button>
              <Button variant="ghost" size="icon" onClick={next} disabled={!canControl}>
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-secondary/30 text-center shrink-0">
            <Music2 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No active playback</p>
          </div>
        )}

        {/* Devices and Library - Wrapped in scrollable container to prevent overflow */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-1">
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
                    <span className="flex-1 text-left text-sm truncate">{device.name}</span>
                    {device.is_active && <span className="text-xs text-[#1DB954]">Playing</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Playlists & Library */}
          <Tabs defaultValue="playlists" className="w-full">
            <TabsList className="w-full sticky top-0 z-10 bg-background/95 backdrop-blur">
              <TabsTrigger value="playlists" className="flex-1">
                Playlists
              </TabsTrigger>
              <TabsTrigger value="saved" className="flex-1">
                Saved Tracks
              </TabsTrigger>
            </TabsList>

            <TabsContent value="playlists" className="mt-2 space-y-2">
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => canControl && play(`spotify:playlist:${playlist.id}`)}
                  disabled={!canControl}
                  className="w-full flex items-center gap-3 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all"
                >
                  {playlist.images[0] ? (
                    <img src={playlist.images[0].url} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                      <ListMusic className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate text-sm">{playlist.name}</p>
                    <p className="text-xs text-muted-foreground">{playlist.tracks.total} tracks</p>
                  </div>
                </button>
              ))}
            </TabsContent>

            <TabsContent value="saved" className="mt-2 space-y-2">
              {savedTracks.slice(0, 20).map((track) => (
                <button
                  key={track.id}
                  onClick={() => canControl && play(undefined, [track.uri])}
                  disabled={!canControl}
                  className="w-full flex items-center gap-3 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all"
                >
                  {(track.albumArt || track.album?.images?.[0]?.url) ? (
                    <img src={track.albumArt || track.album?.images?.[0]?.url} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                      <Music2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate text-sm">{track.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {track.artists.map((a) => a.name).join(", ")}
                    </p>
                  </div>
                </button>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
};
