import React from 'react';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { Lock } from 'lucide-react';

interface RoleGateProps {
  requiredRole: AppRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLockMessage?: boolean;
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Admin',
  dj: 'DJ',
  listener: 'Listener',
};

export const RoleGate: React.FC<RoleGateProps> = ({
  requiredRole,
  children,
  fallback,
  showLockMessage = true,
}) => {
  const { hasPermission, role } = useAuth();

  if (!hasPermission(requiredRole)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showLockMessage) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <Lock className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Access Restricted</p>
          <p className="text-sm mt-1">
            {roleLabels[requiredRole]} or higher permission required
          </p>
          {role && (
            <p className="text-xs mt-2 opacity-70">
              Your current role: {roleLabels[role]}
            </p>
          )}
        </div>
      );
    }

    return null;
  }

  return <>{children}</>;
};

export const useRoleGate = (requiredRole: AppRole) => {
  const { hasPermission } = useAuth();
  return hasPermission(requiredRole);
};
