import { 
  LayoutDashboard, 
  Music, 
  Bell, 
  Megaphone, 
  Settings,
  Radio,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar = ({ activeTab, setActiveTab }: SidebarProps) => {
  const { hasPermission, user } = useAuth();

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "library", label: "Media Library", icon: Music },
    { id: "azan", label: "Athan Schedule", icon: Bell },
    { id: "pa", label: "Broadcast Mode", icon: Megaphone, requiredRole: 'dj' as const },
    { id: "admin", label: "User Management", icon: Shield, requiredRole: 'admin' as const },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (!item.requiredRole) return true;
    return hasPermission(item.requiredRole);
  });

  return (
    <div className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary">
            <Radio className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-lg text-sidebar-foreground">Intra Jam</h1>
            <p className="text-xs text-muted-foreground">Your Space, Your Sound</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"}
              className={`w-full justify-start gap-3 h-11 ${
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
              {item.label}
            </Button>
          );
        })}
      </nav>

      {/* User Menu & Status */}
      <div className="p-4 border-t border-sidebar-border space-y-4">
        {user && (
          <div className="flex items-center justify-between">
            <UserMenu />
          </div>
        )}
        <div className="p-3 rounded-lg bg-sidebar-accent/50">
          <p className="text-xs text-muted-foreground">System Status</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-sidebar-foreground">All systems online</span>
          </div>
        </div>
      </div>
    </div>
  );
};
