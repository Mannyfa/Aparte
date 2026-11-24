/** ₦1,234,567 — whole naira by default. */
export const naira = (value, { decimals = 0 } = {}) =>
  '₦' + Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Dates from the API are stored as UTC calendar days; format them in UTC so the day never shifts. */
export const formatDay = (value, opts = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  value ? new Date(value).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' }) : '';

export const nightsBetween = (checkIn, checkOut) =>
  Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'A';
