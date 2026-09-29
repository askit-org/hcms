'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageMeta } from '@/lib/providers/types';

export default function Pagination({
  meta,
  onPageChange,
  disabled = false,
}: {
  meta: PageMeta | undefined;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (!meta || meta.total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(meta.total / Math.max(1, meta.limit)));
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.total, meta.page * meta.limit);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Showing {from}–{to} of {meta.total}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={disabled || meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Page {meta.page} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={disabled || meta.page >= totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
