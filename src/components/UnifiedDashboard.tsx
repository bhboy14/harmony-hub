import { useState } from "react";
import { Search, Loader2, Youtube, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSpotify } from "@/contexts/SpotifyContext";
import { supabase } from "@/integrations/supabase/client";
import { SpotifyView } from "@/components/dashboard/SpotifyView";
import { YouTubeView } from "@/components/dashboard/YouTubeView";
import { LocalView } from "@/components/dashboard/LocalView";
import { AllLibraryView } from "@/components/dashboard/AllLibraryView";

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

interface UnifiedDashboardProps {
  localFolderTracks?: any[];
}

export const UnifiedDashboard = ({ localFolderTracks = [] }: UnifiedDashboardProps) => {
  const spotify = useSpotify();
  const [activeView, setActiveView] = useState<"all" | "spotify" | "youtube" | "local">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    // Search handled within each view
    setTimeout(() => setIsSearching(false), 500);
  };

  const filters = [
    { key: 'all', label: 'All', icon: null, activeClass: 'bg-primary text-primary-foreground' },
    { key: 'spotify', label: 'Spotify', icon: <SpotifyIcon />, activeClass: 'bg-[#1DB954] text-black' },
    { key: 'youtube', label: 'YouTube', icon: <Youtube className="h-4 w-4" />, activeClass: 'bg-red-500 text-white' },
    { key: 'local', label: 'Local', icon: <HardDrive className="h-4 w-4" />, activeClass: 'bg-amber-500 text-black' },
  ];

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
      {/* Navigation Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={activeView === f.key ? "default" : "outline"}
            size="sm"
            className={`rounded-full h-10 px-5 text-sm gap-2 font-medium transition-all ${
              activeView === f.key 
                ? f.activeClass
                : 'bg-secondary/30 border-border/50 hover:bg-secondary/60'
            }`}
            onClick={() => setActiveView(f.key as any)}
          >
            {f.icon}
            {f.label}
          </Button>
        ))}
      </div>

      {/* View Content */}
      <div className="animate-fade-in">
        {activeView === "all" && <AllLibraryView />}
        {activeView === "spotify" && <SpotifyView />}
        {activeView === "youtube" && <YouTubeView />}
        {activeView === "local" && <LocalView />}
      </div>
    </div>
  );
};
