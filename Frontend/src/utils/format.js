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

/** "Fri 12 Dec, 13:00" in the viewer's local time (for real moments, not calendar days). */
export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Ask Cloudinary for a resized, auto-format (WebP/AVIF), auto-quality version of an uploaded image.
 * Original uploads are often 3–8 MB phone photos; a 640px card image is ~40–80 KB.
 * Non-Cloudinary URLs are returned unchanged.
 */
export const img = (url, width = 800) => {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  if (/\/upload\/[^/]*(w_|f_auto)/.test(url)) return url; // already transformed
  return url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
};
