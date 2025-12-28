import { useAuth, AppRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LogOut, User, Shield, Music, Headphones } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const roleConfig: Record<AppRole, { label: string; icon: React.ElementType; color: string }> = {
  admin: { label: 'Admin', icon: Shield, color: 'bg-destructive/20 text-destructive' },
  dj: { label: 'DJ', icon: Music, color: 'bg-primary/20 text-primary' },
  listener: { label: 'Listener', icon: Headphones, color: 'bg-muted text-muted-foreground' },
};

export const UserMenu = () => {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
        Sign In
      </Button>
    );
  }

  const roleInfo = role ? roleConfig[role] : null;
  const initials = profile?.display_name
    ? profile.display_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email?.[0].toUpperCase() || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-primary/30">
            <AvatarImage src={profile?.avatar_url || ''} alt={profile?.display_name || ''} />
            <AvatarFallback className="bg-surface-2 text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-medium leading-none">
              {profile?.display_name || 'User'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
            {roleInfo && (
              <Badge variant="secondary" className={`w-fit ${roleInfo.color}`}>
                <roleInfo.icon className="h-3 w-3 mr-1" />
                {roleInfo.label}
              </Badge>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/profile')}>
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
