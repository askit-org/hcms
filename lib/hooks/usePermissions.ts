// lib/hooks/usePermissions.ts
// Client-side permission evaluator & route guard hook

import { useAuth, type AuthUser } from './useAuth';
import type { AppModel, ModelPermission } from '../providers/types';

/** Home of the platform operator (AMAN) console. */
export const ADMIN_HOME_ROUTE = '/admin';

/** True for the global platform operator. AMAN is not a clinic role and gets no clinic screens. */
export function isPlatformAdminUser(user: AuthUser | null | undefined): boolean {
  return user?.platformRole === 'AMAN';
}

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

  const isPlatformAdmin = isPlatformAdminUser(user);

  const roleCode = (user?.roleCode || user?.role || '').toString().toUpperCase();
  const roleName = (user?.roleName || '').toLowerCase();
  const isReceptionist = roleCode === 'RECEPTIONIST' || roleName.includes('receptionist');

  // Super Admin / Root Account Owner has full uninhibited access
  const isSuperAdmin =
    !isPlatformAdmin && !isReceptionist && (user?.role === 'SUPER_ADMIN' || user?.roleCode === 'SUPER_ADMIN');

  const userPermissions: ModelPermission[] = user?.permissions || [];

  const hasPermission = (
    model: AppModel,
    action: 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete' = 'canRead'
  ): boolean => {
    if (isPlatformAdmin) return false; // no clinic data access
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
    const isAdminRoute = pathname === ADMIN_HOME_ROUTE || pathname.startsWith(`${ADMIN_HOME_ROUTE}/`);
    if (isPlatformAdmin) return isAdminRoute;
    if (isAdminRoute) return false;
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
    if (isPlatformAdmin) return ADMIN_HOME_ROUTE;
    if (isSuperAdmin) return '/dashboard';
    if (hasPermission('PATIENTS', 'canRead')) return '/appointments';
    if (hasPermission('FOLLOWUPS', 'canRead')) return '/followup';
    return '/appointments';
  };

  return {
    isPlatformAdmin,
    isSuperAdmin,
    hasPermission,
    canAccessRoute,
    getFirstAllowedRoute,
    userPermissions,
  };
}
