import { useUnifiedAudio } from "@/contexts/UnifiedAudioContext";
import { X, Music, Plus, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NowPlayingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NowPlayingPanel = ({ isOpen, onClose }: NowPlayingPanelProps) => {
  const { currentTrack, activeSource } = useUnifiedAudio();

  if (!isOpen) return null;

  return (
    <div className="w-80 h-full bg-[#121212] flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
      {/* Fixed Header */}
      <div className="flex items-center justify-between p-4 bg-[#121212]/80 backdrop-blur-md sticky top-0 z-10">
        <span className="text-sm font-bold text-white flex items-center gap-2">
          <Music className="h-4 w-4 text-green-500" />
          Now Playing
        </span>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-zinc-400 hover:text-white">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-6">
        <div className="aspect-square rounded-xl overflow-hidden shadow-2xl bg-zinc-800">
          {currentTrack?.albumArt ? (
            <img src={currentTrack.albumArt} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="h-12 w-12 text-zinc-700" />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white truncate leading-tight">
            {currentTrack?.title || "No track playing"}
          </h2>
          <p className="text-zinc-400 truncate text-sm">{currentTrack?.artist || "Unknown artist"}</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border-none rounded-full h-9 text-xs gap-2"
          >
            <Plus className="h-4 w-4" /> Add to Playlist
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="bg-zinc-800 hover:bg-zinc-700 text-white border-none rounded-full h-9 w-9"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="pt-4 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-2">Source</p>
          <div className="flex items-center gap-2 text-zinc-300 text-sm capitalize">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            {activeSource || "No source"}
          </div>
        </div>
      </div>
    </div>
  );
};
