require('dotenv').config();
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin
const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const API_URL = process.env.WC_API_URL || 'https://api.wc2026api.com';
const API_TOKEN = process.env.WC_API_TOKEN || 'wc26_2mPk1ZBkoqqd5ApKg2PjzV';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

// Fallback match data for World Cup 2026 (104 matches)
const generateFallbackMatches = () => {
  const teams = {
    A: ['Mexico', 'USA', 'Canada', 'TBD'],
    B: ['Argentina', 'Ecuador', 'Chile', 'Peru'],
    C: ['Brazil', 'Colombia', 'Venezuela', 'Bolivia'],
    D: ['Germany', 'Netherlands', 'Belgium', 'Denmark'],
    E: ['France', 'Spain', 'Portugal', 'Switzerland'],
    F: ['England', 'Italy', 'Croatia', 'Ukraine'],
    G: ['Japan', 'South Korea', 'Australia', 'Saudi Arabia'],
    H: ['Morocco', 'Senegal', 'Tunisia', 'Egypt'],
    I: ['Uruguay', 'Paraguay', 'Ecuador', 'TBD'],
    J: ['Poland', 'Czech Republic', 'Slovakia', 'Hungary'],
    K: ['Serbia', 'Romania', 'Turkey', 'Albania'],
    L: ['Iran', 'Qatar', 'Iraq', 'UAE'],
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
    Mexico: 'mx', USA: 'us', Canada: 'ca',
    Argentina: 'ar', Ecuador: 'ec', Chile: 'cl', Peru: 'pe',
    Brazil: 'br', Colombia: 'co', Venezuela: 've', Bolivia: 'bo',
    Germany: 'de', Netherlands: 'nl', Belgium: 'be', Denmark: 'dk',
    France: 'fr', Spain: 'es', Portugal: 'pt', Switzerland: 'ch',
    England: 'gb-eng', Italy: 'it', Croatia: 'hr', Ukraine: 'ua',
    Japan: 'jp', 'South Korea': 'kr', Australia: 'au', 'Saudi Arabia': 'sa',
    Morocco: 'ma', Senegal: 'sn', Tunisia: 'tn', Egypt: 'eg',
    Uruguay: 'uy', Paraguay: 'py', Poland: 'pl', 'Czech Republic': 'cz',
    Slovakia: 'sk', Hungary: 'hu', Serbia: 'rs', Romania: 'ro',
    Turkey: 'tr', Albania: 'al', Iran: 'ir', Qatar: 'qa', Iraq: 'iq', UAE: 'ae',
  };
  return codes[teamName] || 'xx';
}

async function fetchMatchesFromAPI() {
  try {
    console.log('Fetching matches from API...');
    const response = await axios.get(`${API_URL}/matches`, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    console.warn(`API fetch failed: ${error.message}. Using fallback data.`);
    return null;
  }
}

async function seedMatches() {
  try {
    console.log('Starting match seeding...');

    // Try to fetch from API first, fall back to generated data
    const apiData = await fetchMatchesFromAPI();
    const matches = apiData || generateFallbackMatches();

    console.log(`Seeding ${matches.length} matches...`);

    const batch = db.batch();
    let batchCount = 0;
    let totalSeeded = 0;

    for (const match of matches) {
      const docRef = db.collection('matches').doc(match.matchId || `match_${totalSeeded + 1}`);
      const matchData = {
        ...match,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      batch.set(docRef, matchData, { merge: true });
      batchCount++;
      totalSeeded++;

      // Firestore batches can hold max 500 operations
      if (batchCount === 490) {
        await batch.commit();
        console.log(`Committed batch of ${batchCount} matches...`);
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`✅ Successfully seeded ${totalSeeded} matches!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding matches:', error);
    process.exit(1);
  }
}

seedMatches();
