import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export function Pagination({
  total,
  limit,
  offset,
  onChange,
  itemLabel = 'items',
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
  itemLabel?: string;
}) {
  if (total <= limit) return null;
  const start = Math.min(offset + 1, total);
  const end = Math.min(offset + limit, total);
  const hasPrevious = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-100 px-1 pt-4 sm:flex-row">
      <p className="text-xs text-ink-500">
        Showing <span className="font-semibold text-ink-800">{start}</span>–
        <span className="font-semibold text-ink-800">{end}</span> of{' '}
        <span className="font-semibold text-ink-800">{total}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasPrevious}
          onClick={() => onChange(Math.max(0, offset - limit))}
          leftIcon={<ChevronLeft className="size-4" />}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasNext}
          onClick={() => onChange(offset + limit)}
          rightIcon={<ChevronRight className="size-4" />}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
