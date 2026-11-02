import { formatDate } from '../../lib/format';
import type { ActivityPoint } from '../../types/api';

/**
 * Tiny dependency-free bar chart for seven days of request/response activity.
 */
export function ActivityChart({ points }: { points: ActivityPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-ink-500">No activity recorded yet.</p>;
  }

  const max = Math.max(1, ...points.map((point) => Math.max(point.requests, point.responses)));

  return (
    <div>
      <div className="flex h-36 items-end gap-2 sm:gap-3" role="img" aria-label="Seven-day request and response activity">
        {points.map((point) => {
          const day = new Date(point.day);
          const label = Number.isNaN(day.getTime())
            ? point.day
            : new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day);
          return (
            <div key={point.day} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex h-28 w-full items-end justify-center gap-1">
                <div
                  className="w-1/3 rounded-t bg-brand-500"
                  style={{ height: `${(point.requests / max) * 100}%` }}
                  title={`${point.requests} requests`}
                />
                <div
                  className="w-1/3 rounded-t bg-accent-500"
                  style={{ height: `${(point.responses / max) * 100}%` }}
                  title={`${point.responses} responses`}
                />
              </div>
              <span className="text-[0.65rem] font-medium uppercase tracking-wide text-ink-500">
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand-500" aria-hidden="true" />
          Requests
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-accent-500" aria-hidden="true" />
          Responses
        </span>
        <span className="ml-auto">Last {points.length} days</span>
      </div>
      <p className="mt-2 text-xs text-ink-500">
        From {formatDate(points[0]?.day)} to {formatDate(points[points.length - 1]?.day)}
      </p>
    </div>
  );
}
