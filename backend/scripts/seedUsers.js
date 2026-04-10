require('dotenv').config();
const admin = require('firebase-admin');

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
const auth = admin.auth();

const TEST_USERS = [
  {
    email: 'admin@worldcup2026.com',
    password: 'Admin123!@',
    displayName: 'Admin User',
    username: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    isAdmin: true,
  },
  {
    email: 'usuario1@test.com',
    password: 'Test123!@',
    displayName: 'Juan García',
    username: 'juangarcia',
    firstName: 'Juan',
    lastName: 'García',
    isAdmin: false,
  },
  {
    email: 'usuario2@test.com',
    password: 'Test123!@',
    displayName: 'María López',
    username: 'marialopez',
    firstName: 'María',
    lastName: 'López',
    isAdmin: false,
  },
  {
    email: 'usuario3@test.com',
    password: 'Test123!@',
    displayName: 'Carlos Martínez',
    username: 'carlosmartinez',
    firstName: 'Carlos',
    lastName: 'Martínez',
    isAdmin: false,
  },
  {
    email: 'usuario4@test.com',
    password: 'Test123!@',
    displayName: 'Ana Rodríguez',
    username: 'anarodriguez',
    firstName: 'Ana',
    lastName: 'Rodríguez',
    isAdmin: false,
  },
  {
    email: 'usuario5@test.com',
    password: 'Test123!@',
    displayName: 'Pedro Sánchez',
    username: 'pedrosanchez',
    firstName: 'Pedro',
    lastName: 'Sánchez',
    isAdmin: false,
  },
];

async function seedUsers() {
  console.log('Starting user seeding...');

  for (const userData of TEST_USERS) {
    try {
      // Create user in Firebase Auth
      let userRecord;
      try {
        userRecord = await auth.createUser({
          email: userData.email,
          password: userData.password,
          displayName: userData.displayName,
        });
        console.log(`✅ Created auth user: ${userData.email}`);
      } catch (authError) {
        if (authError.code === 'auth/email-already-exists') {
          userRecord = await auth.getUserByEmail(userData.email);
          console.log(`ℹ️  Auth user already exists: ${userData.email}`);
        } else {
          throw authError;
        }
      }

      // Create user document in Firestore
      const userDoc = {
        uid: userRecord.uid,
        email: userData.email,
        displayName: userData.displayName,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        isAdmin: userData.isAdmin,
        isActive: true,
        photoURL: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection('users').doc(userRecord.uid).set(userDoc, { merge: true });
      console.log(`✅ Created Firestore user: ${userData.username}`);
    } catch (error) {
      console.error(`❌ Error creating user ${userData.email}:`, error.message);
    }
  }

  console.log('\n✅ User seeding complete!');
  console.log('\nTest users created (see .env.example for passwords):');
  TEST_USERS.forEach((u) => {
    console.log(`  ${u.email}`);
  });
  process.exit(0);
}

seedUsers();
