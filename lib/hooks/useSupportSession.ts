'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';
import { getQueryClient } from '../queryClient';
import { toast } from '@/components/Toast';
import type { ImpersonateResponse } from '../providers/types';

const OPERATOR_BACKUP_KEY = 'hcms_operator_backup_auth';

export function useSupportSession() {
  const router = useRouter();
  const { user, token, login } = useAuth();

  const isImpersonating = Boolean(user?.isSupportSession);

  const startSupportSession = (response: ImpersonateResponse) => {
    try {
      // 1. Backup existing operator credentials
      if (token && user) {
        sessionStorage.setItem(
          OPERATOR_BACKUP_KEY,
          JSON.stringify({ token, user }),
        );
      }

      // 2. Clear previous tenant cached queries
      try {
        getQueryClient().clear();
      } catch {
        // ignore
      }

      // 3. Switch active auth store to target tenant user & token
      login({
        token: response.data.token,
        user: response.data.user,
      });

      toast(`Support session started for ${response.data.user.doctorName}`, 'info');

      // 4. Hard redirect to clinic dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('Failed to start support session:', err);
      toast('Failed to enter support session.', 'error');
    }
  };

  const exitSupportSession = () => {
    try {
      const backupRaw = sessionStorage.getItem(OPERATOR_BACKUP_KEY);
      if (backupRaw) {
        const backup = JSON.parse(backupRaw);

        // Clear target tenant queries
        try {
          getQueryClient().clear();
        } catch {
          // ignore
        }

        // Restore AMAN operator credentials
        login(backup);
        sessionStorage.removeItem(OPERATOR_BACKUP_KEY);

        toast('Support session ended. Returned to Platform Console.', 'success');
        window.location.href = '/admin';
      } else {
        // Fallback: If no backup is stored, return to admin home
        window.location.href = '/admin';
      }
    } catch (err) {
      console.error('Failed to exit support session cleanly:', err);
      window.location.href = '/admin';
    }
  };

  return {
    isImpersonating,
    supportSessionUser: user,
    supportSessionBy: user?.supportSessionBy,
    supportReason: user?.supportReason,
    startSupportSession,
    exitSupportSession,
  };
}
