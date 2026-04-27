// Clasificados a BIA Sports 2026 (48 selecciones, nombres en español)
export const WORLD_CUP_2026_TEAMS = [
  { code: 'mx', name: 'México', flag: 'https://flagcdn.com/mx.svg' },
  { code: 'za', name: 'Sudáfrica', flag: 'https://flagcdn.com/za.svg' },
  { code: 'kr', name: 'República de Corea', flag: 'https://flagcdn.com/kr.svg' },
  { code: 'cz', name: 'República Checa', flag: 'https://flagcdn.com/cz.svg' },
  { code: 'ca', name: 'Canadá', flag: 'https://flagcdn.com/ca.svg' },
  { code: 'ba', name: 'Bosnia y Herzegovina', flag: 'https://flagcdn.com/ba.svg' },
  { code: 'us', name: 'EE. UU.', flag: 'https://flagcdn.com/us.svg' },
  { code: 'py', name: 'Paraguay', flag: 'https://flagcdn.com/py.svg' },
  { code: 'qa', name: 'Catar', flag: 'https://flagcdn.com/qa.svg' },
  { code: 'ch', name: 'Suiza', flag: 'https://flagcdn.com/ch.svg' },
  { code: 'br', name: 'Brasil', flag: 'https://flagcdn.com/br.svg' },
  { code: 'ma', name: 'Marruecos', flag: 'https://flagcdn.com/ma.svg' },
  { code: 'ht', name: 'Haití', flag: 'https://flagcdn.com/ht.svg' },
  { code: 'gb-sct', name: 'Escocia', flag: 'https://flagcdn.com/gb-sct.svg' },
  { code: 'au', name: 'Australia', flag: 'https://flagcdn.com/au.svg' },
  { code: 'tr', name: 'Turquía', flag: 'https://flagcdn.com/tr.svg' },
  { code: 'de', name: 'Alemania', flag: 'https://flagcdn.com/de.svg' },
  { code: 'cw', name: 'Curazao', flag: 'https://flagcdn.com/cw.svg' },
  { code: 'ci', name: 'Costa de Marfil', flag: 'https://flagcdn.com/ci.svg' },
  { code: 'ec', name: 'Ecuador', flag: 'https://flagcdn.com/ec.svg' },
  { code: 'nl', name: 'Países Bajos', flag: 'https://flagcdn.com/nl.svg' },
  { code: 'jp', name: 'Japón', flag: 'https://flagcdn.com/jp.svg' },
  { code: 'se', name: 'Suecia', flag: 'https://flagcdn.com/se.svg' },
  { code: 'tn', name: 'Túnez', flag: 'https://flagcdn.com/tn.svg' },
  { code: 'be', name: 'Bélgica', flag: 'https://flagcdn.com/be.svg' },
  { code: 'eg', name: 'Egipto', flag: 'https://flagcdn.com/eg.svg' },
  { code: 'ir', name: 'Irán', flag: 'https://flagcdn.com/ir.svg' },
  { code: 'nz', name: 'Nueva Zelanda', flag: 'https://flagcdn.com/nz.svg' },
  { code: 'es', name: 'España', flag: 'https://flagcdn.com/es.svg' },
  { code: 'cv', name: 'Cabo Verde', flag: 'https://flagcdn.com/cv.svg' },
  { code: 'sa', name: 'Arabia Saudita', flag: 'https://flagcdn.com/sa.svg' },
  { code: 'uy', name: 'Uruguay', flag: 'https://flagcdn.com/uy.svg' },
  { code: 'fr', name: 'Francia', flag: 'https://flagcdn.com/fr.svg' },
  { code: 'sn', name: 'Senegal', flag: 'https://flagcdn.com/sn.svg' },
  { code: 'iq', name: 'Irak', flag: 'https://flagcdn.com/iq.svg' },
  { code: 'no', name: 'Noruega', flag: 'https://flagcdn.com/no.svg' },
  { code: 'ar', name: 'Argentina', flag: 'https://flagcdn.com/ar.svg' },
  { code: 'dz', name: 'Argelia', flag: 'https://flagcdn.com/dz.svg' },
  { code: 'at', name: 'Austria', flag: 'https://flagcdn.com/at.svg' },
  { code: 'jo', name: 'Jordania', flag: 'https://flagcdn.com/jo.svg' },
  { code: 'pt', name: 'Portugal', flag: 'https://flagcdn.com/pt.svg' },
  { code: 'cd', name: 'RD Congo', flag: 'https://flagcdn.com/cd.svg' },
  { code: 'uz', name: 'Uzbekistán', flag: 'https://flagcdn.com/uz.svg' },
  { code: 'co', name: 'Colombia', flag: 'https://flagcdn.com/co.svg' },
  { code: 'gb-eng', name: 'Inglaterra', flag: 'https://flagcdn.com/gb-eng.svg' },
  { code: 'hr', name: 'Croacia', flag: 'https://flagcdn.com/hr.svg' },
  { code: 'gh', name: 'Ghana', flag: 'https://flagcdn.com/gh.svg' },
  { code: 'pa', name: 'Panamá', flag: 'https://flagcdn.com/pa.svg' },
];

export const SORTED_WORLD_CUP_2026_TEAMS = [...WORLD_CUP_2026_TEAMS].sort((left, right) =>
  left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
);

const TEAM_NAME_ALIASES = {
  mx: ['Mexico'],
  za: ['South Africa'],
  kr: ['Korea Republic', 'South Korea'],
  cz: ['Czechia', 'Czech Republic'],
  ba: ['Bosnia-Herzegovina', 'Bosnia and Herzegovina'],
  us: ['USA', 'United States', 'Estados Unidos'],
  qa: ['Qatar'],
  ch: ['Switzerland'],
  br: ['Brazil'],
  ma: ['Morocco'],
  ht: ['Haiti'],
  'gb-sct': ['Scotland'],
  tr: ['Turkey', 'Turkiye'],
  de: ['Germany'],
  cw: ['Curacao', 'Curaçao'],
  ci: ['Ivory Coast', "Cote d'Ivoire", "Côte d'Ivoire"],
  nl: ['Netherlands', 'Holland'],
  jp: ['Japan'],
  se: ['Sweden'],
  tn: ['Tunisia'],
  be: ['Belgium'],
  eg: ['Egypt'],
  ir: ['Iran', 'IR Iran'],
  nz: ['New Zealand'],
  es: ['Spain'],
  cv: ['Cape Verde'],
  sa: ['Saudi Arabia'],
  fr: ['France'],
  iq: ['Iraq'],
  no: ['Norway'],
  dz: ['Algeria'],
  jo: ['Jordan'],
  cd: ['Congo DR', 'DR Congo', 'Democratic Republic of the Congo'],
  uz: ['Uzbekistan'],
  'gb-eng': ['England'],
  hr: ['Croatia'],
  pa: ['Panama'],
};

function normalizeTeamLookupKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const WORLD_CUP_TEAM_LOOKUP = (() => {
  const lookup = new Map();

  WORLD_CUP_2026_TEAMS.forEach((team) => {
    lookup.set(normalizeTeamLookupKey(team.code), team);
    lookup.set(normalizeTeamLookupKey(team.name), team);

    const aliases = TEAM_NAME_ALIASES[team.code] || [];
    aliases.forEach((alias) => {
      lookup.set(normalizeTeamLookupKey(alias), team);
    });
  });

  return lookup;
})();

const PALETTES = {
  default: { primary: '#1d4ed8', secondary: '#f8fafc', accent: '#dc2626' },
  greenWhiteRed: { primary: '#15803d', secondary: '#f8fafc', accent: '#dc2626' },
  whiteRedBlue: { primary: '#f8fafc', secondary: '#dc2626', accent: '#1d4ed8' },
  redWhite: { primary: '#dc2626', secondary: '#f8fafc', accent: '#991b1b' },
  blueYellow: { primary: '#1d4ed8', secondary: '#facc15', accent: '#f8fafc' },
  navyWhiteRed: { primary: '#1e3a8a', secondary: '#f8fafc', accent: '#dc2626' },
  maroonWhite: { primary: '#7f1d1d', secondary: '#f8fafc', accent: '#b91c1c' },
  yellowGreenBlue: { primary: '#facc15', secondary: '#15803d', accent: '#1d4ed8' },
  redGreen: { primary: '#dc2626', secondary: '#15803d', accent: '#f8fafc' },
  blueRedWhite: { primary: '#2563eb', secondary: '#dc2626', accent: '#f8fafc' },
  navyWhiteSky: { primary: '#1e3a8a', secondary: '#f8fafc', accent: '#38bdf8' },
  goldNavyRed: { primary: '#facc15', secondary: '#1e3a8a', accent: '#dc2626' },
  blackRedGold: { primary: '#111827', secondary: '#dc2626', accent: '#facc15' },
  navyYellowSky: { primary: '#1e3a8a', secondary: '#facc15', accent: '#38bdf8' },
  orangeWhiteGreen: { primary: '#ea580c', secondary: '#f8fafc', accent: '#15803d' },
  yellowNavyRed: { primary: '#fcd34d', secondary: '#1e3a8a', accent: '#dc2626' },
  orangeNavyWhite: { primary: '#ea580c', secondary: '#1e3a8a', accent: '#f8fafc' },
  blackYellowRed: { primary: '#111827', secondary: '#facc15', accent: '#dc2626' },
  redWhiteBlack: { primary: '#dc2626', secondary: '#f8fafc', accent: '#111827' },
  blackWhiteRed: { primary: '#111827', secondary: '#f8fafc', accent: '#dc2626' },
  redYellowNavy: { primary: '#dc2626', secondary: '#facc15', accent: '#1e3a8a' },
  blueRedYellow: { primary: '#2563eb', secondary: '#dc2626', accent: '#facc15' },
  greenWhite: { primary: '#15803d', secondary: '#f8fafc', accent: '#166534' },
  skyWhiteNavy: { primary: '#38bdf8', secondary: '#f8fafc', accent: '#1e3a8a' },
  skyWhiteGold: { primary: '#38bdf8', secondary: '#f8fafc', accent: '#facc15' },
  blackGreenRed: { primary: '#111827', secondary: '#15803d', accent: '#dc2626' },
  redGreenGold: { primary: '#dc2626', secondary: '#15803d', accent: '#facc15' },
  skyYellowRed: { primary: '#38bdf8', secondary: '#facc15', accent: '#dc2626' },
  blueWhiteGreen: { primary: '#2563eb', secondary: '#f8fafc', accent: '#15803d' },
};

const TEAM_AVATAR_PALETTES = {
  mx: PALETTES.greenWhiteRed,
  za: PALETTES.redGreenGold,
  kr: PALETTES.whiteRedBlue,
  cz: PALETTES.whiteRedBlue,
  ca: PALETTES.redWhite,
  ba: PALETTES.blueYellow,
  us: PALETTES.navyWhiteRed,
  py: PALETTES.navyWhiteRed,
  qa: PALETTES.maroonWhite,
  ch: PALETTES.redWhite,
  br: PALETTES.yellowGreenBlue,
  ma: PALETTES.redGreen,
  ht: PALETTES.blueRedWhite,
  'gb-sct': PALETTES.navyWhiteSky,
  au: PALETTES.goldNavyRed,
  tr: PALETTES.redWhite,
  de: PALETTES.blackRedGold,
  cw: PALETTES.navyYellowSky,
  ci: PALETTES.orangeWhiteGreen,
  ec: PALETTES.yellowNavyRed,
  nl: PALETTES.orangeNavyWhite,
  jp: PALETTES.whiteRedBlue,
  se: PALETTES.blueYellow,
  tn: PALETTES.redWhite,
  be: PALETTES.blackYellowRed,
  eg: PALETTES.redWhiteBlack,
  ir: PALETTES.greenWhiteRed,
  nz: PALETTES.blackWhiteRed,
  es: PALETTES.redYellowNavy,
  cv: PALETTES.blueRedYellow,
  sa: PALETTES.greenWhite,
  uy: PALETTES.skyWhiteNavy,
  fr: PALETTES.navyWhiteRed,
  sn: PALETTES.redGreenGold,
  iq: PALETTES.redWhiteBlack,
  no: PALETTES.navyWhiteRed,
  ar: PALETTES.skyWhiteGold,
  dz: PALETTES.greenWhiteRed,
  at: PALETTES.redWhite,
  jo: PALETTES.blackGreenRed,
  pt: PALETTES.redGreenGold,
  cd: PALETTES.skyYellowRed,
  uz: PALETTES.blueWhiteGreen,
  co: PALETTES.yellowNavyRed,
  'gb-eng': PALETTES.whiteRedBlue,
  hr: PALETTES.navyWhiteRed,
  gh: PALETTES.redGreenGold,
  pa: PALETTES.whiteRedBlue,
};

export function getWorldCupTeam(teamCode) {
  return WORLD_CUP_2026_TEAMS.find((team) => team.code === teamCode) || null;
}

export function findWorldCupTeam(value) {
  const normalizedValue = normalizeTeamLookupKey(value);
  if (!normalizedValue) return null;
  return WORLD_CUP_TEAM_LOOKUP.get(normalizedValue) || null;
}

export function getCanonicalTeamDisplay(teamName, teamCode, teamFlag = '') {
  const canonicalTeam = getWorldCupTeam(teamCode) || findWorldCupTeam(teamName);

  if (canonicalTeam) {
    return canonicalTeam;
  }

  return {
    code: teamCode || '',
    name: teamName || '',
    flag: teamFlag || '',
  };
}

export function getTeamAvatarPalette(teamCode) {
  return TEAM_AVATAR_PALETTES[teamCode] || PALETTES.default;
}
