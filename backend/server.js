require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const cors = require('cors');
const express = require('express');
const admin = require('firebase-admin');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const { renderPasswordChangeWcTemplate } = require('./templates/passwordChangeWc');
const { renderSupportPasswordTemplate } = require('./templates/supportPasswordWc');

const MAX_PASSWORD_CHANGES = 3;

const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID',
  'FIREBASE_WEB_API_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM',
  'DATABASE_URL',
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    }),
  });
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const app = express();
const port = Number(process.env.PORT || 3001);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'));
    },
  })
);
app.use(express.json());

// ✅ Prevent API response caching (don't cache dynamic data)
app.use((req, res, next) => {
  // Only apply to API routes, not static files
  if (req.path.startsWith('/api')) {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
  }
  next();
});

// ─── Health ────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function getPasswordChangeState(userData = {}) {
  const passwordChangeCount = Number(userData.passwordChangeCount || 0);
  const passwordChangeLimit = Number(userData.passwordChangeLimit || MAX_PASSWORD_CHANGES);
  return {
    passwordChangeCount,
    passwordChangeLimit,
    remainingChanges: Math.max(passwordChangeLimit - passwordChangeCount, 0),
    hasReachedLimit: passwordChangeCount >= passwordChangeLimit,
  };
}

function validatePassword(password) {
  if (!password) return 'La contrase\u00f1a es requerida';
  if (password.length > 64) return 'La contrase\u00f1a no puede tener m\u00e1s de 64 caracteres';
  if (password.length < 8) return 'La contrase\u00f1a debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contrase\u00f1a debe tener al menos una may\u00fascula';
  if (!/[0-9]/.test(password)) return 'La contrase\u00f1a debe tener al menos un n\u00famero';
  return null;
}

async function callIdentityToolkit(payload) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${process.env.FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || 'FIREBASE_IDENTITY_TOOLKIT_ERROR';
    const error = new Error(message);
    error.code = message;
    throw error;
  }
  return data;
}

async function getUserForPasswordChangeByEmail(email) {
  const userRecord = await admin.auth().getUserByEmail(email);
  const userData = await prisma.user.findUnique({ where: { id: userRecord.uid } }) || {};
  return {
    userRecord,
    userData,
    passwordState: getPasswordChangeState(userData),
  };
}

function buildCustomResetUrl(resetLink) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173/auth/reset-password';
  const generatedUrl = new URL(resetLink);
  const oobCode = generatedUrl.searchParams.get('oobCode');
  const mode = generatedUrl.searchParams.get('mode') || 'resetPassword';
  const lang = generatedUrl.searchParams.get('lang') || 'es';
  if (!oobCode) throw new Error('Reset link missing oobCode');
  const customUrl = new URL(frontendUrl);
  customUrl.searchParams.set('oobCode', oobCode);
  customUrl.searchParams.set('mode', mode);
  customUrl.searchParams.set('lang', lang);
  return customUrl.toString();
}

function matchDateTimeToUTC(dateStr, timeStr) {
  const rawTime = String(timeStr || '00:00').slice(0, 5);
  return new Date(`${dateStr}T${rawTime}:00-05:00`);
}

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'yopmail.com','yopmail.fr','mailinator.com','mailinator.net','mailinator.org',
  'trashmail.com','trashmail.me','trashmail.net','trashmail.at','trashmail.io','trashmail.xyz',
  'guerrillamail.com','guerrillamail.net','guerrillamail.org','guerrillamail.biz',
  'guerrillamail.de','guerrillamail.info','grr.la','sharklasers.com',
  'tempmail.com','temp-mail.org','temp-mail.io','tempinbox.com','temporarymail.com',
  'throwam.com','dispostable.com','maildrop.cc','fakeinbox.com','fakemail.net',
  'discard.email','discardmail.com','discardmail.de','getairmail.com',
  'spam4.me','spamgourmet.com','spamgourmet.net','spamgourmet.org',
  'mintemail.com','mt2009.com','mt2014.com','trashmail.de','trashmail.org',
  'wegwerfmail.de','wegwerfmail.net','wegwerfmail.org','zehnminuten.de',
  'zehnminutenmail.de','selfdestructingmail.com','throwaway.email',
]);

// Middleware: verifica Bearer token y adjunta uid al request
async function requireAuth(req, res, next) {
  // Allow OPTIONS requests without authentication (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }
  
  const authHeader = String(req.headers.authorization || '');
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!idToken) {
    res.status(401).json({ message: 'No autorizado' });
    return;
  }
  try {
    req.decodedToken = await admin.auth().verifyIdToken(idToken);
    next();
  } catch {
    res.status(401).json({ message: 'Token inv\u00e1lido o expirado' });
  }
}

// ─── Auth: Forgot Password ─────────────────────────────────────────────────

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    res.status(400).json({ message: 'Debes proporcionar un email valido' });
    return;
  }
  const emailDomain = email.split('@')[1];
  if (emailDomain && DISPOSABLE_EMAIL_DOMAINS.has(emailDomain)) {
    res.status(400).json({ message: 'No se permiten correos temporales o desechables' });
    return;
  }
  try {
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        res.status(200).json({ message: 'Si el email existe, recibira un correo de recuperacion.' });
        return;
      }
      throw error;
    }
    const userData = await prisma.user.findUnique({ where: { id: userRecord.uid } }) || {};
    const passwordState = getPasswordChangeState(userData);
    if (passwordState.hasReachedLimit) {
      res.status(403).json({ message: 'Has alcanzado el m\u00e1ximo de 3 cambios de contrase\u00f1a.' });
      return;
    }
    const displayName = userData?.displayName || userRecord.displayName || '';
    const resetRedirectUrl = process.env.FRONTEND_URL || 'http://localhost:5173/auth/login';
    const generatedResetLink = await admin.auth().generatePasswordResetLink(email, {
      url: resetRedirectUrl,
      handleCodeInApp: false,
    });
    const resetLink = buildCustomResetUrl(generatedResetLink);
    const html = renderPasswordChangeWcTemplate({
      userName: displayName,
      resetLink,
      appName: process.env.APP_NAME || 'BIA Sports 2026',
      supportEmail: process.env.SUPPORT_EMAIL || 'soportewcpronostics@gmail.com',
    });
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: email,
        subject: 'Restablece tu contrasena',
        html,
        reply_to: process.env.SUPPORT_EMAIL || undefined,
      }),
    });
    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      throw new Error(`Resend error: ${resendError}`);
    }
    res.status(200).json({ message: 'Si el email existe, recibira un correo de recuperacion.' });
  } catch (error) {
    console.error('Forgot password email error:', error);
    res.status(500).json({ message: 'No fue posible enviar el correo de recuperacion' });
  }
});

app.post('/api/auth/reset-password/validate', async (req, res) => {
  const oobCode = String(req.body?.oobCode || '').trim();
  if (!oobCode) {
    res.status(400).json({ message: 'C\u00f3digo de recuperaci\u00f3n inv\u00e1lido' });
    return;
  }
  try {
    const resetData = await callIdentityToolkit({ oobCode });
    const email = String(resetData.email || '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ message: 'No fue posible validar el enlace' });
      return;
    }
    const { passwordState } = await getUserForPasswordChangeByEmail(email);
    if (passwordState.hasReachedLimit) {
      res.status(403).json({ message: 'Has alcanzado el m\u00e1ximo de 3 cambios de contrase\u00f1a.' });
      return;
    }
    res.status(200).json({
      email,
      remainingChanges: passwordState.remainingChanges,
      passwordChangeCount: passwordState.passwordChangeCount,
      passwordChangeLimit: passwordState.passwordChangeLimit,
    });
  } catch (error) {
    if (new Set(['EXPIRED_OOB_CODE', 'INVALID_OOB_CODE']).has(error.code)) {
      res.status(400).json({ message: 'El enlace ha expirado o ya no es v\u00e1lido.' });
      return;
    }
    console.error('Reset password validate error:', error);
    res.status(500).json({ message: 'No fue posible validar el enlace de recuperaci\u00f3n' });
  }
});

app.post('/api/auth/reset-password/confirm', async (req, res) => {
  const oobCode = String(req.body?.oobCode || '').trim();
  const newPassword = String(req.body?.newPassword || '');
  const passwordError = validatePassword(newPassword);
  if (!oobCode) {
    res.status(400).json({ message: 'C\u00f3digo de recuperaci\u00f3n inv\u00e1lido' });
    return;
  }
  if (passwordError) {
    res.status(400).json({ message: passwordError });
    return;
  }
  try {
    const resetData = await callIdentityToolkit({ oobCode });
    const email = String(resetData.email || '').trim().toLowerCase();
    const { userRecord, passwordState } = await getUserForPasswordChangeByEmail(email);
    if (passwordState.hasReachedLimit) {
      res.status(403).json({ message: 'Has alcanzado el m\u00e1ximo de 3 cambios de contrase\u00f1a.' });
      return;
    }
    await callIdentityToolkit({ oobCode, newPassword });
    await prisma.user.upsert({
      where: { id: userRecord.uid },
      update: {
        passwordChangeCount: passwordState.passwordChangeCount + 1,
        lastPasswordChangedAt: new Date(),
      },
      create: {
        id: userRecord.uid,
        email: userRecord.email || null,
        passwordChangeCount: 1,
        lastPasswordChangedAt: new Date(),
      },
    });
    res.status(200).json({
      message: 'Contrase\u00f1a actualizada correctamente',
      remainingChanges: Math.max(passwordState.passwordChangeLimit - (passwordState.passwordChangeCount + 1), 0),
    });
  } catch (error) {
    if (new Set(['EXPIRED_OOB_CODE', 'INVALID_OOB_CODE']).has(error.code)) {
      res.status(400).json({ message: 'El enlace ha expirado o ya no es v\u00e1lido.' });
      return;
    }
    console.error('Reset password confirm error:', error);
    res.status(500).json({ message: 'No fue posible restablecer la contrase\u00f1a' });
  }
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const newPassword = String(req.body?.newPassword || '');
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    res.status(400).json({ message: passwordError });
    return;
  }
  try {
    const uid = req.decodedToken.uid;
    const userData = await prisma.user.findUnique({ where: { id: uid } }) || {};
    const passwordState = getPasswordChangeState(userData);
    if (passwordState.hasReachedLimit) {
      res.status(403).json({ message: 'Has alcanzado el m\u00e1ximo de 3 cambios de contrase\u00f1a.' });
      return;
    }
    await admin.auth().updateUser(uid, { password: newPassword });
    await prisma.user.upsert({
      where: { id: uid },
      update: {
        passwordChangeCount: passwordState.passwordChangeCount + 1,
        lastPasswordChangedAt: new Date(),
      },
      create: {
        id: uid,
        passwordChangeCount: 1,
        lastPasswordChangedAt: new Date(),
      },
    });
    res.status(200).json({
      message: 'Contrase\u00f1a actualizada correctamente',
      remainingChanges: Math.max(passwordState.passwordChangeLimit - (passwordState.passwordChangeCount + 1), 0),
    });
  } catch (error) {
    console.error('Authenticated change password error:', error);
    res.status(500).json({ message: 'No fue posible actualizar la contrase\u00f1a' });
  }
});

// ─── Admin: Support Password ───────────────────────────────────────────────

function generateSupportPassword() {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const parts = [];
  for (let i = 0; i < 2; i++) parts.push(upper[Math.floor(Math.random() * upper.length)]);
  for (let i = 0; i < 4; i++) parts.push(digits[Math.floor(Math.random() * digits.length)]);
  for (let i = 0; i < 6; i++) parts.push(lower[Math.floor(Math.random() * lower.length)]);
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  return parts.join('');
}

// Super Admin: all tournaments with admin name + participant count
app.get('/api/admin/tournaments', requireAuth, async (req, res) => {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@worldcup2026.com';
  if (req.decodedToken.email !== superAdminEmail) {
    res.status(403).json({ message: 'No autorizado' });
    return;
  }
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      include: { participants: { where: { status: 'active' }, select: { id: true } } },
    });
    const adminIds = [...new Set(tournaments.map((t) => t.adminId).filter(Boolean))];
    const admins = await prisma.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, displayName: true, email: true },
    });
    const adminMap = new Map(admins.map((a) => [a.id, a]));
    const result = tournaments.map((t) => ({
      ...t,
      participantCount: t.participants.length,
      adminName: adminMap.get(t.adminId)?.displayName || adminMap.get(t.adminId)?.email || 'Desconocido',
      participants: undefined,
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener torneos' });
  }
});

// Super Admin: all users with active tournament count
app.get('/api/admin/users', requireAuth, async (req, res) => {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@worldcup2026.com';
  if (req.decodedToken.email !== superAdminEmail) {
    res.status(403).json({ message: 'No autorizado' });
    return;
  }
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { participants: { where: { status: 'active' }, select: { id: true } } },
    });
    const result = users.map((u) => ({
      ...u,
      tournamentCount: u.participants.length,
      participants: undefined,
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

// Super Admin: user's active tournaments with rank
app.get('/api/admin/users/:id/tournaments', requireAuth, async (req, res) => {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@worldcup2026.com';
  if (req.decodedToken.email !== superAdminEmail) {
    res.status(403).json({ message: 'No autorizado' });
    return;
  }
  const uid = req.params.id;
  try {
    const participations = await prisma.participant.findMany({
      where: { userId: uid, status: 'active' },
      include: { tournament: { select: { id: true, name: true } } },
    });
    const items = await Promise.all(
      participations.map(async (p) => {
        const allActive = await prisma.participant.findMany({
          where: { tournamentId: p.tournamentId, status: 'active' },
          select: { userId: true, points: true },
          orderBy: { points: 'desc' },
        });
        const rank = allActive.findIndex((a) => a.userId === uid) + 1;
        return {
          tournamentId: p.tournamentId,
          tournamentName: p.tournament.name,
          points: p.points ?? 0,
          rank: rank > 0 ? rank : allActive.length,
          total: allActive.length,
        };
      })
    );
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener torneos del usuario' });
  }
});

app.post('/api/admin/support-password', requireAuth, async (req, res) => {
  const targetEmail = String(req.body?.targetEmail || '').trim().toLowerCase();
  if (!targetEmail) {
    res.status(400).json({ message: 'Email del usuario requerido' });
    return;
  }
  try {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@worldcup2026.com';
    if (req.decodedToken.email !== superAdminEmail) {
      res.status(403).json({ message: 'No tienes permisos para esta acci\u00f3n' });
      return;
    }
    let targetRecord;
    try {
      targetRecord = await admin.auth().getUserByEmail(targetEmail);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
      }
      throw err;
    }
    const tempPassword = generateSupportPassword();
    await admin.auth().updateUser(targetRecord.uid, { password: tempPassword });
    const userData = await prisma.user.findUnique({ where: { id: targetRecord.uid } }) || {};
    const displayName = userData?.displayName || targetRecord.displayName || '';
    await prisma.user.upsert({
      where: { id: targetRecord.uid },
      update: { passwordChangeCount: 0, lastSupportPasswordAt: new Date() },
      create: { id: targetRecord.uid, email: targetRecord.email || null, passwordChangeCount: 0, lastSupportPasswordAt: new Date() },
    });
    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173/auth/login').replace(/\/auth\/reset-password$/, '');
    const loginUrl = `${frontendBase}/auth/login`;
    const html = renderSupportPasswordTemplate({
      userName: displayName,
      tempPassword,
      appName: process.env.APP_NAME || 'BIA Sports 2026',
      supportEmail: process.env.SUPPORT_EMAIL || 'soportewcpronostics@gmail.com',
      loginUrl,
    });
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: targetEmail,
        subject: `${process.env.APP_NAME || 'BIA Sports 2026'} - Clave temporal asignada`,
        html,
        reply_to: process.env.SUPPORT_EMAIL || undefined,
      }),
    });
    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      throw new Error(`Resend error: ${resendError}`);
    }
    res.status(200).json({ message: 'Contrase\u00f1a temporal enviada al usuario' });
  } catch (error) {
    console.error('Support password error:', error);
    res.status(500).json({ message: 'No fue posible asignar la contrase\u00f1a temporal' });
  }
});

// ─── Users ─────────────────────────────────────────────────────────────────

// Upsert user profile (called on signup / Google login)
app.post('/api/users', requireAuth, async (req, res) => {
  const uid = req.decodedToken.uid;
  const { displayName, username, email, favoriteTeam, firstName, lastName, photoURL } = req.body || {};
  try {
    // Check username uniqueness if provided
    if (username) {
      const existing = await prisma.user.findFirst({
        where: { username, NOT: { id: uid } },
      });
      if (existing) {
        res.status(409).json({ message: 'El nombre de usuario ya est\u00e1 en uso', field: 'username' });
        return;
      }
    }
    const user = await prisma.user.upsert({
      where: { id: uid },
      update: {
        ...(displayName !== undefined && { displayName }),
        ...(username !== undefined && { username }),
        ...(email !== undefined && { email }),
        ...(favoriteTeam !== undefined && { favoriteTeam }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(photoURL !== undefined && { photoURL }),
      },
      create: {
        id: uid,
        displayName: displayName || null,
        username: username || null,
        email: email || req.decodedToken.email || null,
        favoriteTeam: favoriteTeam || null,
        firstName: firstName || null,
        lastName: lastName || null,
        photoURL: photoURL || null,
      },
    });
    res.json(user);
  } catch (error) {
    console.error('Upsert user error:', error);
    res.status(500).json({ message: 'Error al guardar el perfil' });
  }
});

app.get('/api/users/check-username', async (req, res) => {
  const username = String(req.query.username || '').trim();
  const excludeUid = String(req.query.excludeUid || '').trim();
  if (!username) {
    res.status(400).json({ message: 'username requerido' });
    return;
  }
  try {
    const existing = await prisma.user.findFirst({
      where: { username, ...(excludeUid && { NOT: { id: excludeUid } }) },
      select: { id: true },
    });
    res.json({ available: !existing });
  } catch (error) {
    res.status(500).json({ message: 'Error al verificar username' });
  }
});

app.get('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el perfil' });
  }
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
  if (req.decodedToken.uid !== req.params.id) {
    res.status(403).json({ message: 'No autorizado' });
    return;
  }
  const { displayName, username, favoriteTeam, firstName, lastName, photoURL, isActive, isAdmin } = req.body || {};
  try {
    if (username) {
      const existing = await prisma.user.findFirst({
        where: { username, NOT: { id: req.params.id } },
      });
      if (existing) {
        res.status(409).json({ message: 'El nombre de usuario ya est\u00e1 en uso', field: 'username' });
        return;
      }
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(username !== undefined && { username }),
        ...(favoriteTeam !== undefined && { favoriteTeam }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(photoURL !== undefined && { photoURL }),
        ...(isActive !== undefined && { isActive }),
        ...(isAdmin !== undefined && { isAdmin }),
      },
    });
    res.json(user);
  } catch (error) {
    if (error.code === 'P2025') {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }
    res.status(500).json({ message: 'Error al actualizar el perfil' });
  }
});

// ─── Tournaments ───────────────────────────────────────────────────────────

app.get('/api/tournaments', requireAuth, async (req, res) => {
  const uid = req.decodedToken.uid;
  try {
    const participants = await prisma.participant.findMany({
      where: { userId: uid, status: { in: ['active', 'pending'] } },
      include: {
        tournament: {
          include: {
            _count: { select: { participants: { where: { status: 'active' } } } },
          },
        },
      },
    });
    const tournaments = participants.map((p) => ({
      ...p.tournament,
      memberCount: p.tournament._count.participants,
      pointConfig: p.tournament.pointConfig,
      participantStatus: p.status,
      participantRole: p.role,
    }));
    res.json(tournaments);
  } catch (error) {
    console.error('Get tournaments error:', error);
    res.status(500).json({ message: 'Error al obtener los torneos' });
  }
});

app.get('/api/tournaments/:id', requireAuth, async (req, res) => {
  try {
    const uid = req.decodedToken.uid;
    const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
    if (!tournament) {
      res.status(404).json({ message: 'Torneo no encontrado' });
      return;
    }
    const participant = await prisma.participant.findUnique({
      where: { userId_tournamentId: { userId: uid, tournamentId: tournament.id } },
    });
    if (!participant) {
      res.status(403).json({ message: 'No eres miembro de esta polla', code: 'NOT_A_MEMBER' });
      return;
    }
    res.json({ ...tournament, participantStatus: participant.status, participantRole: participant.role });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el torneo' });
  }
});

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase().padEnd(8, '0').substring(0, 8);
}

app.post('/api/tournaments', requireAuth, async (req, res) => {
  const uid = req.decodedToken.uid;
  const { name, description, predictionLockMinutes, secondRoundMultiplier, pointConfig, requiresApproval, maxUsers, isPublic, prizeConfig } = req.body || {};
  if (!name) {
    res.status(400).json({ message: 'El nombre es requerido' });
    return;
  }
  try {
    let inviteCode;
    let tries = 0;
    do {
      inviteCode = generateInviteCode();
      tries++;
    } while (tries < 10 && await prisma.tournament.findUnique({ where: { inviteCode } }));

    const tournament = await prisma.$transaction(async (tx) => {
      // Ensure user exists in the database
      await tx.user.upsert({
        where: { id: uid },
        update: {},
        create: {
          id: uid,
          email: req.decodedToken.email || null,
          displayName: req.decodedToken.name || null,
        },
      });

      const t = await tx.tournament.create({
        data: {
          name,
          description: description || null,
          adminId: uid,
          inviteCode,
          memberCount: 1,
          predictionLockMinutes: predictionLockMinutes || 10,
          secondRoundMultiplier: secondRoundMultiplier || 2,
          pointConfig: pointConfig || { exact: 3, difference: 2, winner: 1 },
          requiresApproval: requiresApproval || false,
          maxUsers: maxUsers || null,
          isPublic: isPublic || false,
          prizeConfig: prizeConfig || null,
        },
      });
      await tx.participant.create({
        data: {
          userId: uid,
          tournamentId: t.id,
          status: 'active',
          role: 'admin',
          points: 0,
        },
      });
      return t;
    });
    res.status(201).json(tournament);
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({ message: 'Error al crear el torneo' });
  }
});

app.put('/api/tournaments/:id', requireAuth, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
    if (!tournament) {
      res.status(404).json({ message: 'Torneo no encontrado' });
      return;
    }
    if (tournament.adminId !== req.decodedToken.uid) {
      res.status(403).json({ message: 'Solo el administrador puede editar el torneo' });
      return;
    }
    const { name, description, predictionLockMinutes, secondRoundMultiplier, pointConfig, requiresApproval, showPredictionsAlways, maxUsers, isPublic, status, prizeConfig } = req.body || {};
    console.log('[PUT tournament] prizeConfig received:', JSON.stringify(prizeConfig));
    const updated = await prisma.tournament.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(predictionLockMinutes !== undefined && { predictionLockMinutes }),
        ...(secondRoundMultiplier !== undefined && { secondRoundMultiplier }),
        ...(pointConfig !== undefined && { pointConfig }),
        ...(requiresApproval !== undefined && { requiresApproval }),
        ...(showPredictionsAlways !== undefined && { showPredictionsAlways }),
        ...(prizeConfig !== undefined && { prizeConfig }),
        ...(maxUsers !== undefined && { maxUsers }),
        ...(isPublic !== undefined && { isPublic }),
        ...(status !== undefined && { status }),
      },
    });
    console.log('[PUT tournament] prizeConfig saved:', JSON.stringify(updated.prizeConfig));
    res.json(updated);
  } catch (error) {
    console.error('[PUT tournament] error:', error);
    res.status(500).json({ message: 'Error al actualizar el torneo' });
  }
});

app.delete('/api/tournaments/:id', requireAuth, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
    if (!tournament) {
      res.status(404).json({ message: 'Torneo no encontrado' });
      return;
    }
    if (tournament.adminId !== req.decodedToken.uid) {
      res.status(403).json({ message: 'Solo el administrador puede eliminar el torneo' });
      return;
    }
    // Cascade deletes participants, predictions, notifications, standing via schema
    await prisma.tournament.delete({ where: { id: req.params.id } });
    res.json({ message: 'Torneo eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar el torneo' });
  }
});

app.post('/api/tournaments/join', requireAuth, async (req, res) => {
  const uid = req.decodedToken.uid;
  const inviteCode = String(req.body?.inviteCode || '').trim().toUpperCase();
  if (!inviteCode) {
    res.status(400).json({ message: 'C\u00f3digo de invitaci\u00f3n requerido' });
    return;
  }
  try {
    const tournament = await prisma.tournament.findUnique({ where: { inviteCode } });
    if (!tournament) {
      res.status(404).json({ message: 'El torneo no existe, por favor verifica el c\u00f3digo de invitaci\u00f3n e intenta nuevamente' });
      return;
    }
    if (tournament.status === 'finished') {
      res.status(409).json({ message: 'Esta polla ya ha finalizado y no acepta nuevos participantes' });
      return;
    }
    const existing = await prisma.participant.findUnique({
      where: { userId_tournamentId: { userId: uid, tournamentId: tournament.id } },
    });
    if (existing) {
      res.status(409).json({ message: 'Ya eres participante de este torneo' });
      return;
    }
    if (tournament.maxUsers != null) {
      const activeCount = await prisma.participant.count({
        where: { tournamentId: tournament.id, status: 'active' },
      });
      if (activeCount >= tournament.maxUsers) {
        res.status(409).json({ message: `Este torneo ya alcanz\u00f3 el l\u00edmite de ${tournament.maxUsers} participantes` });
        return;
      }
    }
    const status = tournament.requiresApproval ? 'pending' : 'active';
    await prisma.$transaction(async (tx) => {
      await tx.participant.create({
        data: { userId: uid, tournamentId: tournament.id, status, role: 'member', points: 0 },
      });
      if (!tournament.requiresApproval) {
        await tx.tournament.update({
          where: { id: tournament.id },
          data: { memberCount: { increment: 1 } },
        });
      }
      if (tournament.requiresApproval) {
        await tx.notification.create({
          data: {
            type: 'pending_approval',
            userId: uid,
            adminId: tournament.adminId,
            tournamentId: tournament.id,
          },
        });
      }
    });
    // Notify admin via FCM if requires approval
    if (tournament.requiresApproval) {
      const joiningUser = await prisma.user.findUnique({ where: { id: uid }, select: { displayName: true } });
      const adminTokens = await prisma.fcmToken.findMany({ where: { userId: tournament.adminId }, select: { token: true } });
      const userName = joiningUser?.displayName || 'Un usuario';
      for (const { token } of adminTokens) {
        await sendFCMNotification(tournament.adminId, token, {
          title: 'Solicitud de aprobación',
          body: `${userName} solicita unirse a "${tournament.name}"`,
          data: { url: `/tournaments/${tournament.id}/participants` },
        });
      }
    }
    res.status(201).json({ message: status === 'pending' ? 'Solicitud enviada al administrador' : 'Te uniste al torneo', status, tournamentId: tournament.id, name: tournament.name, requiresApproval: tournament.requiresApproval });
  } catch (error) {
    console.error('Join tournament error:', error);
    res.status(500).json({ message: 'Error al unirse al torneo' });
  }
});

app.post('/api/tournaments/:id/leave', requireAuth, async (req, res) => {
  const uid = req.decodedToken.uid;
  const { id: tournamentId } = req.params;
  try {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      res.status(404).json({ message: 'Torneo no encontrado' });
      return;
    }
    if (tournament.status === 'finished') {
      res.status(409).json({ message: 'Esta polla ya ha finalizado' });
      return;
    }
    if (tournament.adminId === uid) {
      res.status(400).json({ message: 'El administrador no puede abandonar el torneo' });
      return;
    }
    const participant = await prisma.participant.findUnique({
      where: { userId_tournamentId: { userId: uid, tournamentId } },
    });
    if (!participant) {
      res.status(404).json({ message: 'No eres participante de este torneo' });
      return;
    }
    const predCount = await prisma.prediction.count({ where: { userId: uid, tournamentId } });
    await prisma.$transaction(async (tx) => {
      await tx.participant.delete({ where: { userId_tournamentId: { userId: uid, tournamentId } } });
      if (participant.status === 'active') {
        await tx.tournament.update({
          where: { id: tournamentId },
          data: { memberCount: { decrement: 1 } },
        });
      }
    });
    res.json({ message: 'Abandonaste el torneo', predictionsCount: predCount });
  } catch (error) {
    console.error('Leave tournament error:', error);
    res.status(500).json({ message: 'Error al abandonar el torneo' });
  }
});

// ─── Participants ──────────────────────────────────────────────────────────

app.get('/api/tournaments/:id/participants', requireAuth, async (req, res) => {
  try {
    const participants = await prisma.participant.findMany({
      where: { tournamentId: req.params.id },
      include: {
        user: {
          select: { displayName: true, username: true, photoURL: true, favoriteTeam: true, email: true },
        },
      },
      orderBy: { points: 'desc' },
    });
    res.json(participants);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los participantes' });
  }
});

app.put('/api/participants/:id', requireAuth, async (req, res) => {
  const { status, points } = req.body || {};
  try {
    const participant = await prisma.participant.findUnique({
      where: { id: req.params.id },
      include: { tournament: true },
    });
    if (!participant) {
      res.status(404).json({ message: 'Participante no encontrado' });
      return;
    }
    if (participant.tournament.adminId !== req.decodedToken.uid) {
      res.status(403).json({ message: 'No autorizado' });
      return;
    }
    if (participant.tournament.status === 'finished') {
      res.status(409).json({ message: 'No se puede modificar participantes en una polla finalizada' });
      return;
    }
    const prevStatus = participant.status;
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.participant.update({
        where: { id: req.params.id },
        data: {
          ...(status !== undefined && { status }),
          ...(points !== undefined && { points }),
        },
      });
      // Adjust memberCount when active status changes
      if (status !== undefined && status !== prevStatus) {
        if (status === 'active' && prevStatus !== 'active') {
          await tx.tournament.update({ where: { id: participant.tournamentId }, data: { memberCount: { increment: 1 } } });
        } else if (status !== 'active' && prevStatus === 'active') {
          await tx.tournament.update({ where: { id: participant.tournamentId }, data: { memberCount: { decrement: 1 } } });
        }
      }
      // Create approved/rejected notification when status changes from pending or rejected
      const wasAwaiting = (prevStatus === 'pending' || prevStatus === 'rejected') && status !== prevStatus;
      if (wasAwaiting && (status === 'active' || status === 'rejected')) {
        await tx.notification.create({
          data: {
            type: status === 'active' ? 'approved' : 'rejected',
            userId: participant.userId,
            adminId: participant.tournament.adminId,
            tournamentId: participant.tournamentId,
          },
        });
        await tx.notification.updateMany({
          where: { type: 'pending_approval', userId: participant.userId, tournamentId: participant.tournamentId },
          data: { read: true },
        });
      }
      return result;
    });
    // Send FCM push if transitioning from pending or rejected
    const wasAwaiting = (prevStatus === 'pending' || prevStatus === 'rejected') && status !== prevStatus;
    if (wasAwaiting && (status === 'active' || status === 'rejected')) {
      const tokens = await prisma.fcmToken.findMany({ where: { userId: participant.userId }, select: { token: true } });
      const title = status === 'active' ? 'Solicitud aprobada' : 'Solicitud rechazada';
      const body = status === 'active'
        ? `Fuiste aprobado en "${participant.tournament.name}"`
        : `Tu solicitud en "${participant.tournament.name}" fue rechazada`;
      for (const { token } of tokens) {
        await sendFCMNotification(participant.userId, token, {
          title, body,
          data: { url: `/tournaments/${participant.tournamentId}` },
        });
      }
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar participante' });
  }
});

app.delete('/api/participants/:id', requireAuth, async (req, res) => {
  try {
    const participant = await prisma.participant.findUnique({
      where: { id: req.params.id },
      include: { tournament: true },
    });
    if (!participant) {
      res.status(404).json({ message: 'Participante no encontrado' });
      return;
    }
    if (participant.tournament.adminId !== req.decodedToken.uid) {
      res.status(403).json({ message: 'No autorizado' });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.participant.delete({ where: { id: req.params.id } });
      if (participant.status === 'active') {
        await tx.tournament.update({
          where: { id: participant.tournamentId },
          data: { memberCount: { decrement: 1 } },
        });
      }
    });
    res.json({ message: 'Participante eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar participante' });
  }
});

// Approve / reject pending participant (admin action)
app.post('/api/participants/:id/approve', requireAuth, async (req, res) => {
  const approve = req.body?.approve !== false;
  try {
    const participant = await prisma.participant.findUnique({
      where: { id: req.params.id },
      include: { tournament: true },
    });
    if (!participant) {
      res.status(404).json({ message: 'Participante no encontrado' });
      return;
    }
    if (participant.tournament.adminId !== req.decodedToken.uid) {
      res.status(403).json({ message: 'No autorizado' });
      return;
    }
    const newStatus = approve ? 'active' : 'rejected';
    await prisma.$transaction(async (tx) => {
      await tx.participant.update({ where: { id: req.params.id }, data: { status: newStatus } });
      if (approve) {
        await tx.tournament.update({
          where: { id: participant.tournamentId },
          data: { memberCount: { increment: 1 } },
        });
      }
      await tx.notification.create({
        data: {
          type: approve ? 'approved' : 'rejected',
          userId: participant.userId,
          adminId: participant.tournament.adminId,
          tournamentId: participant.tournamentId,
        },
      });
      // Mark pending_approval notification as read
      await tx.notification.updateMany({
        where: {
          type: 'pending_approval',
          userId: participant.userId,
          tournamentId: participant.tournamentId,
        },
        data: { read: true },
      });
    });
    // Notify participant via FCM
    const participantTokens = await prisma.fcmToken.findMany({ where: { userId: participant.userId }, select: { token: true } });
    const notifTitle = approve ? 'Solicitud aprobada' : 'Solicitud rechazada';
    const notifBody = approve
      ? `Fuiste aprobado en "${participant.tournament.name}"`
      : `Tu solicitud en "${participant.tournament.name}" fue rechazada`;
    for (const { token } of participantTokens) {
      await sendFCMNotification(participant.userId, token, {
        title: notifTitle,
        body: notifBody,
        data: { url: `/tournaments/${participant.tournamentId}` },
      });
    }
    res.json({ message: approve ? 'Participante aprobado' : 'Participante rechazado' });
  } catch (error) {
    console.error('Approve participant error:', error);
    res.status(500).json({ message: 'Error al procesar la solicitud' });
  }
});

// ─── Matches ───────────────────────────────────────────────────────────────

// All known aliases for each canonical round name (must match what's actually in the DB)
const ROUND_ALIASES = {
  'Group Stage': ['Group Stage', 'group stage', 'groups'],
  'Round of 32': ['Round of 32', 'R32'],
  'Round of 16': ['Round of 16', 'R16'],
  'Quarter Final': ['Quarter Final', 'Quarterfinals', 'QF'],
  'Semi Final': ['Semi Final', 'Semifinals', 'SF'],
  'Third Place': ['Third Place', '3rd Place', '3rd'],
  'Final': ['Final', 'final'],
};

function expandRoundAliases(roundNames) {
  const result = new Set();
  for (const name of roundNames) {
    const aliases = ROUND_ALIASES[name];
    if (aliases) {
      aliases.forEach((a) => result.add(a));
    } else {
      result.add(name); // unknown round, use as-is
    }
  }
  return Array.from(result);
}

app.get('/api/matches', requireAuth, async (req, res) => {
  try {
    const { round, group, status, rounds } = req.query;
    const where = {};
    if (status) where.status = status;
    if (round) where.round = round;
    if (group) where.group = group;
    if (rounds) {
      const roundList = String(rounds).split(',').map((r) => r.trim()).filter(Boolean);
      if (roundList.length > 0) where.round = { in: expandRoundAliases(roundList) };
    }
    const matches = await prisma.match.findMany({ where, orderBy: { date: 'asc' } });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los partidos' });
  }
});

app.get('/api/matches/version', requireAuth, async (req, res) => {
  try {
    const meta = await prisma.meta.findUnique({ where: { id: 'matchesVersion' } });
    res.json({
      ts: meta ? meta.lastUpdated.getTime() : null,
      updatedMatchId: meta?.updatedMatchId || null,
      updatedMatchData: meta?.updatedMatchData || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener la versi\u00f3n' });
  }
});

app.post('/api/matches', requireAuth, async (req, res) => {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@worldcup2026.com';
  const requesterUser = await prisma.user.findUnique({ where: { id: req.decodedToken.uid } });
  if (req.decodedToken.email !== superAdminEmail && !requesterUser?.isAdmin) {
    res.status(403).json({ message: 'No autorizado' });
    return;
  }
  const { homeTeam, awayTeam, date, time, round, group } = req.body || {};
  if (!homeTeam || !awayTeam || !date || !time) {
    res.status(400).json({ message: 'Datos del partido incompletos' });
    return;
  }
  try {
    const match = await prisma.match.create({
      data: { homeTeam, awayTeam, date, time, round: round || null, group: group || null },
    });
    // Bump version (no updatedMatch = full re-fetch signal)
    await prisma.meta.upsert({
      where: { id: 'matchesVersion' },
      update: { lastUpdated: new Date(), updatedMatchId: null, updatedMatchData: null },
      create: { id: 'matchesVersion', lastUpdated: new Date() },
    });
    res.status(201).json(match);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear el partido' });
  }
});

app.put('/api/matches/:id', requireAuth, async (req, res) => {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@worldcup2026.com';
  const requesterUser = await prisma.user.findUnique({ where: { id: req.decodedToken.uid } });
  if (req.decodedToken.email !== superAdminEmail && !requesterUser?.isAdmin) {
    res.status(403).json({ message: 'No autorizado' });
    return;
  }
  const { homeTeam, awayTeam, date, time, round, group, status, homeScore, awayScore,
    homeTeamCode, awayTeamCode, homeTeamFlag, awayTeamFlag, configured } = req.body || {};
  try {
    const match = await prisma.match.update({
      where: { id: req.params.id },
      data: {
        ...(homeTeam !== undefined && { homeTeam }),
        ...(awayTeam !== undefined && { awayTeam }),
        ...(date !== undefined && { date }),
        ...(time !== undefined && { time }),
        ...(round !== undefined && { round }),
        ...(group !== undefined && { group }),
        ...(status !== undefined && { status }),
        ...(homeScore !== undefined && { homeScore }),
        ...(awayScore !== undefined && { awayScore }),
        ...(homeTeamCode !== undefined && { homeTeamCode }),
        ...(awayTeamCode !== undefined && { awayTeamCode }),
        ...(homeTeamFlag !== undefined && { homeTeamFlag }),
        ...(awayTeamFlag !== undefined && { awayTeamFlag }),
        ...(configured !== undefined && { configured }),
      },
    });
    
    // ✅ Auto-recalculate points if match is being finalized
    if (status === 'finished' && homeScore !== undefined && awayScore !== undefined) {
      try {
        // Get all tournaments with predictions for this match
        const impactedPredictions = await prisma.prediction.findMany({
          where: { matchId: req.params.id },
          select: { tournamentId: true },
        });
        
        if (impactedPredictions.length > 0) {
          const tournamentIds = [...new Set(impactedPredictions.map((p) => p.tournamentId).filter(Boolean))];

          for (const tournamentId of tournamentIds) {
            const [tournament, tournamentPredictions, participants] = await Promise.all([
              prisma.tournament.findUnique({ where: { id: tournamentId } }),
              prisma.prediction.findMany({ where: { tournamentId } }),
              prisma.participant.findMany({ where: { tournamentId } }),
            ]);
            
            if (!tournament) continue;

            const matchIds = [...new Set(tournamentPredictions.map((p) => p.matchId).filter(Boolean))];
            const matchObjects = await prisma.match.findMany({ where: { id: { in: matchIds } } });
            const matchMap = new Map(matchObjects.map((m) => [m.id, m]));
            const pointConfig = tournament.pointConfig || { exact: 3, difference: 2, winner: 1 };
            const secondRoundMultiplier = tournament.secondRoundMultiplier ?? 2;

            const predictionUpdates = [];

            // Only update predictions for the specific match being finalized
            for (const prediction of tournamentPredictions) {
              if (prediction.matchId !== req.params.id) continue; // Only this match
              const predMatch = matchMap.get(prediction.matchId);
              if (!predMatch || predMatch.homeScore === null || predMatch.awayScore === null) continue;

              let nextPoints = 0;
              if (prediction.homeScore != null && prediction.awayScore != null) {
                const pDiff = prediction.homeScore - prediction.awayScore;
                const mDiff = predMatch.homeScore - predMatch.awayScore;
                const isSecondRound = ['Octavos', 'Cuartos', 'Semis', '3er Puesto', 'Final'].includes(predMatch.round);
                const multiplier = isSecondRound ? secondRoundMultiplier : 1;

                if (prediction.homeScore === predMatch.homeScore) nextPoints += pointConfig.exact * multiplier;
                if (prediction.awayScore === predMatch.awayScore) nextPoints += pointConfig.exact * multiplier;
                if (pDiff === mDiff) nextPoints += pointConfig.difference * multiplier;
                if (pDiff > 0 && mDiff > 0) nextPoints += pointConfig.winner * multiplier;
                if (pDiff < 0 && mDiff < 0) nextPoints += pointConfig.winner * multiplier;
                if (pDiff === 0 && mDiff === 0) nextPoints += pointConfig.winner * multiplier;
              }

              predictionUpdates.push({ id: prediction.id, points: nextPoints });
            }

            if (predictionUpdates.length > 0) {
              // First update prediction points
              await prisma.$transaction(
                predictionUpdates.map(({ id, points }) =>
                  prisma.prediction.update({ where: { id }, data: { points } })
                )
              );

              // Then recalculate ALL participant points (sum all their finished predictions)
              const participantUpdates = [];
              for (const p of participants) {
                const allPredictions = await prisma.prediction.findMany({
                  where: { tournamentId, userId: p.userId },
                });
                const totalPoints = allPredictions.reduce((sum, pred) => sum + (pred.points || 0), 0);
                participantUpdates.push(
                  prisma.participant.update({
                    where: { id: p.id },
                    data: { points: totalPoints },
                  })
                );
              }
              await prisma.$transaction(participantUpdates);
            }
          }
        }
      } catch (err) {
        console.error('Auto-recalculate points error:', err);
      }
    }
    
    // Surgical version bump
    await prisma.meta.upsert({
      where: { id: 'matchesVersion' },
      update: { lastUpdated: new Date(), updatedMatchId: match.id, updatedMatchData: match },
      create: { id: 'matchesVersion', lastUpdated: new Date(), updatedMatchId: match.id, updatedMatchData: match },
    });
    res.json(match);
  } catch (error) {
    if (error.code === 'P2025') {
      res.status(404).json({ message: 'Partido no encontrado' });
      return;
    }
    res.status(500).json({ message: 'Error al actualizar el partido' });
  }
});

app.delete('/api/matches/:id', requireAuth, async (req, res) => {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@worldcup2026.com';
  const requesterUser = await prisma.user.findUnique({ where: { id: req.decodedToken.uid } });
  if (req.decodedToken.email !== superAdminEmail && !requesterUser?.isAdmin) {
    res.status(403).json({ message: 'No autorizado' });
    return;
  }
  try {
    await prisma.match.delete({ where: { id: req.params.id } });
    await prisma.meta.upsert({
      where: { id: 'matchesVersion' },
      update: { lastUpdated: new Date(), updatedMatchId: null, updatedMatchData: null },
      create: { id: 'matchesVersion', lastUpdated: new Date() },
    });
    res.json({ message: 'Partido eliminado' });
  } catch (error) {
    if (error.code === 'P2025') {
      res.status(404).json({ message: 'Partido no encontrado' });
      return;
    }
    res.status(500).json({ message: 'Error al eliminar el partido' });
  }
});

// ─── Predictions ───────────────────────────────────────────────────────────

app.get('/api/predictions', requireAuth, async (req, res) => {
  const uid = req.decodedToken.uid;
  const { tournamentId } = req.query;
  if (!tournamentId) {
    res.status(400).json({ message: 'tournamentId requerido' });
    return;
  }
  try {
    const predictions = await prisma.prediction.findMany({
      where: { userId: uid, tournamentId },
    });
    // Normalize to frontend shape: prediction: { homeScore, awayScore }
    const normalized = predictions.map((p) => ({
      id: p.id,
      userId: p.userId,
      userName: p.userName,
      matchId: p.matchId,
      tournamentId: p.tournamentId,
      points: p.points,
      prediction: { homeScore: p.homeScore, awayScore: p.awayScore },
    }));
    res.json(normalized);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los pron\u00f3sticos' });
  }
});

app.post('/api/predictions', requireAuth, async (req, res) => {
  const userId = req.decodedToken.uid;
  const tournamentId = String(req.body?.tournamentId || '').trim();
  const matchId = String(req.body?.matchId || '').trim();
  const { homeScore, awayScore } = req.body ?? {};

  if (!tournamentId || !matchId) {
    res.status(400).json({ message: 'Datos incompletos' });
    return;
  }

  try {
    const [match, tournament, participant] = await Promise.all([
      prisma.match.findUnique({ where: { id: matchId } }),
      prisma.tournament.findUnique({ where: { id: tournamentId } }),
      prisma.participant.findUnique({
        where: { userId_tournamentId: { userId, tournamentId } },
      }),
    ]);

    if (!match || !tournament) {
      res.status(404).json({ message: 'Partido o torneo no encontrado' });
      return;
    }
    if (tournament.status === 'finished') {
      res.status(423).json({ message: 'Esta polla ya ha finalizado, no se pueden agregar pronósticos' });
      return;
    }
    if (!participant || participant.status !== 'active') {
      res.status(403).json({ message: 'No eres un participante activo en este torneo' });
      return;
    }
    if (match.status === 'finished') {
      res.status(423).json({ message: 'Este pron\u00f3stico ya est\u00e1 bloqueado (partido finalizado)' });
      return;
    }

    const lockMinutes = Number(tournament.predictionLockMinutes ?? 10);
    const matchUTC = matchDateTimeToUTC(match.date, match.time);
    const lockUTC = new Date(matchUTC.getTime() - lockMinutes * 60 * 1000);
    if (new Date() >= lockUTC) {
      res.status(423).json({
        message: `El plazo para pronosticar este partido ya cerr\u00f3 (${lockMinutes} min antes del partido).`,
      });
      return;
    }

    const predictionId = `${userId}_${tournamentId}_${matchId}`;

    if (homeScore === null && awayScore === null) {
      await prisma.prediction.deleteMany({ where: { id: predictionId } });
      res.status(200).json({ message: 'Pron\u00f3stico eliminado' });
      return;
    }

    const normalizedHome = Number(homeScore);
    const normalizedAway = Number(awayScore);
    if (
      !Number.isInteger(normalizedHome) || !Number.isInteger(normalizedAway) ||
      normalizedHome < 0 || normalizedAway < 0 ||
      normalizedHome > 99 || normalizedAway > 99
    ) {
      res.status(400).json({ message: 'Los pron\u00f3sticos deben tener m\u00e1ximo dos d\u00edgitos' });
      return;
    }

    const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    const displayName = userRecord?.displayName || req.decodedToken.name || req.decodedToken.email || '';

    await prisma.prediction.upsert({
      where: { id: predictionId },
      update: { homeScore: normalizedHome, awayScore: normalizedAway, userName: displayName },
      create: {
        id: predictionId,
        userId,
        userName: displayName,
        matchId,
        tournamentId,
        homeScore: normalizedHome,
        awayScore: normalizedAway,
      },
    });

    res.status(200).json({ message: 'Pron\u00f3stico guardado' });
  } catch (error) {
    console.error('Save prediction error:', error);
    res.status(500).json({ message: 'Error al guardar el pron\u00f3stico' });
  }
});

// Get all predictions for a tournament (admin use: recalculate points)
app.get('/api/tournaments/:id/predictions', requireAuth, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
    if (!tournament) {
      res.status(404).json({ message: 'Torneo no encontrado' });
      return;
    }
    const uid = req.decodedToken.uid;
    const isAdmin = tournament.adminId === uid;

    // If a specific matchId is requested, allow any active participant for locked/finished matches
    const { matchId } = req.query;
    if (matchId) {
      const participant = !isAdmin
        ? await prisma.participant.findUnique({
            where: { userId_tournamentId: { userId: uid, tournamentId: req.params.id } },
          })
        : null;
      if (!isAdmin && (!participant || participant.status !== 'active')) {
        res.status(403).json({ message: 'No autorizado' });
        return;
      }
      if (!isAdmin) {
        const match = await prisma.match.findUnique({ where: { id: matchId } });
        // Allow if showPredictionsAlways is enabled, or if match is locked/finished
        const isLocked = (() => {
          if (!match) return false;
          if (match.status === 'finished') return true;
          if (tournament.showPredictionsAlways) return true;
          const lockMinutes = tournament.predictionLockMinutes ?? 10;
          const rawTime = String(match.time || '00:00').slice(0, 5);
          const matchUTC = new Date(`${match.date}T${rawTime}:00-05:00`);
          const lockUTC = new Date(matchUTC.getTime() - lockMinutes * 60 * 1000);
          return new Date() >= lockUTC;
        })();
        if (!isLocked) {
          res.status(403).json({ message: 'Solo puedes ver pronósticos cuando el partido esté bloqueado' });
          return;
        }
      }
      const predictions = await prisma.prediction.findMany({
        where: { tournamentId: req.params.id, matchId },
        include: { user: { select: { displayName: true, username: true } } },
      });
      return res.json(predictions.map((p) => ({
        id: p.id,
        userId: p.userId,
        matchId: p.matchId,
        tournamentId: p.tournamentId,
        points: p.points,
        userName: p.user?.displayName || p.userId,
        prediction: { homeScore: p.homeScore, awayScore: p.awayScore },
      })));
    }

    // Full list: admin only
    if (!isAdmin) {
      res.status(403).json({ message: 'No autorizado' });
      return;
    }
    const predictions = await prisma.prediction.findMany({
      where: { tournamentId: req.params.id },
      include: { user: { select: { displayName: true, username: true } } },
    });
    res.json(predictions.map((p) => ({
      id: p.id,
      userId: p.userId,
      matchId: p.matchId,
      tournamentId: p.tournamentId,
      points: p.points,
      userName: p.user?.displayName || p.userId,
      prediction: { homeScore: p.homeScore, awayScore: p.awayScore },
    })));
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los pronósticos' });
  }
});

// Bulk update points for a match (admin: after finalizing match result)
app.put('/api/tournaments/:id/predictions/points', requireAuth, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
    if (!tournament) {
      res.status(404).json({ message: 'Torneo no encontrado' });
      return;
    }
    if (tournament.adminId !== req.decodedToken.uid) {
      res.status(403).json({ message: 'No autorizado' });
      return;
    }
    // body: { updates: [{ predictionId, points }], participantPoints: [{ userId, points }] }
    const { updates = [], participantPoints = [] } = req.body || {};
    await prisma.$transaction([
      ...updates.map(({ predictionId, points }) =>
        prisma.prediction.update({ where: { id: predictionId }, data: { points } })
      ),
      ...participantPoints.map(({ userId, points }) =>
        prisma.participant.updateMany({
          where: { userId, tournamentId: req.params.id },
          data: { points },
        })
      ),
    ]);
    res.json({ message: 'Puntos actualizados' });
  } catch (error) {
    console.error('Update points error:', error);
    res.status(500).json({ message: 'Error al actualizar los puntos' });
  }
});

// Recalculate all tournament points for a specific match result (admin)
// body: { matchId, match: <finalized match object> }
// Will recalculate for all tournaments that have predictions for this matchId
app.post('/api/recalculate-match', requireAuth, async (req, res) => {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@worldcup2026.com';
  if (req.decodedToken.email !== superAdminEmail) {
    res.status(403).json({ message: 'No autorizado' });
    return;
  }
  const { matchId, match: finalizedMatch } = req.body || {};
  if (!matchId) {
    res.status(400).json({ message: 'matchId requerido' });
    return;
  }
  try {
    const impactedPredictions = await prisma.prediction.findMany({
      where: { matchId },
      select: { tournamentId: true },
    });
    if (!impactedPredictions.length) {
      res.json({ message: 'Sin pronósticos afectados' });
      return;
    }
    const tournamentIds = [...new Set(impactedPredictions.map((p) => p.tournamentId).filter(Boolean))];

    for (const tournamentId of tournamentIds) {
      const [tournament, tournamentPredictions, participants] = await Promise.all([
        prisma.tournament.findUnique({ where: { id: tournamentId } }),
        prisma.prediction.findMany({ where: { tournamentId } }),
        prisma.participant.findMany({ where: { tournamentId } }),
      ]);
      if (!tournament) continue;

      // Fetch all unique match IDs needed
      const matchIds = [...new Set(tournamentPredictions.map((p) => p.matchId).filter(Boolean))];
      const matchObjects = await prisma.match.findMany({ where: { id: { in: matchIds } } });
      const matchMap = new Map(matchObjects.map((m) => [m.id, m]));
      // Inject the finalized match data
      if (finalizedMatch && matchId) matchMap.set(matchId, { ...matchMap.get(matchId), ...finalizedMatch, id: matchId });

      const participantTotals = new Map(participants.map((p) => [p.userId, 0]));
      const predictionUpdates = [];

      const pointConfig = tournament.pointConfig || { exact: 3, difference: 2, winner: 1 };
      const ROUNDS_GROUP_STAGE = 'group_stage';

      for (const prediction of tournamentPredictions) {
        const predMatch = matchMap.get(prediction.matchId);
        let nextPoints = null;
        if (predMatch?.status === 'finished' && prediction.homeScore != null && prediction.awayScore != null) {
          const round = predMatch.round || '';
          const multiplier = round.toLowerCase().replace(/[\s-]/g, '_') !== ROUNDS_GROUP_STAGE
            ? (tournament.secondRoundMultiplier || 2)
            : 1;
          const pDiff = prediction.homeScore - prediction.awayScore;
          const aDiff = predMatch.homeScore - predMatch.awayScore;
          let pts = 0;
          if (Math.sign(pDiff) === Math.sign(aDiff)) pts += pointConfig.winner;
          if (pDiff === aDiff) pts += pointConfig.difference;
          if (prediction.homeScore === predMatch.homeScore) pts += pointConfig.exact;
          if (prediction.awayScore === predMatch.awayScore) pts += pointConfig.exact;
          nextPoints = pts * multiplier;
        }
        if (prediction.points !== nextPoints) {
          predictionUpdates.push({ id: prediction.id, points: nextPoints });
        }
        if (nextPoints !== null) {
          participantTotals.set(prediction.userId, (participantTotals.get(prediction.userId) || 0) + nextPoints);
        }
      }

      await prisma.$transaction([
        ...predictionUpdates.map(({ id, points }) =>
          prisma.prediction.update({ where: { id }, data: { points } })
        ),
        ...participants.map((p) => {
          const nextTotal = participantTotals.get(p.userId) || 0;
          return prisma.participant.update({ where: { id: p.id }, data: { points: nextTotal } });
        }),
      ]);

      // Compute and save standings
      const activeParticipants = participants.filter((p) => p.status === 'active');
      const userIds = activeParticipants.map((p) => p.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, username: true, favoriteTeam: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));
      const standingsEntries = activeParticipants
        .map((p) => ({
          userId: p.userId,
          points: participantTotals.get(p.userId) || 0,
          displayName: userMap.get(p.userId)?.displayName || 'Usuario',
          username: userMap.get(p.userId)?.username || '',
          favoriteTeam: userMap.get(p.userId)?.favoriteTeam || null,
        }))
        .sort((a, b) => b.points - a.points);

      await prisma.standing.upsert({
        where: { tournamentId },
        update: { entries: standingsEntries },
        create: { tournamentId, entries: standingsEntries },
      });
    }

    res.json({ message: 'Puntos recalculados', tournamentCount: tournamentIds.length });
  } catch (error) {
    console.error('Recalculate match error:', error);
    res.status(500).json({ message: 'Error al recalcular puntos' });
  }
});

// ─── Platform Settings ─────────────────────────────────────────────────────

app.get('/api/platform-settings', async (req, res) => {
  try {
    const settings = await prisma.platformSettings.findUnique({ where: { id: 'global' } });
    res.json(settings?.data || {});
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener configuración' });
  }
});

app.put('/api/platform-settings', requireAuth, async (req, res) => {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@worldcup2026.com';
  if (req.decodedToken.email !== superAdminEmail) {
    res.status(403).json({ message: 'No autorizado' });
    return;
  }
  try {
    const existing = await prisma.platformSettings.findUnique({ where: { id: 'global' } });
    const merged = { ...(existing?.data || {}), ...req.body };
    const settings = await prisma.platformSettings.upsert({
      where: { id: 'global' },
      update: { data: merged },
      create: { id: 'global', data: merged },
    });
    res.json(settings.data);
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar configuración' });
  }
});

// ─── Standings ─────────────────────────────────────────────────────────────

app.get('/api/standings/:tournamentId', requireAuth, async (req, res) => {
  try {
    const [standing, activeParticipants] = await Promise.all([
      prisma.standing.findUnique({ where: { tournamentId: req.params.tournamentId } }),
      prisma.participant.findMany({
        where: { tournamentId: req.params.tournamentId, status: 'active' },
        select: { userId: true },
      }),
    ]);
    if (!standing) {
      res.status(404).json({ message: 'Sin clasificación disponible' });
      return;
    }
    const activeUserIds = new Set(activeParticipants.map((p) => p.userId));
    const filteredEntries = Array.isArray(standing.entries)
      ? standing.entries.filter((e) => activeUserIds.has(e.userId))
      : standing.entries;
    res.json({ ...standing, entries: filteredEntries });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener la clasificación' });
  }
});

app.put('/api/standings/:tournamentId', requireAuth, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({ where: { id: req.params.tournamentId } });
    if (!tournament) {
      res.status(404).json({ message: 'Torneo no encontrado' });
      return;
    }
    if (tournament.adminId !== req.decodedToken.uid) {
      res.status(403).json({ message: 'No autorizado' });
      return;
    }
    const { entries } = req.body || {};
    const standing = await prisma.standing.upsert({
      where: { tournamentId: req.params.tournamentId },
      update: { entries },
      create: { tournamentId: req.params.tournamentId, entries },
    });
    res.json(standing);
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar la clasificaci\u00f3n' });
  }
});

// ─── Notifications ─────────────────────────────────────────────────────────

app.get('/api/notifications', requireAuth, async (req, res) => {
  const uid = req.decodedToken.uid;
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId: uid, type: { in: ['approved', 'rejected'] } },
          { adminId: uid, type: 'pending_approval' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { displayName: true } },
        tournament: { select: { name: true } },
      },
    });
    const enriched = notifications.map((n) => ({
      ...n,
      userName: n.user?.displayName || 'Usuario',
      tournamentName: n.tournament?.name || 'Torneo',
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener las notificaciones' });
  }
});

app.put('/api/notifications/:id/read', requireAuth, async (req, res) => {
  const uid = req.decodedToken.uid;
  try {
    const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notif) {
      res.status(404).json({ message: 'Notificaci\u00f3n no encontrada' });
      return;
    }
    if (notif.userId !== uid && notif.adminId !== uid) {
      res.status(403).json({ message: 'No autorizado' });
      return;
    }
    await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
    res.json({ message: 'Marcada como le\u00edda' });
  } catch (error) {
    res.status(500).json({ message: 'Error al marcar la notificaci\u00f3n' });
  }
});

// ─── FCM Tokens ────────────────────────────────────────────────────────────

app.post('/api/fcm/token', requireAuth, async (req, res) => {
  const uid = req.decodedToken.uid;
  const token = String(req.body?.token || '').trim();
  if (!token) {
    res.status(400).json({ message: 'Token requerido' });
    return;
  }
  try {
    // Ensure user exists before adding token (FK constraint)
    await prisma.user.upsert({
      where: { id: uid },
      update: {},
      create: { id: uid, email: req.decodedToken.email || null },
    });
    await prisma.fcmToken.upsert({
      where: { token },
      update: { userId: uid },
      create: { token, userId: uid },
    });
    res.json({ message: 'Token guardado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar el token' });
  }
});

app.delete('/api/fcm/token', requireAuth, async (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!token) {
    res.status(400).json({ message: 'Token requerido' });
    return;
  }
  try {
    await prisma.fcmToken.deleteMany({ where: { token, userId: req.decodedToken.uid } });
    res.json({ message: 'Token eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar el token' });
  }
});

// ─── FCM: Send notification ────────────────────────────────────────────────

async function sendFCMNotification(userId, token, payload) {
  try {
    const result = await admin.messaging().send({
      token,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
      webpush: {
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          vibrate: [200, 100, 200],
        },
        fcmOptions: { link: payload.data?.url || '/' },
      },
    });
    console.log(`[FCM] Notificaci\u00f3n enviada a userId=${userId}, messageId=${result}`);
  } catch (err) {
    console.error(`[FCM] Error enviando a userId=${userId}: ${err.code} - ${err.message}`);
    const invalidTokenCodes = new Set([
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
    ]);
    if (invalidTokenCodes.has(err.code)) {
      await prisma.fcmToken.deleteMany({ where: { token } }).catch(() => {});
    }
  }
}

// ─── Cron: Notificaciones FCM ──────────────────────────────────────────────

function matchDateCOToUTC(dateStr, timeStr) {
  const t = String(timeStr || '00:00').slice(0, 5);
  return new Date(`${dateStr}T${t}:00-05:00`);
}

async function notifyMissingPredictions() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 35 * 60 * 1000);

  try {
    // Only fetch matches starting in the next 35 minutes
    const scheduled = await prisma.match.findMany({
      where: { status: 'scheduled' },
      select: { id: true, date: true, time: true, homeTeam: true, awayTeam: true },
    });

    const upcoming = scheduled.filter((m) => {
      const utc = matchDateCOToUTC(m.date, m.time);
      return utc > now && utc <= windowEnd;
    });

    if (upcoming.length === 0) return; // nothing to notify — zero DB reads beyond this point

    // Fetch all tournaments and their active participants only once
    const tournaments = await prisma.tournament.findMany({
      select: { id: true, name: true },
    });

    for (const match of upcoming) {
      const alreadyNotified = await prisma.matchNotification.findUnique({ where: { matchId: match.id } });
      if (alreadyNotified) continue;

      await prisma.matchNotification.create({
        data: { matchId: match.id, matchDate: match.date, matchTime: match.time },
      });

      const matchUTC = matchDateCOToUTC(match.date, match.time);

      for (const tournament of tournaments) {
        const participants = await prisma.participant.findMany({
          where: { tournamentId: tournament.id, status: 'active' },
          select: { userId: true },
        });

        for (const { userId } of participants) {
          const predictionId = `${userId}_${tournament.id}_${match.id}`;
          const hasPrediction = await prisma.prediction.findUnique({ where: { id: predictionId } });
          if (hasPrediction) continue;

          const tokens = await prisma.fcmToken.findMany({ where: { userId }, select: { token: true } });
          if (tokens.length === 0) continue;

          const minutesLeft = Math.round((matchUTC - now) / 60000);
          const payload = {
            title: `\u23f0 \u00a1Faltan ~${minutesLeft} minutos!`,
            body: `A\u00fan no has pronosticado ${match.homeTeam} vs ${match.awayTeam} en "${tournament.name}". \u00a1Date prisa!`,
            data: { url: `/tournaments/${tournament.id}/predictions`, tournamentId: tournament.id, matchId: match.id },
          };

          await Promise.all(tokens.map((t) => sendFCMNotification(userId, t.token, payload)));
        }
      }

      console.log(`[Cron] Notificaciones enviadas para ${match.homeTeam} vs ${match.awayTeam}`);
    }
  } catch (err) {
    console.error('[Cron] Error en notifyMissingPredictions:', err.message);
  }
}

cron.schedule('*/5 * * * *', () => { notifyMissingPredictions(); });
notifyMissingPredictions();
console.log('[Cron] Notificaciones FCM programadas (cada 5 min)');

// ─── Start ─────────────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
