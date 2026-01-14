import { 
  Home, 
  Library,
  Heart,
  Bell,
  Megaphone, 
  Shield,
  Settings,
  Menu,
  X
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useSpotify } from "@/contexts/SpotifyContext";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface IconSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const IconSidebar = ({ activeTab, setActiveTab }: IconSidebarProps) => {
  const { hasPermission } = useAuth();
  const spotify = useSpotify();
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const mainNav = [
    { id: "dashboard", icon: Home, label: "Home" },
  ];

  const libraryNav = [
    { id: "library", icon: Library, label: "Your Library", action: "dashboard" },
    { id: "liked", icon: Heart, label: "Liked Songs", action: "dashboard", color: "bg-gradient-to-br from-indigo-700 to-purple-300" },
  ];

  const handleNavClick = (item: typeof libraryNav[0]) => {
    setActiveTab(item.action);
    if (isMobile) setIsOpen(false);
  };

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    if (isMobile) setIsOpen(false);
  };

  const specialNav = [
    { id: "azan", icon: Bell, label: "Athan Schedule" },
    { id: "pa", icon: Megaphone, label: "Broadcast", requiredRole: 'dj' as const },
    { id: "admin", icon: Shield, label: "Admin", requiredRole: 'admin' as const },
    { id: "settings", icon: Settings, label: "Settings" },
  ].filter(item => !item.requiredRole || hasPermission(item.requiredRole));

  const quickPlaylists = spotify.playlists?.slice(0, 4) || [];

  const SidebarContent = () => (
    <div className="h-full flex flex-col">
      {/* Logo */}
      <div className="p-4 flex justify-center">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-lg">IJ</span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
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
                  onClick={() => handleTabClick(item.id)}
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
          const isActive = activeTab === item.action;
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
                  onClick={() => handleNavClick(item)}
                >
                  {item.color ? (
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center ${item.color}`}>
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

        {/* Quick Access Playlists - Hidden on mobile for space */}
        {!isMobile && quickPlaylists.length > 0 && (
          <>
            <div className="space-y-1">
              {quickPlaylists.map((playlist: any) => (
                <Tooltip key={playlist.id}>
                  <TooltipTrigger asChild>
                    <button
                      className="w-full aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
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
          </>
        )}

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
                  onClick={() => handleTabClick(item.id)}
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

  // Mobile: Use Sheet drawer
  if (isMobile) {
    return (
      <>
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-3 left-3 z-50 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 shadow-lg md:hidden"
          onClick={() => setIsOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent side="left" className="w-[72px] p-0 bg-black border-r border-white/10">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <div className="w-[72px] h-screen bg-black flex flex-col fixed left-0 top-0 z-50">
      <SidebarContent />
    </div>
  );
};
