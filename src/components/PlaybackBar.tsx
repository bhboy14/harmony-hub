import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { useSpotify } from "@/contexts/SpotifyContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { QueuePanel } from "@/components/QueuePanel";
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
  ListMusic,
  Music,
} from "lucide-react";

export const PlaybackBar = () => {
  const unified = useUnifiedAudio();
  const spotify = useSpotify();
  const [queueOpen, setQueueOpen] = useState(false);

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
    seek,
  } = unified;

  // FIX: Normalizes Spotify milliseconds vs Local seconds
  const normalizeToSeconds = (time: number | undefined) => {
    if (time === undefined || isNaN(time) || time < 0) return 0;
    // If time is > 36000 (10 hours), it's definitely milliseconds
    return time > 36000 ? time / 1000 : time;
  };

  const formatTime = (time: number | undefined) => {
    const totalSeconds = Math.floor(normalizeToSeconds(time));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeek = async (value: number[]) => {
    // Convert back to milliseconds for Spotify API, keep seconds for local
    const seekTarget = activeSource === "spotify" ? value[0] * 1000 : value[0];
    await seek(seekTarget);
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

        {/* Volume/Queue */}
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setQueueOpen(true)}
            className="text-zinc-400 hover:text-white"
          >
            <ListMusic className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 w-32">
            <Volume2 className="h-4 w-4 text-zinc-400" />
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
