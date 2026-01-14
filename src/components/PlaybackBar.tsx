import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { useSpotify } from "@/contexts/SpotifyContext";
import { usePA } from "@/contexts/PAContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SeekBar } from "@/components/SeekBar";
import { useState, useEffect, useRef } from "react";
import { QueuePanel } from "@/components/QueuePanel";
import { DevicePanel } from "@/components/DevicePanel";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAudioDucking } from "@/hooks/useAudioDucking";
import { AudioBlockedBadge } from "@/components/AudioUnlockOverlay";
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
  Volume1,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

  // Keyboard shortcuts (Space=Play/Pause, Arrows=Seek)
  const { shortcuts } = useKeyboardShortcuts({ enabled: true });

  // Audio ducking during TTS/Voice announcements
  const { isDucking } = useAudioDucking({ enabled: true, duckingLevel: 20 });

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
    if (activeSource === "spotify" && spotify.isConnected) {
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

  // Seek handler for SeekBar component
  const handleSeek = async (positionMs: number) => {
    await seek(positionMs);
  };

  const handleMicToggle = async () => {
    await pa.toggleBroadcast();
  };

  // Update individual channel volumes
  const setMusicVolume = (value: number) => {
    setMixerSettings((prev) => ({ ...prev, music: value }));
  };

  const setAzanVolume = (value: number) => {
    setMixerSettings((prev) => ({ ...prev, azan: value }));
    // Update azan player settings in localStorage directly
    try {
      const azanSettings = JSON.parse(localStorage.getItem("azanPlayerSettings") || "{}");
      azanSettings.volume = value;
      localStorage.setItem("azanPlayerSettings", JSON.stringify(azanSettings));
    } catch {}
  };

  const setPaVolume = (value: number) => {
    setMixerSettings((prev) => ({ ...prev, pa: value }));
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[72px] md:h-[90px] bg-black border-t border-white/10 z-[100] px-2 md:px-4">
      <div className="h-full grid grid-cols-3 items-center gap-2 md:gap-4">
        {/* Track Info - Compact on mobile */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {currentTrack ? (
            <>
              <div className="w-10 h-10 md:w-14 md:h-14 rounded shadow-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                {currentTrack.albumArt ? (
                  <img
                    src={currentTrack.albumArt}
                    className="w-full h-full object-cover"
                    alt={currentTrack.title}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-800">
                    <Music className="h-4 w-4 md:h-6 md:w-6 text-zinc-500" />
                  </div>
                )}
              </div>
              <div className="min-w-0 hidden xs:block">
                <p className="font-medium text-white truncate text-xs md:text-sm">{currentTrack.title}</p>
                <p className="text-[10px] md:text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded shadow-lg bg-zinc-800 flex items-center justify-center">
                <Music className="h-4 w-4 md:h-6 md:w-6 text-zinc-600" />
              </div>
              <div className="min-w-0 hidden xs:block">
                <p className="font-medium text-zinc-500 text-xs md:text-sm">No track playing</p>
                <p className="text-[10px] md:text-xs text-zinc-600">Select a track</p>
              </div>
            </div>
          )}
        </div>

        {/* Playback Controls - Centered */}
        <div className="flex flex-col items-center gap-0.5 md:gap-1">
          <div className="flex items-center gap-0.5 md:gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleShuffle}
              className={`h-7 w-7 md:h-8 md:w-8 ${shuffle ? "text-green-500" : "text-zinc-400"}`}
            >
              <Shuffle className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => previous()} className="h-7 w-7 md:h-8 md:w-8 text-white">
              <SkipBack className="h-3 w-3 md:h-4 md:w-4 fill-current" />
            </Button>
            <Button
              size="icon"
              onClick={() => (isPlaying ? pause() : play())}
              className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-white text-black"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current ml-0.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => next()} className="h-7 w-7 md:h-8 md:w-8 text-white">
              <SkipForward className="h-3 w-3 md:h-4 md:w-4 fill-current" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleRepeat}
              className={`h-7 w-7 md:h-8 md:w-8 ${repeat !== "off" ? "text-green-500" : "text-zinc-400"}`}
            >
              {repeat === "one" ? <Repeat1 className="h-3 w-3 md:h-4 md:w-4" /> : <Repeat className="h-3 w-3 md:h-4 md:w-4" />}
            </Button>
          </div>

          <SeekBar
            progressMs={progress}
            durationMs={duration}
            onSeek={handleSeek}
            showLabels={true}
            activeSource={activeSource}
            className="w-full max-w-[400px] md:max-w-[600px]"
          />
        </div>

        {/* Volume/Queue/Extras - Compact on mobile */}
        <div className="flex items-center justify-end gap-1 md:gap-2">
          {/* Audio Blocked Indicator (iOS/Safari) */}
          <AudioBlockedBadge />

          {/* Mic Toggle - Hidden text on mobile */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleMicToggle}
                  className={`h-7 w-7 md:h-8 md:w-8 ${pa.isLive ? "text-red-500 animate-pulse" : "text-zinc-400 hover:text-white"}`}
                >
                  {pa.isLive ? <Mic className="h-3 w-3 md:h-4 md:w-4" /> : <MicOff className="h-3 w-3 md:h-4 md:w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{pa.isLive ? "Stop Broadcast (Live)" : "Start Broadcast"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Live Indicator - Compact on mobile */}
          {pa.isLive && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30">
              <Radio className="h-3 w-3 text-red-500 animate-pulse" />
              <span className="text-[10px] font-medium text-red-500">LIVE</span>
            </div>
          )}

          {/* Device Panel - Hidden on mobile */}
          <div className="hidden md:block">
            <DevicePanel variant="ghost" size="icon" className="text-zinc-400 hover:text-white" />
          </div>

          {/* Enhanced Mixer */}
          <Popover open={mixerOpen} onOpenChange={setMixerOpen}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-zinc-400 hover:text-white">
                      <Sliders className="h-3 w-3 md:h-4 md:w-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Audio Mixer</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <PopoverContent align="end" className="w-72 md:w-80">
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
                    <Slider value={[isMuted ? 0 : volume]} max={100} onValueChange={(v) => setGlobalVolume(v[0])} />
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
                        <Slider value={[musicVolume]} max={100} onValueChange={(v) => setMusicVolume(v[0])} />
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
                        <Slider value={[azanVolume]} max={100} onValueChange={(v) => setAzanVolume(v[0])} />
                      </div>
                    </div>

                    {/* PA/Mic Channel */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${pa.isLive ? "bg-red-500/20" : "bg-zinc-500/20"}`}
                      >
                        <Mic className={`h-4 w-4 ${pa.isLive ? "text-red-500" : "text-zinc-500"}`} />
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
                        {pa.isLive && <Progress value={pa.audioLevel} className="h-1 mt-1" />}
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
            className="h-7 w-7 md:h-8 md:w-8 text-zinc-400 hover:text-white"
          >
            <ListMusic className="h-3 w-3 md:h-4 md:w-4" />
          </Button>

          {/* Volume - Hidden on mobile, shown in mixer */}
          <div className="hidden md:flex items-center gap-2 w-32">
            <Button variant="ghost" size="icon" onClick={toggleMute} className="text-zinc-400 hover:text-white h-8 w-8">
              {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
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
