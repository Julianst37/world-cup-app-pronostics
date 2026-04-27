/**
 * Helper utilities
 */

import { PLAYOFF_ROUNDS, ROUNDS } from './constants';

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
export function formatColombiaTime(dateString, timeString) {
  try {
    // Si viene como ISO string completo
    if (dateString && !timeString) {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-CO', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    
    // Si viene separado (fecha y hora)
    const date = new Date(`${dateString}T${timeString}`);
    return date.toLocaleDateString('es-CO', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return dateString;
  }
}

export function parseMatchDateTime(dateString, timeString = '00:00') {
  if (!dateString) return null;

  const normalizedTime = String(timeString || '00:00').trim().toUpperCase();
  const amPmMatch = normalizedTime.match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]M)$/);

  if (amPmMatch) {
    const [, rawHours, rawMinutes = '00', meridiem] = amPmMatch;
    let hours = parseInt(rawHours, 10);
    const minutes = parseInt(rawMinutes, 10);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return null;
    }

    if (meridiem === 'AM') {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }

    return new Date(`${dateString}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  }

  const twentyFourHourMatch = normalizedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (twentyFourHourMatch) {
    const [, rawHours, rawMinutes, rawSeconds = '00'] = twentyFourHourMatch;
    return new Date(
      `${dateString}T${String(parseInt(rawHours, 10)).padStart(2, '0')}:${rawMinutes}:${rawSeconds}`
    );
  }

  const fallbackDate = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

export function isUpcomingMatch(match, now = new Date()) {
  if (!match || match.status === 'finished') {
    return false;
  }

  const matchDateTime = parseMatchDateTime(match.date, match.time);
  if (!matchDateTime) {
    return false;
  }

  return matchDateTime >= now;
}

const ROUND_DISPLAY_NAMES = {
  'Group Stage': 'Fase de grupos',
  'Round of 32': '16vos de final',
  'R32': '16vos de final',
  'Round of 16': '8vos de final',
  'R16': '8vos de final',
  'Quarter Final': '4tos de final',
  Quarterfinals: '4tos de final',
  QF: '4tos de final',
  'Semi Final': 'Semifinales',
  Semifinals: 'Semifinales',
  SF: 'Semifinales',
  'Third Place': 'Tercer puesto',
  '3rd Place': 'Tercer puesto',
  '3rd': 'Tercer puesto',
  Final: 'Final',
  final: 'Final',
};

const ROUND_NORMALIZATION_MAP = {
  R32: ROUNDS.ROUND_OF_32,
  'Round of 32': ROUNDS.ROUND_OF_32,
  R16: ROUNDS.ROUND_OF_16,
  'Round of 16': ROUNDS.ROUND_OF_16,
  'Quarter Final': ROUNDS.QUARTER_FINAL,
  Quarterfinals: ROUNDS.QUARTER_FINAL,
  QF: ROUNDS.QUARTER_FINAL,
  'Semi Final': ROUNDS.SEMI_FINAL,
  Semifinals: ROUNDS.SEMI_FINAL,
  SF: ROUNDS.SEMI_FINAL,
  'Third Place': ROUNDS.THIRD_PLACE,
  '3rd Place': ROUNDS.THIRD_PLACE,
  '3rd': ROUNDS.THIRD_PLACE,
  Final: ROUNDS.FINAL,
  final: ROUNDS.FINAL,
};

export function normalizeRoundName(round) {
  if (!round) return '';
  return ROUND_NORMALIZATION_MAP[round] || round;
}

export function isPlayoffRound(round) {
  return PLAYOFF_ROUNDS.includes(normalizeRoundName(round));
}

export function isRoundGloballyEnabled(round, playoffRounds = {}) {
  const normalizedRound = normalizeRoundName(round);

  if (!PLAYOFF_ROUNDS.includes(normalizedRound)) {
    return true;
  }

  return playoffRounds[normalizedRound] === true;
}

export function getRoundDisplayName(round) {
  if (!round) return '';
  const normalizedRound = normalizeRoundName(round);
  return ROUND_DISPLAY_NAMES[normalizedRound] || ROUND_DISPLAY_NAMES[round] || normalizedRound;
}

/**
 * Calculate prediction points based on match result
 */
export function calculatePoints(prediction, actual, pointConfig = { exact: 3, difference: 2, winner: 1 }) {
  if (!prediction || !actual) return 0;

  const { homeScore: pH, awayScore: pA } = prediction;
  const { homeScore: aH, awayScore: aA } = actual;
  let totalPoints = 0;

  const pDiff = pH - pA;
  const aDiff = aH - aA;
  const pWinner = Math.sign(pDiff);
  const aWinner = Math.sign(aDiff);

  if (pWinner === aWinner) {
    totalPoints += pointConfig.winner;
  }

  if (pDiff === aDiff) {
    totalPoints += pointConfig.difference;
  }

  if (pH === aH) {
    totalPoints += pointConfig.exact;
  }

  if (pA === aA) {
    totalPoints += pointConfig.exact;
  }

  return totalPoints;
}

export function calculateTournamentPredictionPoints(prediction, match, tournament) {
  if (!prediction || !match || match.status !== 'finished') return null;
  if (!tournament?.pointConfig) return null;

  const multiplier = normalizeRoundName(match.round) !== ROUNDS.GROUP_STAGE
    ? (tournament.secondRoundMultiplier || 2)
    : 1;

  return calculatePoints(prediction, match, tournament.pointConfig) * multiplier;
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
