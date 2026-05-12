require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const axios = require('axios');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const API_URL = process.env.WC_API_URL || 'https://api.wc2026api.com';
const API_TOKEN = process.env.WC_API_TOKEN || 'wc26_2mPk1ZBkoqqd5ApKg2PjzV';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

// Fallback match data for World Cup 2026 (104 matches)
const generateFallbackMatches = () => {
  const teams = {
    A: ['Mexico', 'Sudáfrica', 'República de Corea', 'República Checa'],
    B: ['Canadá', 'Bosnia y Herzegovina', 'EE. UU.', 'Paraguay'],
    C: ['Catar', 'Suiza', 'Brasil', 'Marruecos'],
    D: ['Haití', 'Escocia', 'Australia', 'Turquía'],
    E: ['Alemania', 'Curazao', 'Costa de Marfil', 'Ecuador'],
    F: ['Países Bajos', 'Japón', 'Suecia', 'Túnez'],
    G: ['Bélgica', 'Egipto', 'Irán', 'Nueva Zelanda'],
    H: ['España', 'Cabo Verde', 'Arabia Saudita', 'Uruguay'],
    I: ['Francia', 'Senegal', 'Irak', 'Noruega'],
    J: ['Argentina', 'Argelia', 'Austria', 'Jordania'],
    K: ['Portugal', 'RD Congo', 'Uzbekistán', 'Colombia'],
    L: ['Inglaterra', 'Croacia', 'Ghana', 'Panamá'],
  };

  const stadiums = [
    'MetLife Stadium, New Jersey',
    'AT&T Stadium, Dallas',
    'SoFi Stadium, Los Angeles',
    'Levi\'s Stadium, San Francisco',
    'Hard Rock Stadium, Miami',
    'Mercedes-Benz Stadium, Atlanta',
    'Arrowhead Stadium, Kansas City',
    'Gillette Stadium, Boston',
    'Lincoln Financial Field, Philadelphia',
    'Empower Field, Denver',
    'BC Place, Vancouver',
    'BMO Field, Toronto',
    'Estadio Azteca, Mexico City',
    'Estadio BBVA, Monterrey',
    'Estadio Akron, Guadalajara',
    'Estadio Ciudad de Mexico, Mexico City',
  ];

  const matches = [];
  let matchId = 1;
  const startDate = new Date('2026-06-11');

  // Group stage: each group has 6 matches (3 rounds of 2 matches)
  GROUPS.forEach((group, groupIndex) => {
    const groupTeams = teams[group] || ['Team A', 'Team B', 'Team C', 'Team D'];
    const matchups = [
      [0, 1], [2, 3], // Round 1
      [0, 2], [1, 3], // Round 2
      [0, 3], [1, 2], // Round 3
    ];

    matchups.forEach(([homeIdx, awayIdx], matchIndex) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + Math.floor(matchIndex / 2) * 2 + groupIndex);

      matches.push({
        matchId: `group_${matchId}`,
        homeTeam: groupTeams[homeIdx],
        awayTeam: groupTeams[awayIdx],
        date: date.toISOString().split('T')[0],
        time: ['15:00', '18:00', '21:00'][matchIndex % 3],
        stadium: stadiums[(matchId - 1) % stadiums.length],
        group: group,
        round: 'Group Stage',
        roundNumber: Math.floor(matchIndex / 2) + 1,
        status: 'scheduled',
        homeScore: null,
        awayScore: null,
        homeTeamFlag: `https://flagcdn.com/w40/${getCountryCode(groupTeams[homeIdx])}.png`,
        awayTeamFlag: `https://flagcdn.com/w40/${getCountryCode(groupTeams[awayIdx])}.png`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      matchId++;
    });
  });

  // Round of 32 (32 matches)
  for (let i = 1; i <= 32; i++) {
    const date = new Date('2026-07-04');
    date.setDate(date.getDate() + Math.floor((i - 1) / 4));
    matches.push({
      matchId: `r32_${i}`,
      homeTeam: `Winner Group ${GROUPS[(i - 1) % 12] || 'TBD'}`,
      awayTeam: `Runner-up Group ${GROUPS[i % 12] || 'TBD'}`,
      date: date.toISOString().split('T')[0],
      time: ['15:00', '18:00', '21:00'][i % 3],
      stadium: stadiums[i % stadiums.length],
      group: null,
      round: 'Round of 32',
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Round of 16 (16 matches)
  for (let i = 1; i <= 16; i++) {
    const date = new Date('2026-07-12');
    date.setDate(date.getDate() + Math.floor((i - 1) / 2));
    matches.push({
      matchId: `r16_${i}`,
      homeTeam: `Winner R32 Match ${i * 2 - 1}`,
      awayTeam: `Winner R32 Match ${i * 2}`,
      date: date.toISOString().split('T')[0],
      time: ['18:00', '21:00'][i % 2],
      stadium: stadiums[i % stadiums.length],
      group: null,
      round: 'Round of 16',
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Quarter Finals (8 matches)
  for (let i = 1; i <= 8; i++) {
    const date = new Date('2026-07-20');
    date.setDate(date.getDate() + Math.floor((i - 1) / 2));
    matches.push({
      matchId: `qf_${i}`,
      homeTeam: `Winner R16 Match ${i * 2 - 1}`,
      awayTeam: `Winner R16 Match ${i * 2}`,
      date: date.toISOString().split('T')[0],
      time: '21:00',
      stadium: stadiums[i % stadiums.length],
      group: null,
      round: 'Quarter Final',
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Semi Finals (4 matches)
  for (let i = 1; i <= 4; i++) {
    const date = new Date('2026-07-28');
    date.setDate(date.getDate() + (i - 1));
    matches.push({
      matchId: `sf_${i}`,
      homeTeam: `Winner QF Match ${i * 2 - 1}`,
      awayTeam: `Winner QF Match ${i * 2}`,
      date: date.toISOString().split('T')[0],
      time: '21:00',
      stadium: stadiums[0],
      group: null,
      round: 'Semi Final',
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Third Place Match
  matches.push({
    matchId: 'third_place',
    homeTeam: 'Loser SF Match 1',
    awayTeam: 'Loser SF Match 2',
    date: '2026-08-01',
    time: '18:00',
    stadium: 'MetLife Stadium, New Jersey',
    group: null,
    round: 'Third Place',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Final
  matches.push({
    matchId: 'final',
    homeTeam: 'Winner SF Match 1',
    awayTeam: 'Winner SF Match 2',
    date: '2026-08-03',
    time: '21:00',
    stadium: 'MetLife Stadium, New Jersey',
    group: null,
    round: 'Final',
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return matches;
};

function getCountryCode(teamName) {
  const codes = {
    // En español (como vienen de la API)
    'Mexico': 'mx',
    'Sudáfrica': 'za',
    'República de Corea': 'kr',
    'República Checa': 'cz',
    'Canadá': 'ca',
    'Bosnia y Herzegovina': 'ba',
    'EE. UU.': 'us',
    'Paraguay': 'py',
    'Catar': 'qa',
    'Suiza': 'ch',
    'Brasil': 'br',
    'Marruecos': 'ma',
    'Haití': 'ht',
    'Escocia': 'gb-sct',
    'Australia': 'au',
    'Turquía': 'tr',
    'Alemania': 'de',
    'Curazao': 'cw',
    'Costa de Marfil': 'ci',
    'Ecuador': 'ec',
    'Países Bajos': 'nl',
    'Japón': 'jp',
    'Suecia': 'se',
    'Túnez': 'tn',
    'Bélgica': 'be',
    'Egipto': 'eg',
    'Irán': 'ir',
    'Nueva Zelanda': 'nz',
    'España': 'es',
    'Cabo Verde': 'cv',
    'Arabia Saudita': 'sa',
    'Uruguay': 'uy',
    'Francia': 'fr',
    'Senegal': 'sn',
    'Irak': 'iq',
    'Noruega': 'no',
    'Argentina': 'ar',
    'Argelia': 'dz',
    'Austria': 'at',
    'Jordania': 'jo',
    'Portugal': 'pt',
    'RD Congo': 'cd',
    'Uzbekistán': 'uz',
    'Colombia': 'co',
    'Inglaterra': 'gb-eng',
    'Croacia': 'hr',
    'Ghana': 'gh',
    'Panamá': 'pa',
    
    // En inglés (por si acaso la API devuelve algunos en inglés)
    'Mexico': 'mx',
    'South Africa': 'za',
    'Korea Republic': 'kr',
    'Czechia': 'cz',
    'Canada': 'ca',
    'Bosnia-Herzegovina': 'ba',
    'USA': 'us',
    'Paraguay': 'py',
    'Qatar': 'qa',
    'Switzerland': 'ch',
    'Brazil': 'br',
    'Morocco': 'ma',
    'Haiti': 'ht',
    'Scotland': 'gb-sct',
    'Australia': 'au',
    'Turkey': 'tr',
    'Germany': 'de',
    'Curaçao': 'cw',
    'Ivory Coast': 'ci',
    'Côte d\'Ivoire': 'ci',
    'Cote d\'Ivoire': 'ci',
    'Ecuador': 'ec',
    'Netherlands': 'nl',
    'Japan': 'jp',
    'Sweden': 'se',
    'Tunisia': 'tn',
    'Belgium': 'be',
    'Egypt': 'eg',
    'IR Iran': 'ir',
    'New Zealand': 'nz',
    'Spain': 'es',
    'Cabo Verde': 'cv',
    'Saudi Arabia': 'sa',
    'Uruguay': 'uy',
    'France': 'fr',
    'Senegal': 'sn',
    'Iraq': 'iq',
    'Norway': 'no',
    'Argentina': 'ar',
    'Algeria': 'dz',
    'Austria': 'at',
    'Jordan': 'jo',
    'Portugal': 'pt',
    'Congo DR': 'cd',
    'Uzbekistan': 'uz',
    'Colombia': 'co',
    'England': 'gb-eng',
    'Croatia': 'hr',
    'Ghana': 'gh',
    'Panama': 'pa',
  };
  
  return codes[teamName] || 'xx';
}

async function fetchMatchesFromAPI() {
   try {
    console.log('Fetching matches from API...');
    const response = await axios.get(`${API_URL}/matches`, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`
      },
      timeout: 10000,
    });

    // Convertir UTC a hora colombiana (UTC-5)
     const matchesWithMapping = response.data.map((match, index) => {
      const utcDate = new Date(match.kickoff_utc);
      
      // Convertir a hora colombiana (UTC-5)
      const colombiaDate = new Date(utcDate.getTime() - (5 * 60 * 60 * 1000));
      
      const homeCode = getCountryCode(match.home_team);
      const awayCode = getCountryCode(match.away_team);
      return {
        id: match.id || `match_${index}`,
        matchId: match.id || `match_${index}`,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        homeTeamCode: homeCode,
        awayTeamCode: awayCode,
        homeTeamFlag: `https://flagcdn.com/w40/${homeCode}.png`,
        awayTeamFlag: `https://flagcdn.com/w40/${awayCode}.png`,
        date: colombiaDate.toISOString().split('T')[0],
        time: colombiaDate.toISOString().split('T')[1].substring(0, 5),
        stadium: match.stadium,
        group: match.group_name || null,
        round: match.round === 'group' ? 'Group Stage' : match.round,
        status: match.status || 'scheduled',
        homeScore: match.home_score,
        awayScore: match.away_score,
      };
    });

    return matchesWithMapping;
  } catch (error) {
    console.warn(`API fetch failed: ${error.message}. Using fallback data.`);
    return null;
  }
}

async function seedMatches() {
  try {
    console.log('Starting match seeding...');

    const apiData = await fetchMatchesFromAPI();
    const matches = apiData || generateFallbackMatches();

    console.log(`Seeding ${matches.length} matches...`);

    let totalSeeded = 0;

    for (const match of matches) {
      const matchId = String(match.matchId || match.id || `match_${totalSeeded + 1}`);

      if (!matchId || matchId.trim() === '') {
        console.warn('Skipping match without ID:', match);
        continue;
      }

      await prisma.match.upsert({
        where: { id: matchId },
        update: {},
        create: {
          id: matchId,
          homeTeam: match.homeTeam || match.home_team || '',
          awayTeam: match.awayTeam || match.away_team || '',
          date: match.date || '',
          time: match.time || '00:00',
          status: match.status || 'scheduled',
          round: match.round || null,
          group: match.group || null,
          homeScore: match.homeScore ?? null,
          awayScore: match.awayScore ?? null,
          homeTeamCode: match.homeTeamCode || null,
          awayTeamCode: match.awayTeamCode || null,
          homeTeamFlag: match.homeTeamFlag || null,
          awayTeamFlag: match.awayTeamFlag || null,
        },
      });
      totalSeeded++;
    }

    console.log(`Successfully seeded ${totalSeeded} matches!`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding matches:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

seedMatches();
