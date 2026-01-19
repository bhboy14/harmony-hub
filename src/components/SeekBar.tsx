import { useState, useRef, useCallback, useEffect } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { getSeekBarSettings, SeekBarSettings } from "@/hooks/useSeekBarSettings";

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

/** Get the color for the given source from settings */
const getSourceColor = (source: AudioSource, settings: SeekBarSettings): string => {
  const key = source || "default";
  return settings.colors[key] || settings.colors.default;
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
  const [settings, setSettings] = useState<SeekBarSettings>(getSeekBarSettings);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for settings changes from localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      setSettings(getSeekBarSettings());
    };
    
    // Check periodically for changes (handles same-tab updates)
    const interval = setInterval(handleStorageChange, 500);
    window.addEventListener("storage", handleStorageChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

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

  const sourceColor = getSourceColor(activeSource ?? null, settings);
  const opacity = settings.opacity / 100;

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
        <SliderPrimitive.Range 
          className="absolute h-full transition-colors"
          style={{ 
            backgroundColor: sourceColor,
            opacity,
            boxShadow: `0 0 8px ${sourceColor}40`,
          }} 
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb 
        className={cn(
          "block h-5 w-5 rounded-full border-2 bg-background shadow-lg ring-offset-background transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "hover:scale-110 disabled:pointer-events-none disabled:opacity-50",
        )}
        style={{
          borderColor: sourceColor,
          boxShadow: `0 2px 10px ${sourceColor}30`,
        }}
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
