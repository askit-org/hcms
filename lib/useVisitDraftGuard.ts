import { useState, useEffect } from 'react';
import { getVisitDraft } from './visitDraft';

export function useVisitDraftGuard() {
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const checkGuard = (targetHref: string, currentPathname: string): boolean => {
    // Only guard if we are leaving /visits/new
    if (currentPathname.startsWith('/visits/new') && targetHref !== '/visits/new') {
      const draft = getVisitDraft();
      if (draft && (draft.patient || draft.form.chiefComplaints || draft.form.diagnosis || draft.rxMeds.length > 0)) {
        setPendingHref(targetHref);
        return true; // guarded, show confirmation modal
      }
    }
    return false; // free to navigate
  };

  const cancelNavigation = () => setPendingHref(null);

  return {
    pendingHref,
    checkGuard,
    cancelNavigation,
  };
}
