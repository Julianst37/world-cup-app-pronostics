/**
 * App constants
 */

export const APP_NAME = 'Mundial 2026 Pronósticos';

export const SUPER_ADMIN_EMAIL = 'admin@worldcup2026.com';

export const PLATFORM_COLLECTION = 'platform';
export const PLATFORM_SETTINGS_DOC = 'settings';

export const ROUNDS = {
  GROUP_STAGE: 'Group Stage',
  ROUND_OF_32: 'Round of 32',
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINAL: 'Quarter Final',
  SEMI_FINAL: 'Semi Final',
  THIRD_PLACE: 'Third Place',
  FINAL: 'Final',
};

export const PLAYOFF_ROUNDS = [
  ROUNDS.ROUND_OF_32,
  ROUNDS.ROUND_OF_16,
  ROUNDS.QUARTER_FINAL,
  ROUNDS.SEMI_FINAL,
  ROUNDS.THIRD_PLACE,
  ROUNDS.FINAL,
];

export const DEFAULT_GLOBAL_ROUND_SETTINGS = {
  [ROUNDS.ROUND_OF_32]: false,
  [ROUNDS.ROUND_OF_16]: false,
  [ROUNDS.QUARTER_FINAL]: false,
  [ROUNDS.SEMI_FINAL]: false,
  [ROUNDS.THIRD_PLACE]: false,
  [ROUNDS.FINAL]: false,
};

export const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
  POSTPONED: 'postponed',
};

export const PARTICIPANT_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  REJECTED: 'rejected',
  INACTIVE: 'inactive',
};

export const DEFAULT_POINT_CONFIG = {
  exact: 3,
  difference: 2,
  winner: 1,
};

export const WC2026_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export const WC2026_DATES = {
  start: '2026-06-11',
  end: '2026-07-19',
};

export const ROUTES = {
  HOME: '/',
  LOGIN: '/auth/login',
  SIGNUP: '/auth/signup',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  CREATE_TOURNAMENT: '/tournaments/create',
  TOURNAMENT: (id) => `/tournaments/${id}`,
  TOURNAMENT_HOME: (id) => `/tournaments/${id}/home`,
  TOURNAMENT_PREDICTIONS: (id) => `/tournaments/${id}/predictions`,
  TOURNAMENT_STANDINGS: (id) => `/tournaments/${id}/standings`,
  TOURNAMENT_PARTICIPANTS: (id) => `/tournaments/${id}/participants`,
  TOURNAMENT_SETTINGS: (id) => `/tournaments/${id}/settings`,
  MATCH_DETAIL: (id) => `/matches/${id}`,
};
