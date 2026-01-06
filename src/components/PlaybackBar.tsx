import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { useSpotify } from "@/contexts/SpotifyContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { QueuePanel } from "@/components/QueuePanel";
import { CastButton } from "@/components/CastButton";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Repeat, 
  Repeat1, 
  Shuffle, 
  ListMusic,
  Mic,
  MicOff,
  Monitor,
  Sliders
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const PlaybackBar = () => {
  const unified = useUnifiedAudio();
  const spotify = useSpotify();
  const [queueOpen, setQueueOpen] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);

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
    seek,
    toggleMute,
  } = unified;

  // FIXED: Explicitly checks source to handle Spotify ms vs Local seconds
  const normalizeToSeconds = (time: number | undefined) => {
    if (time === undefined || isNaN(time) || time < 0) return 0;
    return activeSource === "spotify" ? time / 1000 : time;
  };

  const formatTime = (time: number | undefined) => {
    const totalSeconds = Math.floor(normalizeToSeconds(time));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeek = async (value: number[]) => {
    // Converts back to milliseconds ONLY for Spotify API
    const seekTarget = activeSource === "spotify" ? value[0] * 1000 : value[0];
    await seek(seekTarget);
  };

  const handleMicToggle = () => {
    setMicEnabled(!micEnabled);
    // TODO: Integrate with actual microphone/PA system
  };

  // Get available Spotify devices
  const spotifyDevices = spotify.devices || [];
  const activeDevice = spotifyDevices.find(d => d.is_active);

  const handleDeviceSelect = async (deviceId: string) => {
    try {
      await spotify.transferPlayback(deviceId);
    } catch (err) {
      console.error('Failed to transfer playback:', err);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[90px] bg-black border-t border-white/10 z-[100] px-4">
      <div className="h-full grid grid-cols-3 items-center">
        {/* Track Info */}
        <div className="flex items-center gap-3 min-w-0">
          {currentTrack && (
            <>
              <img
                src={currentTrack.albumArt || ""}
                className="w-14 h-14 rounded shadow-lg object-cover bg-zinc-800"
                alt=""
              />
              <div className="min-w-0">
                <p className="font-medium text-white truncate text-sm">{currentTrack.title}</p>
                <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
              </div>
            </>
          )}
        </div>

        {/* Playback Controls */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleShuffle}
              className={shuffle ? "text-green-500" : "text-zinc-400"}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => previous()} className="text-white">
              <SkipBack className="h-4 w-4 fill-current" />
            </Button>
            <Button
              size="icon"
              onClick={() => (isPlaying ? pause() : play())}
              className="h-8 w-8 rounded-full bg-white text-black"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current ml-0.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => next()} className="text-white">
              <SkipForward className="h-4 w-4 fill-current" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleRepeat}
              className={repeat !== "off" ? "text-green-500" : "text-zinc-400"}
            >
              {repeat === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full max-w-[600px]">
            <span className="text-[11px] text-zinc-400 w-10 text-right tabular-nums">{formatTime(progress)}</span>
            <Slider
              value={[normalizeToSeconds(progress)]}
              max={normalizeToSeconds(duration) || 100}
              step={1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
            <span className="text-[11px] text-zinc-400 w-10 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume/Queue/Extras */}
        <div className="flex items-center justify-end gap-2">
          {/* Mic Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleMicToggle}
                  className={micEnabled ? "text-red-500" : "text-zinc-400 hover:text-white"}
                >
                  {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {micEnabled ? "Disable Microphone" : "Enable Microphone"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Device Selector */}
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={activeDevice ? "text-green-500" : "text-zinc-400 hover:text-white"}
                    >
                      <Monitor className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  {activeDevice ? `Playing on ${activeDevice.name}` : "Select Device"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Available Devices</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {spotifyDevices.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  No devices available
                </div>
              ) : (
                spotifyDevices.map((device) => (
                  <DropdownMenuItem
                    key={device.id}
                    onClick={() => device.id && handleDeviceSelect(device.id)}
                    className={device.is_active ? "bg-primary/10" : ""}
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    <div className="flex-1">
                      <p className="font-medium">{device.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{device.type}</p>
                    </div>
                    {device.is_active && (
                      <span className="text-xs text-green-500">Playing</span>
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Cast Button */}
          <CastButton variant="ghost" size="icon" className="text-zinc-400 hover:text-white" />

          {/* Mixer */}
          <Popover open={mixerOpen} onOpenChange={setMixerOpen}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-zinc-400 hover:text-white"
                    >
                      <Sliders className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Audio Mixer</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <PopoverContent align="end" className="w-72">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Audio Mixer</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16">Master</span>
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      max={100}
                      onValueChange={(v) => setGlobalVolume(v[0])}
                      className="flex-1"
                    />
                    <span className="text-xs w-8">{isMuted ? 0 : volume}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16">Music</span>
                    <Slider
                      value={[100]}
                      max={100}
                      className="flex-1"
                    />
                    <span className="text-xs w-8">100%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16">Azan</span>
                    <Slider
                      value={[100]}
                      max={100}
                      className="flex-1"
                    />
                    <span className="text-xs w-8">100%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16">PA/Mic</span>
                    <Slider
                      value={[micEnabled ? 80 : 0]}
                      max={100}
                      className="flex-1"
                    />
                    <span className="text-xs w-8">{micEnabled ? 80 : 0}%</span>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Queue */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setQueueOpen(true)}
            className="text-zinc-400 hover:text-white"
          >
            <ListMusic className="h-4 w-4" />
          </Button>

          {/* Volume */}
          <div className="flex items-center gap-2 w-32">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="text-zinc-400 hover:text-white h-8 w-8"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
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
        upcomingTracks={upcomingTracks}
        history={queueHistory}
        onPlayTrack={playQueueTrack}
        onRemoveTrack={removeFromQueue}
        onClearQueue={clearQueue}
        onClearUpcoming={clearUpcoming}
        isPlaying={isPlaying}
      />
    </div>
  );
};
