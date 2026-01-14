import { WifiOff, Wifi, Cloud, CloudOff } from "lucide-react";
import { useOfflineSupport } from "@/hooks/useOfflineSupport";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OfflineIndicatorProps {
  showLabel?: boolean;
  className?: string;
}

export const OfflineIndicator = ({ showLabel = false, className = "" }: OfflineIndicatorProps) => {
  const { isOnline, cachedPrayerTimes, isPrayerTimesCacheStale } = useOfflineSupport();

  const hasCache = !!cachedPrayerTimes;
  const cacheStale = isPrayerTimesCacheStale();

  if (isOnline && !showLabel) {
    return null; // Don't show anything when online unless explicitly requested
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={isOnline ? "secondary" : "destructive"}
            className={`flex items-center gap-1.5 cursor-default ${className}`}
          >
            {isOnline ? (
              <>
                <Wifi className="h-3 w-3" />
                {showLabel && <span>Online</span>}
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                {showLabel && <span>Offline</span>}
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">
              {isOnline ? "Connected" : "Offline Mode"}
            </p>
            
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                {hasCache ? (
                  <Cloud className="h-3 w-3 text-green-500" />
                ) : (
                  <CloudOff className="h-3 w-3 text-muted-foreground" />
                )}
                <span>
                  Prayer times: {hasCache ? (cacheStale ? "Cached (outdated)" : "Cached") : "Not cached"}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Cloud className="h-3 w-3 text-green-500" />
                <span>Local audio: Always available</span>
              </div>
            </div>
            
            {!isOnline && (
              <p className="text-xs text-muted-foreground mt-2">
                Spotify and YouTube require internet connection.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
