import { Suspense } from 'react';
import NewVisitForm from './NewVisitForm';

export default function NewVisitPage() {
  return (
    <Suspense fallback={<div className="loading-state">Loading visit form...</div>}>
      <NewVisitForm />
    </Suspense>
  );
}
