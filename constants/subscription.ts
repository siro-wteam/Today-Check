/**
 * Subscription / Freemium limits
 * Free tier: capped. Paid tier: unlimited (checks skipped when isSubscribed).
 * Change these constants when adjusting free-tier limits.
 */

/** Free: max groups a user can create */
export const FREE_MAX_GROUPS = 2;

/** Free: max backlog tasks (due_date = null) */
export const FREE_MAX_BACKLOG = 5;

/** Free: max tasks per calendar date (any date); applies to due_date = that date (including rollover) */
export const FREE_MAX_TASKS_PER_DATE = 5;

/** Paid tier: no numeric limit (use Infinity or skip checks when isSubscribed) */
export const PAID_UNLIMITED = Infinity;
