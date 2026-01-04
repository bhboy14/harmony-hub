import { useState } from "react";
import { Cast, Airplay, Wifi, WifiOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useCasting } from "@/hooks/useCasting";

interface CastButtonProps {
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  className?: string;
}

export const CastButton = ({ variant = "ghost", size = "icon", className }: CastButtonProps) => {
  const {
    isAvailable,
    isCasting,
    isCastingSupported,
    currentDevice,
    startChromecast,
    startAirPlay,
    stopCasting,
  } = useCasting();

  const [isOpen, setIsOpen] = useState(false);

  // Check if we're in Safari (for AirPlay)
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  // Check if we're in Chrome (for Chromecast)  
  const isChrome = /chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent);

  const handleChromecast = async () => {
    await startChromecast();
    setIsOpen(false);
  };

  const handleAirPlay = () => {
    startAirPlay();
    setIsOpen(false);
  };

  const handleDisconnect = () => {
    stopCasting();
    setIsOpen(false);
  };

  if (!isCastingSupported && !isChrome && !isSafari) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={variant} size={size} className={className} disabled>
              <Cast className="h-4 w-4 opacity-50" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Casting not available in this browser</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button 
                variant={variant} 
                size={size} 
                className={`${className} ${isCasting ? 'text-primary' : ''}`}
              >
                {isCasting ? (
                  <Wifi className="h-4 w-4" />
                ) : (
                  <Cast className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {isCasting ? `Casting to ${currentDevice?.name}` : 'Cast to device'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          {isCasting ? 'Now Casting' : 'Cast To'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isCasting && currentDevice && (
          <>
            <div className="px-2 py-2 flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary" />
              <span className="font-medium">{currentDevice.name}</span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleDisconnect}
              className="text-destructive focus:text-destructive"
            >
              <WifiOff className="h-4 w-4 mr-2" />
              Disconnect
            </DropdownMenuItem>
          </>
        )}

        {!isCasting && (
          <>
            {/* Chromecast option - Chrome only */}
            {isChrome && (
              <DropdownMenuItem onClick={handleChromecast}>
                <Cast className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span>Chromecast</span>
                  <span className="text-xs text-muted-foreground">
                    Cast to nearby devices
                  </span>
                </div>
              </DropdownMenuItem>
            )}

            {/* AirPlay option - Safari only */}
            {isSafari && (
              <DropdownMenuItem onClick={handleAirPlay}>
                <Airplay className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span>AirPlay</span>
                  <span className="text-xs text-muted-foreground">
                    Stream to Apple devices
                  </span>
                </div>
              </DropdownMenuItem>
            )}

            {/* Show message if neither is available */}
            {!isChrome && !isSafari && (
              <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                <p>Use Chrome for Chromecast</p>
                <p>Use Safari for AirPlay</p>
              </div>
            )}

            {/* Hint for other browsers */}
            {(isChrome || isSafari) && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  {isChrome && !isSafari && (
                    <p>💡 Use Safari for AirPlay support</p>
                  )}
                  {isSafari && !isChrome && (
                    <p>💡 Use Chrome for Chromecast support</p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
