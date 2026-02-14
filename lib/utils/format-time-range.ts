/**
 * Format task time for display.
 * - Only start time: "HH:mm ~"
 * - Start + end time: "HH:mm ~ HH:mm"
 * - Only end time: "~ HH:mm"
 */
export function formatTimeRange(
  dueTime: string | null,
  dueTimeEnd: string | null
): string | null {
  const start = dueTime ? dueTime.substring(0, 5) : null;
  const end = dueTimeEnd ? dueTimeEnd.substring(0, 5) : null;
  if (start && end) return `${start} ~ ${end}`;
  if (start) return `${start} ~`;
  if (end) return `~ ${end}`;
  return null;
}
