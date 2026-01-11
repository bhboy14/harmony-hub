import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { useSpotify } from "@/contexts/SpotifyContext";
import { usePA } from "@/contexts/PAContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect, useRef, useCallback } from "react";
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
  Sliders,
  Radio,
  Music,
  Volume1
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
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";

// Channel volumes stored in localStorage for persistence
const loadMixerSettings = () => {
  try {
    const saved = localStorage.getItem("mixerSettings");
    if (saved) return JSON.parse(saved);
  } catch {}
  return { music: 100, azan: 100, pa: 80 };
};

export const PlaybackBar = () => {
  const unified = useUnifiedAudio();
  const spotify = useSpotify();
  const pa = usePA();
  const [queueOpen, setQueueOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  
  // Channel volumes with localStorage persistence
  const [mixerSettings, setMixerSettings] = useState(loadMixerSettings);
  const musicVolume = mixerSettings.music;
  const azanVolume = mixerSettings.azan;
  const paVolume = mixerSettings.pa;

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

  // Persist mixer settings
  useEffect(() => {
    localStorage.setItem("mixerSettings", JSON.stringify(mixerSettings));
  }, [mixerSettings]);

  // Sync PA mic volume with slider
  useEffect(() => {
    pa.setMicVolume(paVolume);
  }, [paVolume, pa]);

  // Debounce ref for Spotify volume
  const spotifyVolumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Apply music channel volume to all audio sources immediately (local) or debounced (Spotify)
  useEffect(() => {
    const effectiveVolume = isMuted ? 0 : Math.round((volume * musicVolume) / 100);
    const normalizedVolume = effectiveVolume / 100;
    
    // Apply to local audio immediately
    if (unified.localAudioRef?.current) {
      unified.localAudioRef.current.volume = normalizedVolume;
    }
    
    // Debounce Spotify API calls to avoid 429 rate limit errors
    if (activeSource === 'spotify' && spotify.isConnected) {
      if (spotifyVolumeTimeoutRef.current) {
        clearTimeout(spotifyVolumeTimeoutRef.current);
      }
      spotifyVolumeTimeoutRef.current = setTimeout(() => {
        spotify.setVolume(effectiveVolume).catch(() => {});
      }, 300); // 300ms debounce
    }
    
    return () => {
      if (spotifyVolumeTimeoutRef.current) {
        clearTimeout(spotifyVolumeTimeoutRef.current);
      }
    };
  }, [volume, musicVolume, isMuted, unified.localAudioRef, activeSource, spotify]);

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

  // Seek state management - track dragging to prevent progress sync interference
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // While dragging, show the drag position; otherwise show actual progress
  const displayProgress = isDragging ? dragValue : normalizeToSeconds(progress);
  
  const handleSeekChange = useCallback((value: number[]) => {
    // User is dragging - update local state immediately for responsive UI
    setIsDragging(true);
    setDragValue(value[0]);
  }, []);
  
  const handleSeekCommit = useCallback(async (value: number[]) => {
    // User released the slider - send the seek command
    setIsDragging(false);
    
    // Clear any pending seek
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
    }
    
    // Convert to milliseconds for the API
    const seekTarget = activeSource === "spotify" ? value[0] * 1000 : value[0] * 1000;
    await seek(seekTarget);
  }, [activeSource, seek]);

  const handleMicToggle = async () => {
    await pa.toggleBroadcast();
  };

  // Update individual channel volumes
  const setMusicVolume = (value: number) => {
    setMixerSettings(prev => ({ ...prev, music: value }));
  };

  const setAzanVolume = (value: number) => {
    setMixerSettings(prev => ({ ...prev, azan: value }));
    // Update azan player settings in localStorage directly
    try {
      const azanSettings = JSON.parse(localStorage.getItem("azanPlayerSettings") || "{}");
      azanSettings.volume = value;
      localStorage.setItem("azanPlayerSettings", JSON.stringify(azanSettings));
    } catch {}
  };

  const setPaVolume = (value: number) => {
    setMixerSettings(prev => ({ ...prev, pa: value }));
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
             <span className="text-[11px] text-zinc-400 w-10 text-right tabular-nums">
               {isDragging ? formatTime(dragValue) : formatTime(progress)}
             </span>
             <Slider
               value={[displayProgress]}
               max={normalizeToSeconds(duration) || 100}
               step={0.5}
               onValueChange={handleSeekChange}
               onValueCommit={handleSeekCommit}
               className="cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-2"
             />
             <span className="text-[11px] text-zinc-400 w-10 tabular-nums">{formatTime(duration)}</span>
           </div>
        </div>

        {/* Volume/Queue/Extras */}
        <div className="flex items-center justify-end gap-2">
          {/* Mic Toggle - Connected to PA System */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleMicToggle}
                  className={pa.isLive ? "text-red-500 animate-pulse" : "text-zinc-400 hover:text-white"}
                >
                  {pa.isLive ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {pa.isLive ? "Stop Broadcast (Live)" : "Start Broadcast"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Live Indicator */}
          {pa.isLive && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30">
              <Radio className="h-3 w-3 text-red-500 animate-pulse" />
              <span className="text-[10px] font-medium text-red-500">LIVE</span>
            </div>
          )}

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

          {/* Enhanced Mixer */}
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
            <PopoverContent align="end" className="w-80">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Audio Mixer</h4>
                  {pa.isLive && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] text-red-500 font-medium">LIVE</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  {/* Master Volume */}
                  <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground flex items-center gap-2">
                        <Volume2 className="h-3 w-3" />
                        Master
                      </Label>
                      <span className="text-xs font-medium">{isMuted ? 0 : volume}%</span>
                    </div>
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      max={100}
                      onValueChange={(v) => setGlobalVolume(v[0])}
                    />
                  </div>
                  
                  {/* Channel Controls */}
                  <div className="space-y-3">
                    {/* Music Channel */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Music className="h-4 w-4 text-green-500" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Music</span>
                          <span className="text-xs text-muted-foreground">{musicVolume}%</span>
                        </div>
                        <Slider
                          value={[musicVolume]}
                          max={100}
                          onValueChange={(v) => setMusicVolume(v[0])}
                        />
                      </div>
                    </div>
                    
                    {/* Azan Channel */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Volume1 className="h-4 w-4 text-amber-500" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Azan</span>
                          <span className="text-xs text-muted-foreground">{azanVolume}%</span>
                        </div>
                        <Slider
                          value={[azanVolume]}
                          max={100}
                          onValueChange={(v) => setAzanVolume(v[0])}
                        />
                      </div>
                    </div>
                    
                    {/* PA/Mic Channel */}
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${pa.isLive ? 'bg-red-500/20' : 'bg-zinc-500/20'}`}>
                        <Mic className={`h-4 w-4 ${pa.isLive ? 'text-red-500' : 'text-zinc-500'}`} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs">PA/Mic</span>
                          <span className="text-xs text-muted-foreground">{paVolume}%</span>
                        </div>
                        <Slider
                          value={[paVolume]}
                          max={100}
                          onValueChange={(v) => setPaVolume(v[0])}
                          disabled={!pa.isLive}
                        />
                        {/* Audio Level Meter */}
                        {pa.isLive && (
                          <Progress value={pa.audioLevel} className="h-1 mt-1" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Quick Actions */}
                <div className="pt-2 border-t border-border/50">
                  <Button
                    variant={pa.isLive ? "destructive" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={handleMicToggle}
                  >
                    {pa.isLive ? (
                      <>
                        <MicOff className="h-4 w-4 mr-2" />
                        Stop Broadcast
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-2" />
                        Go Live
                      </>
                    )}
                  </Button>
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
