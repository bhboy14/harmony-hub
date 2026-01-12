import { useState, useRef, useCallback } from "react";
import { Slider } from "@/components/ui/slider";

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

export const SeekBar = ({
  progressMs,
  durationMs,
  onSeek,
  showLabels = true,
  className,
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

  return (
    <div className={className}>
      {showLabels ? (
        <div className="flex items-center gap-2 w-full">
          <span className="text-[11px] text-muted-foreground w-10 text-right tabular-nums">
            {formatTime(currentTimeMs)}
          </span>
          <Slider
            value={[displayProgress]}
            max={msToSeconds(durationMs) || 100}
            step={0.5}
            onValueChange={handleSeekChange}
            onValueCommit={handleSeekCommit}
            className="cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-2"
          />
          <span className="text-[11px] text-muted-foreground w-10 tabular-nums">
            {formatTime(durationMs)}
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <Slider
            value={[displayProgress]}
            max={msToSeconds(durationMs) || 100}
            step={0.5}
            onValueChange={handleSeekChange}
            onValueCommit={handleSeekCommit}
            className="cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:border-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTimeMs)}</span>
            <span>{formatTime(durationMs)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
