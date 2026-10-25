const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-08-19" -> "19 Aug 2026", "2027-09" -> "Sep 2027". Anything else is returned as-is.
export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value);
  if (!m) return value;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return value;
  return m[3] ? `${Number(m[3])} ${month} ${m[1]}` : `${month} ${m[1]}`;
}
