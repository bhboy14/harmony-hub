import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { X, Music, Plus, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeekBar } from "@/components/SeekBar";

interface NowPlayingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NowPlayingPanel = ({ isOpen, onClose }: NowPlayingPanelProps) => {
  const { currentTrack, activeSource, isPlaying, progress, duration, seek } = useUnifiedAudio();

  if (!isOpen) return null;

  // Seek handler for SeekBar component
  const handleSeek = async (positionMs: number) => {
    await seek(positionMs);
  };

  const getSourceColor = (source: string | null) => {
    switch (source) {
      case 'spotify': return 'bg-[#1DB954]';
      case 'youtube': return 'bg-red-500';
      case 'local': return 'bg-amber-500';
      case 'soundcloud': return 'bg-orange-500';
      default: return 'bg-primary';
    }
  };

  return (
    <div className="w-72 sm:w-80 h-full bg-background flex flex-col border-l border-border animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <span className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Music className="h-4 w-4 text-primary" />
          Now Playing
        </span>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Album Art */}
        <div className="aspect-square rounded-xl overflow-hidden shadow-lg bg-secondary">
          {currentTrack?.albumArt ? (
            <img src={currentTrack.albumArt} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary">
              <Music className="h-16 w-16 text-muted-foreground/50" />
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="space-y-1 text-center">
          <h2 className="text-lg font-bold text-foreground truncate leading-tight">
            {currentTrack?.title || "No track playing"}
          </h2>
          <p className="text-muted-foreground truncate text-sm">{currentTrack?.artist || "Select a track to play"}</p>
        </div>

        {/* Progress with Seek Slider */}
        {currentTrack && (
          <SeekBar
            progressMs={progress}
            durationMs={duration}
            onSeek={handleSeek}
            showLabels={false}
          />
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1 rounded-full h-9 text-xs gap-2"
          >
            <Plus className="h-4 w-4" /> Add to Playlist
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full h-9 w-9"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Source Info */}
        <div className="pt-4 border-t border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Source</p>
          <div className="flex items-center gap-2 text-foreground text-sm capitalize">
            <div className={`h-2 w-2 rounded-full ${getSourceColor(activeSource)} ${isPlaying ? 'animate-pulse' : ''}`} />
            {activeSource || "None"}
          </div>
        </div>
      </div>
    </div>
  );
};
