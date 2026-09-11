// lib/hooks/usePermissions.ts
// Client-side permission evaluator & route guard hook

import { useAuth } from './useAuth';
import type { AppModel, ModelPermission } from '../providers/types';

const ROUTE_MODEL_MAP: Record<string, AppModel> = {
  '/dashboard': 'PATIENTS', // Dashboard accessible to all authenticated users
  '/appointments': 'PATIENTS',
  '/patients': 'PATIENTS',
  '/visits': 'VISITS',
  '/prescription': 'VISITS',
  '/followup': 'FOLLOWUPS',
  '/medicines': 'MEDICINES',
  '/reports': 'REPORTS',
  '/settings': 'SETTINGS',
  '/staff': 'STAFF',
};

export function usePermissions() {
  const { user } = useAuth();

  const roleCode = (user?.roleCode || user?.role || '').toString().toUpperCase();
  const roleName = (user?.roleName || '').toLowerCase();
  const isReceptionist = roleCode === 'RECEPTIONIST' || roleName.includes('receptionist');

  // Super Admin / Root Account Owner has full uninhibited access
  const isSuperAdmin = !isReceptionist && (user?.role === 'SUPER_ADMIN' || user?.roleCode === 'SUPER_ADMIN' || (!user?.role && !user?.roleCode));

  const userPermissions: ModelPermission[] = user?.permissions || [];

  const hasPermission = (
    model: AppModel,
    action: 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete' = 'canRead'
  ): boolean => {
    if (isSuperAdmin) return true;

    // Receptionist role override: Only access to Patients (read & create) and Follow-ups (read)
    if (roleCode === 'RECEPTIONIST' || user?.roleName?.toLowerCase().includes('receptionist')) {
      if (model === 'PATIENTS') {
        return action === 'canRead' || action === 'canCreate';
      }
      if (model === 'FOLLOWUPS') {
        return action === 'canRead';
      }
      return false;
    }

    const perm = userPermissions.find((p) => p.model === model);
    if (!perm) return false;
    return !!perm[action];
  };

  const canAccessRoute = (pathname: string): boolean => {
    if (isSuperAdmin) return true;

    // Settings, Staff management, and Subscription are strictly Super Admin only
    if (pathname.startsWith('/settings') || pathname.startsWith('/staff') || pathname.startsWith('/subscription')) {
      return false;
    }

    // Dashboard is restricted to Super Admin
    if (pathname === '/dashboard' || pathname === '/') {
      return false;
    }

    for (const [routePrefix, model] of Object.entries(ROUTE_MODEL_MAP)) {
      if (pathname.startsWith(routePrefix)) {
        return hasPermission(model, 'canRead');
      }
    }

    return false; // Default deny for non-super-admins on unlisted routes
  };

  const getFirstAllowedRoute = (): string => {
    if (isSuperAdmin) return '/dashboard';
    if (hasPermission('PATIENTS', 'canRead')) return '/appointments';
    if (hasPermission('FOLLOWUPS', 'canRead')) return '/followup';
    return '/appointments';
  };

  return {
    isSuperAdmin,
    hasPermission,
    canAccessRoute,
    getFirstAllowedRoute,
    userPermissions,
  };
}
