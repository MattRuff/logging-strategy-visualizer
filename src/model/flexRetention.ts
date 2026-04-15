/** Flex storage is priced in 30-day buckets; UI options match that model. */
export const FLEX_RETENTION_DAY_OPTIONS: readonly number[] = Array.from(
  { length: 15 },
  (_, i) => (i + 1) * 30
);

export function nearestFlexRetentionDays(days: number): number {
  const rounded = Math.round(days / 30) * 30;
  return Math.min(450, Math.max(30, rounded));
}
