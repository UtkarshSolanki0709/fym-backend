/** Quota and daily reset utilities */
export function needsReset(resetDate: string | null): boolean {
  if (!resetDate) return true;
  const d = new Date(resetDate);
  const now = new Date();
  return (
    d.getUTCFullYear() !== now.getUTCFullYear() ||
    d.getUTCMonth() !== now.getUTCMonth() ||
    d.getUTCDate() !== now.getUTCDate()
  );
}
