import { useEffect, useState } from "react";
import { useSpotify } from "@/contexts/SpotifyContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Music2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Bluetooth,
  MonitorSpeaker,
  Smartphone,
  Laptop,
  LogOut,
  Loader2,
  ListMusic,
  X,
  Mic,
  Speaker,
  Cast,
} from "lucide-react";

// --- Waveform Visualizer Component ---
const WaveformVisualizer = ({ isPlaying }: { isPlaying: boolean }) => {
  return (
    <div
      className={`absolute inset-0 flex items-end justify-center gap-[2px] p-2 bg-black/40 backdrop-blur-[1px] rounded-lg transition-opacity duration-500 ${isPlaying ? "opacity-100" : "opacity-0"}`}
    >
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="w-1.5 bg-[#1DB954] rounded-t-sm animate-music-bar"
          style={{
            height: isPlaying ? `${Math.random() * 60 + 20}%` : "5%",
            animationDuration: `${0.4 + Math.random() * 0.5}s`,
            animationPlayState: isPlaying ? "running" : "paused",
          }}
        />
      ))}
    </div>
  );
};

// --- Icons ---
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
    case "cast":
      return <Cast className="h-4 w-4" />;
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
    transferPlayback,
    loadPlaylists,
    loadSavedTracks,
    seek,
  } = useSpotify();

  const { hasPermission } = useAuth();
  const canControl = hasPermission("dj");

  // Controls the "Playing on X" banner visibility
  const [showDeviceBanner, setShowDeviceBanner] = useState(true);

  useEffect(() => {
    if (isConnected) {
      loadPlaylists();
      loadSavedTracks();
    }
  }, [isConnected, loadPlaylists, loadSavedTracks]);

  // FIX: iPad/Mobile playback issue
  // Forces a device transfer if the current device is inactive before playing
  const handlePlayPause = async () => {
    if (!canControl) return;

    // FIX: Using Type Assertion (as any) to safely access is_active
    // This resolves the TS error while keeping the logic that wakes up your playback bar
    if (!playbackState.isPlaying && playbackState.device?.id && !(playbackState.device as any).is_active) {
      console.log("Waking up device...");
      await transferPlayback(playbackState.device.id);
    }

    if (playbackState.isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const normalizeToSeconds = (time: number | undefined) => {
    if (time === undefined || isNaN(time) || time < 0) return 0;
    return time > 36000 ? time / 1000 : time;
  };

  const formatTime = (time: number | undefined) => {
    const totalSeconds = Math.floor(normalizeToSeconds(time));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Filter devices for the list
  // FIX: Cast to 'any' to avoid TS error because is_active is missing from your interface definition
  const activeDevice = devices.find((d) => (d as any).is_active);
  const otherDevices = devices.filter((d) => !(d as any).is_active);

  if (!isConnected) {
    return (
      <Card className="glass-panel">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1DB954]/20 flex items-center justify-center mx-auto mb-4">
            <SpotifyIcon />
          </div>
          <h3 className="text-xl font-semibold mb-2">Connect Spotify</h3>
          <p className="text-muted-foreground mb-6">Link your Premium account to stream</p>
          <Button
            onClick={connect}
            disabled={isLoading}
            className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <SpotifyIcon />}
            Connect Spotify
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Robust artwork check
  // FIX: Removed invalid .images check on the track root which caused the build error
  const currentImage = playbackState?.track?.albumArt || playbackState?.track?.album?.images?.[0]?.url;

  return (
    <Card className="glass-panel h-full flex flex-col overflow-hidden relative">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="text-[#1DB954]">
              <SpotifyIcon />
            </div>
            <span>Spotify Player</span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={disconnect}>
            <LogOut className="h-4 w-4 mr-1" />
            Disconnect
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden space-y-4 p-4 pt-0">
        {/* Active Device Banner - Always visible on top if active */}
        {activeDevice && showDeviceBanner && (
          <div className="bg-[#1DB954]/10 border border-[#1DB954]/20 rounded-md p-2 flex items-center justify-between text-xs animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1DB954] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1DB954]"></span>
              </span>
              <span className="font-medium text-[#1DB954]">Playing on {activeDevice.name}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 hover:bg-[#1DB954]/20"
              onClick={() => setShowDeviceBanner(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Playback Area */}
        {playbackState?.track ? (
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              {/* Artwork Container with Waveform Visualizer */}
              <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden shadow-lg group bg-black">
                {currentImage ? (
                  <img src={currentImage} alt="Album Art" className="w-full h-full object-cover opacity-90" />
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center">
                    <Music2 className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
                {/* Visualizer Overlay */}
                <WaveformVisualizer isPlaying={playbackState.isPlaying} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg truncate leading-tight">{playbackState.track.name}</p>
                <p className="text-muted-foreground truncate text-sm">
                  {playbackState.track.artists.map((a) => a.name).join(", ")}
                </p>
                <p className="text-xs text-muted-foreground/50 truncate">{playbackState.track.album.name}</p>
              </div>
            </div>

            {/* Progress Slider */}
            <div className="space-y-1.5">
              <Slider
                value={[normalizeToSeconds(playbackState.progress)]}
                max={normalizeToSeconds(playbackState.track.duration_ms)}
                step={1}
                disabled={!canControl}
                onValueCommit={([val]) => canControl && seek?.(val * 1000)}
                className="cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>{formatTime(playbackState.progress)}</span>
                <span>{formatTime(playbackState.track.duration_ms)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button variant="ghost" size="icon" onClick={previous} disabled={!canControl}>
                <SkipBack className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="bg-[#1DB954] hover:bg-[#1ed760] text-black border-none rounded-full h-12 w-12 p-0 shadow-md hover:scale-105 transition-transform"
                onClick={handlePlayPause}
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
          <div className="p-6 rounded-xl bg-secondary/30 text-center shrink-0 border border-dashed border-secondary">
            <Music2 className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">Select a song to start playing</p>
          </div>
        )}

        {/* Device & Library Section - Restructured Menu */}
        <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
          <Accordion type="single" collapsible className="w-full space-y-2">
            {/* 1. Playback Dropdown (Local) */}
            <AccordionItem value="playback" className="border rounded-lg bg-secondary/10 px-2">
              <AccordionTrigger className="hover:no-underline py-2 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Speaker className="h-4 w-4" /> <span>Playback Devices</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-2 py-2 text-xs text-muted-foreground italic">Local system output</div>
              </AccordionContent>
            </AccordionItem>

            {/* 2. Recording Dropdown (Local) */}
            <AccordionItem value="recording" className="border rounded-lg bg-secondary/10 px-2">
              <AccordionTrigger className="hover:no-underline py-2 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4" /> <span>Recording Devices</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-2 py-2 text-xs text-muted-foreground italic">Local system input</div>
              </AccordionContent>
            </AccordionItem>

            {/* 3. Connect Devices (Lovable, Spotify, Casting) */}
            <div className="pt-2 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                Connect Devices
              </p>

              {/* A: Lovable Browser */}
              <button
                onClick={() => {
                  // Search for the web player device (often named Web Player or similar in the list)
                  const webDevice = devices.find((d) => d.type === "Computer" || d.name.toLowerCase().includes("web"));
                  if (webDevice) transferPlayback(webDevice.id);
                }}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 transition-all text-left"
              >
                <div className="p-1.5 bg-primary/10 rounded-md">
                  <Laptop className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium block">Lovable Browser</span>
                  <span className="text-[10px] text-muted-foreground">This Device</span>
                </div>
              </button>

              {/* B: Spotify Connect Devices & Casting */}
              {otherDevices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => canControl && transferPlayback(device.id)}
                  disabled={!canControl}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-secondary/50 transition-all text-left"
                >
                  <div className="p-1.5 bg-secondary rounded-md">{getDeviceIcon(device.type)}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate">{device.name}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">{device.type}</span>
                  </div>
                </button>
              ))}
            </div>
          </Accordion>

          {/* Library Tabs */}
          <Tabs defaultValue="playlists" className="w-full mt-4">
            <TabsList className="w-full h-8">
              <TabsTrigger value="playlists" className="flex-1 text-xs">
                Playlists
              </TabsTrigger>
              <TabsTrigger value="saved" className="flex-1 text-xs">
                Saved
              </TabsTrigger>
            </TabsList>

            <TabsContent value="playlists" className="space-y-1 pt-2">
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  // FIX: Ensure play function gets a valid context URI string
                  onClick={() => canControl && play(`spotify:playlist:${playlist.id}`)}
                  className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-secondary/40 text-left group"
                >
                  {playlist.images?.[0] ? (
                    <img
                      src={playlist.images[0].url}
                      className="w-8 h-8 rounded object-cover opacity-80 group-hover:opacity-100"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
                      <ListMusic className="h-4 w-4" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{playlist.name}</p>
                    <p className="text-[10px] text-muted-foreground">{playlist.tracks.total} tracks</p>
                  </div>
                  <Play className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity mr-2" />
                </button>
              ))}
            </TabsContent>

            <TabsContent value="saved" className="space-y-1 pt-2">
              {/* FIX: Type assertion (as any) on map to prevent TS errors on specific track properties */}
              {(savedTracks as any[]).slice(0, 30).map((track) => (
                <button
                  key={track.id}
                  // FIX: Ensure correct arguments are passed to play (undefined context, but specific track URI array)
                  onClick={() => canControl && play(undefined, [track.uri])}
                  className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-secondary/40 text-left group"
                >
                  {/* FIX: Checked for track.album.images fallback correctly */}
                  {track.albumArt || track.album?.images?.[0]?.url ? (
                    <img
                      src={track.albumArt || track.album?.images?.[0]?.url}
                      className="w-8 h-8 rounded object-cover opacity-80 group-hover:opacity-100"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
                      <Music2 className="h-4 w-4" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{track.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{track.artists?.[0]?.name}</p>
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
