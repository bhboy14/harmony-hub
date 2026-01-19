import { useState, useRef, useCallback } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

type AudioSource = "spotify" | "local" | "youtube" | "soundcloud" | "pa" | null;

interface SeekBarProps {
  /** Progress in milliseconds */
  progressMs: number | undefined;
  /** Duration in milliseconds */
  durationMs: number | undefined;
  /** Callback to seek to a position (in milliseconds) */
  onSeek: (positionMs: number) => Promise<void>;
  /** Whether to show time labels (default: true) */
  showLabels?: boolean;
  /** Custom class for the container */
  className?: string;
  /** Active audio source for contextual coloring */
  activeSource?: AudioSource;
}

/** Convert milliseconds to seconds safely */
const msToSeconds = (ms: number | undefined): number => {
  if (ms === undefined || isNaN(ms) || ms < 0) return 0;
  return ms / 1000;
};

/** Format milliseconds as m:ss */
const formatTime = (ms: number | undefined): string => {
  const totalSeconds = Math.floor(msToSeconds(ms));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

/** Get the fill color class based on audio source */
const getSourceColorClass = (source: AudioSource): string => {
  switch (source) {
    case 'spotify':
      return 'bg-green-500 shadow-green-500/30';
    case 'youtube':
      return 'bg-red-500 shadow-red-500/30';
    case 'local':
      return 'bg-amber-500 shadow-amber-500/30';
    case 'soundcloud':
      return 'bg-orange-500 shadow-orange-500/30';
    case 'pa':
      return 'bg-red-400 shadow-red-400/30';
    default:
      return 'bg-primary shadow-primary/30';
  }
};

/** Get the thumb border color based on audio source */
const getThumbColorClass = (source: AudioSource): string => {
  switch (source) {
    case 'spotify':
      return 'border-green-500 shadow-green-500/20';
    case 'youtube':
      return 'border-red-500 shadow-red-500/20';
    case 'local':
      return 'border-amber-500 shadow-amber-500/20';
    case 'soundcloud':
      return 'border-orange-500 shadow-orange-500/20';
    case 'pa':
      return 'border-red-400 shadow-red-400/20';
    default:
      return 'border-primary shadow-primary/20';
  }
};

export const SeekBar = ({
  progressMs,
  durationMs,
  onSeek,
  showLabels = true,
  className,
  activeSource,
}: SeekBarProps) => {
  // Seek state management - track dragging to prevent progress sync interference
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // While dragging, show the drag position (in seconds); otherwise show actual progress (in ms, converted)
  const displayProgress = isDragging ? dragValue : msToSeconds(progressMs);

  const handleSeekChange = useCallback((value: number[]) => {
    // User is dragging - update local state immediately for responsive UI
    setIsDragging(true);
    setDragValue(value[0]);
  }, []);

  const handleSeekCommit = useCallback(
    async (value: number[]) => {
      // User released the slider - send the seek command
      setIsDragging(false);

      // Clear any pending seek
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }

      // Convert seconds back to milliseconds for the API
      const seekTargetMs = value[0] * 1000;
      await onSeek(seekTargetMs);
    },
    [onSeek]
  );

  const currentTimeMs = isDragging ? dragValue * 1000 : progressMs;
  const maxValue = msToSeconds(durationMs) || 100;

  const rangeColorClass = getSourceColorClass(activeSource ?? null);
  const thumbColorClass = getThumbColorClass(activeSource ?? null);

  const SliderComponent = (
    <SliderPrimitive.Root
      value={[displayProgress]}
      max={maxValue}
      step={0.5}
      onValueChange={handleSeekChange}
      onValueCommit={handleSeekCommit}
      className={cn("relative flex w-full touch-none select-none items-center cursor-pointer")}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className={cn("absolute h-full shadow-lg transition-colors", rangeColorClass)} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb 
        className={cn(
          "block h-5 w-5 rounded-full border-2 bg-background shadow-lg ring-offset-background transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "hover:scale-110 disabled:pointer-events-none disabled:opacity-50",
          thumbColorClass
        )} 
      />
    </SliderPrimitive.Root>
  );

  return (
    <div className={className}>
      {showLabels ? (
        <div className="flex items-center gap-2 w-full">
          <span className="text-[11px] text-muted-foreground w-10 text-right tabular-nums">
            {formatTime(currentTimeMs)}
          </span>
          {SliderComponent}
          <span className="text-[11px] text-muted-foreground w-10 tabular-nums">
            {formatTime(durationMs)}
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {SliderComponent}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTimeMs)}</span>
            <span>{formatTime(durationMs)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
