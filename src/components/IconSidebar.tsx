import { 
  Home, 
  Library,
  Heart,
  Bell,
  Megaphone, 
  Shield,
  Settings,
  Menu
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useSpotify } from "@/contexts/SpotifyContext";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface IconSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const IconSidebar = ({ activeTab, setActiveTab }: IconSidebarProps) => {
  const { hasPermission, user } = useAuth();
  const spotify = useSpotify();
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "IJ";
  };

  const mainNav = [
    { id: "dashboard", icon: Home, label: "Home" },
    { id: "library", icon: Library, label: "Your Library" },
    { id: "liked", icon: Heart, label: "Liked Songs", hasGradient: true },
  ];

  const bottomNav = [
    { id: "azan", icon: Bell, label: "Notifications" },
    { id: "pa", icon: Megaphone, label: "Announcements", requiredRole: 'dj' as const },
    { id: "admin", icon: Shield, label: "Security", requiredRole: 'admin' as const },
    { id: "settings", icon: Settings, label: "Settings" },
  ].filter(item => !item.requiredRole || hasPermission(item.requiredRole));

  const handleTabClick = (id: string) => {
    console.log("🔹 Sidebar tab clicked:", id, "current:", activeTab);
    // Use functional update to ensure state change is detected
    setActiveTab(id);
    // Close mobile menu after selection
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const quickPlaylists = spotify.playlists?.slice(0, 4) || [];

  const NavButton = ({ item, isActive }: { item: typeof mainNav[0]; isActive: boolean }) => {
    const Icon = item.icon;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`w-12 h-12 rounded-xl transition-all duration-200 ${
              isActive 
                ? "bg-primary/20 text-primary shadow-lg shadow-primary/20" 
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
            onClick={() => handleTabClick(item.id)}
          >
            {'hasGradient' in item && item.hasGradient ? (
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-400 ${isActive ? 'ring-2 ring-primary/50' : ''}`}>
                <Icon className="h-4 w-4 text-white" />
              </div>
            ) : (
              <Icon className={`h-5 w-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12} className="bg-popover border-border">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  };

  const SidebarContent = () => (
    <div className="h-full flex flex-col py-4 px-2">
      {/* User Avatar */}
      <div className="flex justify-center mb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className="w-11 h-11 ring-2 ring-primary/30 hover:ring-primary/60 transition-all cursor-pointer">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-semibold text-sm">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={12} className="bg-popover border-border">
            {user?.email || "Intra Jam"}
          </TooltipContent>
        </Tooltip>
      </div>

      <Separator className="my-2 bg-border/30" />

      {/* Main Navigation */}
      <nav className="flex flex-col items-center gap-1 py-2">
        {mainNav.map((item) => (
          <NavButton key={item.id} item={item} isActive={activeTab === item.id} />
        ))}
      </nav>

      <Separator className="my-2 bg-border/30" />

      {/* Quick Access Playlists */}
      <div className="flex-1 flex flex-col items-center gap-2 py-2 overflow-y-auto no-scrollbar">
        {quickPlaylists.length > 0 ? (
          quickPlaylists.map((playlist: any) => (
            <Tooltip key={playlist.id}>
              <TooltipTrigger asChild>
                <button
                  className="w-11 h-11 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary/40 transition-all hover:scale-105"
                  onClick={() => handleTabClick("dashboard")}
                >
                  {playlist.images?.[0]?.url ? (
                    <img 
                      src={playlist.images[0].url} 
                      alt={playlist.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center">
                      <Library className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12} className="bg-popover border-border">
                {playlist.name}
              </TooltipContent>
            </Tooltip>
          ))
        ) : (
          <div className="text-muted-foreground/50 text-[10px] text-center px-1">
            No playlists
          </div>
        )}
      </div>

      <Separator className="my-2 bg-border/30" />

      {/* Bottom Navigation */}
      <nav className="flex flex-col items-center gap-1 py-2">
        {bottomNav.map((item) => (
          <NavButton key={item.id} item={item as typeof mainNav[0]} isActive={activeTab === item.id} />
        ))}
      </nav>
    </div>
  );

  // Mobile: Use Sheet drawer
  if (isMobile) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-3 left-3 z-[100] h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 shadow-lg md:hidden"
          onClick={() => setIsOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent side="left" className="w-[72px] p-0 bg-sidebar border-r border-border/30">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <div className="w-[72px] h-screen bg-sidebar border-r border-border/20 flex flex-col fixed left-0 top-0 z-[100]">
      <SidebarContent />
    </div>
  );
};
