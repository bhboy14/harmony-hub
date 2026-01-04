import { 
  Home, 
  Search,
  Library,
  Plus,
  Heart,
  Bell,
  Megaphone, 
  Shield,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useSpotify } from "@/contexts/SpotifyContext";
import { Separator } from "@/components/ui/separator";

interface IconSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const IconSidebar = ({ activeTab, setActiveTab }: IconSidebarProps) => {
  const { hasPermission } = useAuth();
  const spotify = useSpotify();

  const mainNav = [
    { id: "dashboard", icon: Home, label: "Home" },
    { id: "search", icon: Search, label: "Search" },
  ];

  const libraryNav = [
    { id: "library", icon: Library, label: "Your Library" },
    { id: "create", icon: Plus, label: "Create Playlist" },
    { id: "liked", icon: Heart, label: "Liked Songs", color: "bg-gradient-to-br from-indigo-700 to-purple-300" },
  ];

  const specialNav = [
    { id: "azan", icon: Bell, label: "Athan Schedule" },
    { id: "pa", icon: Megaphone, label: "Broadcast", requiredRole: 'dj' as const },
    { id: "admin", icon: Shield, label: "Admin", requiredRole: 'admin' as const },
    { id: "settings", icon: Settings, label: "Settings" },
  ].filter(item => !item.requiredRole || hasPermission(item.requiredRole));

  // Get user's Spotify playlists for quick access
  const quickPlaylists = spotify.playlists?.slice(0, 4) || [];

  return (
    <div className="w-[72px] h-screen bg-black flex flex-col fixed left-0 top-0 z-50">
      {/* Logo */}
      <div className="p-4 flex justify-center">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-lg">IJ</span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-1">
        {mainNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`w-full h-12 rounded-lg transition-colors ${
                    isActive 
                      ? "bg-secondary text-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}

        <Separator className="my-2 bg-border/50" />

        {/* Library Navigation */}
        {libraryNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`w-full h-12 rounded-lg transition-colors ${
                    isActive 
                      ? "bg-secondary text-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                  onClick={() => setActiveTab(item.id === "liked" ? "library" : item.id)}
                >
                  {item.color ? (
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${item.color}`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}

        <Separator className="my-2 bg-border/50" />

        {/* Quick Access Playlists */}
        <div className="space-y-1">
          {quickPlaylists.map((playlist: any) => (
            <Tooltip key={playlist.id}>
              <TooltipTrigger asChild>
                <button
                  className="w-full aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                  onClick={() => setActiveTab("library")}
                >
                  {playlist.images?.[0]?.url ? (
                    <img 
                      src={playlist.images[0].url} 
                      alt={playlist.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center">
                      <Library className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {playlist.name}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <Separator className="my-2 bg-border/50" />

        {/* Special Navigation */}
        {specialNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`w-full h-12 rounded-lg transition-colors ${
                    isActive 
                      ? "bg-secondary text-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </div>
  );
};
