import { useState } from "react";
import { useAudioUnlock } from "@/hooks/useAudioUnlock";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AudioUnlockOverlayProps {
  onUnlock?: () => void;
  className?: string;
}

/**
 * Overlay component that appears on iOS/Safari when audio is locked.
 * Provides a button for the user to tap to unlock audio playback.
 */
export const AudioUnlockOverlay = ({ onUnlock, className }: AudioUnlockOverlayProps) => {
  const { toast } = useToast();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  
  const { isLocked, isIOSDevice, unlockAudio } = useAudioUnlock({
    onUnlock: () => {
      toast({
        title: "Audio Enabled",
        description: "Your device is now ready to receive audio sync",
      });
      onUnlock?.();
    },
  });

  // Don't show if not on iOS, not locked, or dismissed
  if (!isIOSDevice || !isLocked || isDismissed) {
    return null;
  }

  const handleUnlock = async () => {
    setIsUnlocking(true);
    const success = await unlockAudio();
    setIsUnlocking(false);
    
    if (success) {
      setIsDismissed(true);
    } else {
      toast({
        title: "Couldn't enable audio",
        description: "Please try tapping the button again",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm",
        "flex flex-col items-center justify-center gap-6 p-8",
        "animate-in fade-in duration-300",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <VolumeX className="w-10 h-10 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Audio is Blocked</h2>
          <p className="text-sm text-muted-foreground">
            Your browser requires permission to play audio. Tap below to enable sound and join the sync session.
          </p>
        </div>
      </div>

      <Button
        size="lg"
        onClick={handleUnlock}
        disabled={isUnlocking}
        className="gap-2 px-8 py-6 text-lg rounded-full shadow-lg"
      >
        <Volume2 className="w-5 h-5" />
        {isUnlocking ? "Enabling..." : "Enable Audio"}
      </Button>

      <button
        onClick={handleDismiss}
        className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
};

/**
 * Small indicator badge that shows when audio is blocked.
 * Can be placed in the playback bar or header.
 */
export const AudioBlockedBadge = ({ className }: { className?: string }) => {
  const { isLocked, isIOSDevice, unlockAudio } = useAudioUnlock();
  const { toast } = useToast();

  // Don't show if not on iOS or not locked
  if (!isLocked || !isIOSDevice) {
    return null;
  }

  const handleClick = async () => {
    const success = await unlockAudio();
    if (success) {
      toast({
        title: "Audio Enabled",
        description: "Ready to receive audio sync",
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full",
        "bg-destructive/20 border border-destructive/30",
        "hover:bg-destructive/30 transition-colors cursor-pointer",
        className
      )}
    >
      <VolumeX className="h-3 w-3 text-destructive" />
      <span className="text-[10px] font-medium text-destructive">TAP TO ENABLE</span>
    </button>
  );
};
