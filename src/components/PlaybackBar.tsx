import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { useSpotify } from "@/contexts/SpotifyContext";
import { usePA } from "@/contexts/PAContext";
import { useCasting } from "@/contexts/CastingContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Repeat,
  Repeat1,
  Shuffle,
  MonitorSpeaker,
  Laptop,
  Smartphone,
  Speaker,
  Tv,
  Check,
  RefreshCw,
  Mic,
  MicOff,
  Music,
  HardDrive,
  Youtube,
  Maximize2,
  ListMusic,
  Airplay,
  Cast,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { QueuePanel } from "@/components/QueuePanel";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

const getDeviceIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case "computer":
      return Laptop;
    case "smartphone":
      return Smartphone;
    case "speaker":
      return Speaker;
    case "tv":
      return Tv;
    default:
      return MonitorSpeaker;
  }
};

const getSourceIcon = (source: string | null) => {
  switch (source) {
    case "spotify":
      return <SpotifyIcon />;
    case "local":
      return <HardDrive className="h-4 w-4" />;
    case "youtube":
      return <Youtube className="h-4 w-4 text-[#FF0000]" />;
    default:
      return <Music className="h-4 w-4" />;
  }
};

export const PlaybackBar = () => {
  const { hasPermission } = useAuth();
  const unified = useUnifiedAudio();
  const spotify = useSpotify();
  const { isLive, audioLevel, toggleBroadcast } = usePA();
  const casting = useCasting();

  const [queueOpen, setQueueOpen] = useState(false);
  const canControl = hasPermission("dj");

  const {
    activeSource,
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    isMuted,
    play,
    pause,
    next,
    previous,
    queue,
    queueHistory,
    currentQueueIndex,
    upcomingTracks,
    shuffle,
    repeat,
    removeFromQueue,
    clearQueue,
    clearUpcoming,
    playQueueTrack,
    toggleShuffle,
    toggleRepeat,
    setGlobalVolume,
    toggleMute,
  } = unified;

  const {
    isConnected: spotifyConnected,
    devices,
    webPlayerReady,
    playbackState,
    transferPlayback,
    refreshPlaybackState,
    activateWebPlayer,
    connect,
  } = spotify;

  // HELPER: Detects if input is ms (Spotify) or s (Local) and returns pretty string
  const formatTime = (time: number | undefined) => {
    if (time === undefined || isNaN(time) || time < 0) return "0:00";
    const totalSeconds = time > 36000 ? Math.floor(time / 1000) : Math.floor(time);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // HELPER: Normalizes any time input to seconds for the Slider UI
  const toSeconds = (time: number | undefined) => {
    if (!time) return 0;
    return time > 36000 ? time / 1000 : time;
  };

  const handlePlayPause = async () => {
    if (!canControl) return;
    isPlaying ? await pause() : await play();
  };

  const handleSeek = async (value: number[]) => {
    if (!canControl) return;
    // If Spotify is active, we must send milliseconds back to the API
    const seekTarget = activeSource === "spotify" ? value[0] * 1000 : value[0];
    await unified.seek(seekTarget);
  };

  if (!activeSource && !spotifyConnected) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-[90px] bg-black border-t border-border z-50 flex items-center justify-center gap-4">
        <Music className="h-5 w-5 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Connect a source to play music</p>
        <Button onClick={connect} size="sm" className="bg-primary rounded-full px-6 gap-2">
          <SpotifyIcon /> Connect Spotify
        </Button>
      </div>
    );
  }

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[90px] bg-black border-t border-border z-50">
      <div className="h-full grid grid-cols-3 items-center px-4">
        {/* Left: Track Info */}
        <div className="flex items-center gap-3 min-w-0">
          {currentTrack ? (
            <>
              <img
                src={currentTrack.albumArt || ""}
                className="w-14 h-14 rounded shadow-lg object-cover bg-secondary"
                alt=""
              />
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate text-sm">{currentTrack.title}</p>
                <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No track playing</p>
          )}
        </div>

        {/* Center: Playback Controls */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleShuffle}
              className={shuffle ? "text-primary" : "text-muted-foreground"}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => previous()} disabled={!activeSource}>
              <SkipBack className="h-4 w-4 fill-current" />
            </Button>
            <Button
              size="icon"
              onClick={handlePlayPause}
              className="h-8 w-8 rounded-full bg-foreground text-background"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current ml-0.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => next()} disabled={!activeSource}>
              <SkipForward className="h-4 w-4 fill-current" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleRepeat}
              className={repeat !== "off" ? "text-primary" : "text-muted-foreground"}
            >
              {repeat === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full max-w-[600px]">
            <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">{formatTime(progress)}</span>
            <Slider
              value={[toSeconds(progress)]}
              max={toSeconds(duration) || 100}
              step={1}
              onValueChange={handleSeek}
              disabled={!canControl}
              className="cursor-pointer"
            />
            <span className="text-xs text-muted-foreground w-10 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Tools & Volume */}
        <div className="flex items-center justify-end gap-2">
          {isLive && <div className="text-destructive animate-pulse text-xs font-bold mr-2">LIVE</div>}
          <Button variant="ghost" size="icon" onClick={() => setQueueOpen(true)} className="relative">
            <ListMusic className="h-4 w-4" />
            {queue.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {queue.length}
              </span>
            )}
          </Button>
          <div className="flex items-center gap-2 w-32">
            <VolumeIcon className="h-4 w-4 text-muted-foreground" onClick={toggleMute} />
            <Slider
              value={[isMuted ? 0 : volume]}
              max={100}
              onValueChange={(v) => setGlobalVolume(v[0])}
              className="w-24"
            />
          </div>
        </div>
      </div>
      <QueuePanel
        isOpen={queueOpen}
        onOpenChange={setQueueOpen}
        queue={queue}
        currentIndex={currentQueueIndex}
        isPlaying={isPlaying}
      />
    </div>
  );
};
