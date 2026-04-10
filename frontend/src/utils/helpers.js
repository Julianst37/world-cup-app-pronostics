/**
 * Helper utilities
 */

/**
 * Generate a random invite code
 */
export function generateInviteCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Format a date+time string to Colombia time (UTC-5).
 * Assumes dateStr is "YYYY-MM-DD" and timeStr is "HH:MM" in UTC.
 */
export function formatColombiaTime(dateStr, timeStr = '00:00') {
  if (!dateStr) return '';
  // Combine date and time as UTC (appending 'Z')
  const dateTime = new Date(`${dateStr}T${timeStr}:00Z`);
  return dateTime.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate prediction points based on match result
 */
export function calculatePoints(prediction, actual, pointConfig = { exact: 3, difference: 2, winner: 1 }) {
  if (!prediction || !actual) return 0;

  const { homeScore: pH, awayScore: pA } = prediction;
  const { homeScore: aH, awayScore: aA } = actual;

  if (pH === aH && pA === aA) return pointConfig.exact;

  const pDiff = pH - pA;
  const aDiff = aH - aA;
  if (pDiff === aDiff) return pointConfig.difference;

  const pWinner = Math.sign(pDiff);
  const aWinner = Math.sign(aDiff);
  if (pWinner === aWinner) return pointConfig.winner;

  return 0;
}

/**
 * Truncate text
 */
export function truncate(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Get flag URL for a country code
 */
export function getFlagUrl(countryCode, size = 40) {
  if (!countryCode) return '';
  return `https://flagcdn.com/w${size}/${countryCode.toLowerCase()}.png`;
}
