require('dotenv').config();

const cors = require('cors');
const express = require('express');
const admin = require('firebase-admin');
const cron = require('node-cron');

const { renderPasswordChangeWcTemplate } = require('./templates/passwordChangeWc');

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

const app = express();
const db = admin.firestore();
const port = Number(process.env.PORT || 3001);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
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

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

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
  if (!password) return 'La contraseña es requerida';
  if (password.length > 64) return 'La contraseña no puede tener más de 64 caracteres';
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe tener al menos una mayúscula';
  if (!/[0-9]/.test(password)) return 'La contraseña debe tener al menos un número';
  return null;
}

async function callIdentityToolkit(payload) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${process.env.FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
  const userRef = db.collection('users').doc(userRecord.uid);
  const userDoc = await userRef.get();
  const userData = userDoc.exists ? userDoc.data() : {};

  return {
    userRecord,
    userRef,
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

  if (!oobCode) {
    throw new Error('Reset link missing oobCode');
  }

  const customUrl = new URL(frontendUrl);
  customUrl.searchParams.set('oobCode', oobCode);
  customUrl.searchParams.set('mode', mode);
  customUrl.searchParams.set('lang', lang);

  return customUrl.toString();
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

    const userRef = db.collection('users').doc(userRecord.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const passwordState = getPasswordChangeState(userData);

    if (passwordState.hasReachedLimit) {
      res.status(403).json({ message: 'Has alcanzado el máximo de 3 cambios de contraseña.' });
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
      appName: process.env.APP_NAME || 'World Cup 2026 Pronosticos',
      supportEmail: process.env.SUPPORT_EMAIL || 'soporte@example.com',
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
    res.status(400).json({ message: 'Código de recuperación inválido' });
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
      res.status(403).json({ message: 'Has alcanzado el máximo de 3 cambios de contraseña.' });
      return;
    }

    res.status(200).json({
      email,
      remainingChanges: passwordState.remainingChanges,
      passwordChangeCount: passwordState.passwordChangeCount,
      passwordChangeLimit: passwordState.passwordChangeLimit,
    });
  } catch (error) {
    const invalidCodeErrors = new Set(['EXPIRED_OOB_CODE', 'INVALID_OOB_CODE']);

    if (invalidCodeErrors.has(error.code)) {
      res.status(400).json({ message: 'El enlace ha expirado o ya no es válido.' });
      return;
    }

    console.error('Reset password validate error:', error);
    res.status(500).json({ message: 'No fue posible validar el enlace de recuperación' });
  }
});

app.post('/api/auth/reset-password/confirm', async (req, res) => {
  const oobCode = String(req.body?.oobCode || '').trim();
  const newPassword = String(req.body?.newPassword || '');
  const passwordError = validatePassword(newPassword);

  if (!oobCode) {
    res.status(400).json({ message: 'Código de recuperación inválido' });
    return;
  }

  if (passwordError) {
    res.status(400).json({ message: passwordError });
    return;
  }

  try {
    const resetData = await callIdentityToolkit({ oobCode });
    const email = String(resetData.email || '').trim().toLowerCase();
    const { userRef, passwordState } = await getUserForPasswordChangeByEmail(email);

    if (passwordState.hasReachedLimit) {
      res.status(403).json({ message: 'Has alcanzado el máximo de 3 cambios de contraseña.' });
      return;
    }

    await callIdentityToolkit({ oobCode, newPassword });

    await userRef.set(
      {
        passwordChangeCount: passwordState.passwordChangeCount + 1,
        passwordChangeLimit: passwordState.passwordChangeLimit,
        lastPasswordChangedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.status(200).json({
      message: 'Contraseña actualizada correctamente',
      remainingChanges: Math.max(passwordState.passwordChangeLimit - (passwordState.passwordChangeCount + 1), 0),
    });
  } catch (error) {
    const invalidCodeErrors = new Set(['EXPIRED_OOB_CODE', 'INVALID_OOB_CODE']);

    if (invalidCodeErrors.has(error.code)) {
      res.status(400).json({ message: 'El enlace ha expirado o ya no es válido.' });
      return;
    }

    console.error('Reset password confirm error:', error);
    res.status(500).json({ message: 'No fue posible restablecer la contraseña' });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  const idToken = String(req.body?.idToken || '').trim();
  const newPassword = String(req.body?.newPassword || '');
  const passwordError = validatePassword(newPassword);

  if (!idToken) {
    res.status(401).json({ message: 'Sesión inválida' });
    return;
  }

  if (passwordError) {
    res.status(400).json({ message: passwordError });
    return;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userRef = db.collection('users').doc(decodedToken.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const passwordState = getPasswordChangeState(userData);

    if (passwordState.hasReachedLimit) {
      res.status(403).json({ message: 'Has alcanzado el máximo de 3 cambios de contraseña.' });
      return;
    }

    await admin.auth().updateUser(decodedToken.uid, { password: newPassword });

    await userRef.set(
      {
        passwordChangeCount: passwordState.passwordChangeCount + 1,
        passwordChangeLimit: passwordState.passwordChangeLimit,
        lastPasswordChangedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.status(200).json({
      message: 'Contraseña actualizada correctamente',
      remainingChanges: Math.max(passwordState.passwordChangeLimit - (passwordState.passwordChangeCount + 1), 0),
    });
  } catch (error) {
    console.error('Authenticated change password error:', error);
    res.status(500).json({ message: 'No fue posible actualizar la contraseña' });
  }
});

// ─── Predictions ───────────────────────────────────────────────────────────

/**
 * Parse a match date+time stored as Colombia local time (America/Bogota, UTC-5)
 * and return the equivalent UTC Date object.
 * Uses an explicit -05:00 offset so the result is correct regardless of the
 * server's own timezone setting.
 */
function matchDateTimeToUTC(dateStr, timeStr) {
  const rawTime = String(timeStr || '00:00').slice(0, 5); // ensure "HH:MM"
  return new Date(`${dateStr}T${rawTime}:00-05:00`);
}

app.post('/api/predictions', async (req, res) => {
  const authHeader = String(req.headers.authorization || '');
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!idToken) {
    res.status(401).json({ message: 'No autorizado' });
    return;
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado' });
    return;
  }

  const userId = decodedToken.uid;
  const tournamentId = String(req.body?.tournamentId || '').trim();
  const matchId = String(req.body?.matchId || '').trim();
  const { homeScore, awayScore } = req.body ?? {};

  if (!tournamentId || !matchId) {
    res.status(400).json({ message: 'Datos incompletos' });
    return;
  }

  // Fetch match, tournament, and participant status in parallel
  let matchDoc, tournamentDoc, participantSnap;
  try {
    [matchDoc, tournamentDoc, participantSnap] = await Promise.all([
      db.collection('matches').doc(matchId).get(),
      db.collection('tournaments').doc(tournamentId).get(),
      db
        .collection('participants')
        .where('userId', '==', userId)
        .where('tournamentId', '==', tournamentId)
        .where('status', '==', 'active')
        .get(),
    ]);
  } catch (err) {
    console.error('Firestore read error:', err);
    res.status(500).json({ message: 'Error al consultar los datos' });
    return;
  }

  if (!matchDoc.exists || !tournamentDoc.exists) {
    res.status(404).json({ message: 'Partido o torneo no encontrado' });
    return;
  }

  if (participantSnap.empty) {
    res.status(403).json({ message: 'No eres un participante activo en este torneo' });
    return;
  }

  const match = matchDoc.data();
  const tournament = tournamentDoc.data();

  // Lock check — always uses server UTC time, immune to client clock/VPN manipulation.
  // Match date+time is stored as Colombia local time (UTC-5); we convert to UTC with an
  // explicit offset so the comparison is always correct.
  if (match.status === 'finished') {
    res.status(423).json({ message: 'Este pronóstico ya está bloqueado (partido finalizado)' });
    return;
  }

  const lockMinutes = Number(tournament.predictionLockMinutes ?? 10);
  const matchUTC = matchDateTimeToUTC(match.date, match.time);
  const lockUTC = new Date(matchUTC.getTime() - lockMinutes * 60 * 1000);
  const serverNow = new Date(); // UTC — never affected by client

  if (serverNow >= lockUTC) {
    res.status(423).json({
      message: `El plazo para pronosticar este partido ya cerró (${lockMinutes} min antes del partido).`,
    });
    return;
  }

  const predictionId = `${userId}_${tournamentId}_${matchId}`;
  const predictionRef = db.collection('predictions').doc(predictionId);

  // Delete prediction when both scores are null
  if (homeScore === null && awayScore === null) {
    await predictionRef.delete();
    res.status(200).json({ message: 'Pronóstico eliminado' });
    return;
  }

  // Validate scores
  const normalizedHome = Number(homeScore);
  const normalizedAway = Number(awayScore);

  if (
    !Number.isInteger(normalizedHome) ||
    !Number.isInteger(normalizedAway) ||
    normalizedHome < 0 ||
    normalizedAway < 0 ||
    normalizedHome > 99 ||
    normalizedAway > 99
  ) {
    res.status(400).json({ message: 'Los pronósticos deben tener máximo dos dígitos' });
    return;
  }

  // Resolve display name
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : {};
  const displayName =
    userData.displayName || decodedToken.name || decodedToken.email || '';

  await predictionRef.set(
    {
      userId,
      userName: displayName,
      matchId,
      tournamentId,
      prediction: { homeScore: normalizedHome, awayScore: normalizedAway },
      points: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  res.status(200).json({ message: 'Pronóstico guardado' });
});

// ─── FCM Push Notifications ────────────────────────────────────────────────

/**
 * Envía una notificación FCM a un token específico.
 * Si el token ya no es válido, lo elimina de Firestore.
 */
async function sendFCMNotification(userId, token, payload) {
  try {
    const result = await admin.messaging().send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      webpush: {
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          vibrate: [200, 100, 200],
        },
        fcmOptions: {
          link: payload.data?.url || '/',
        },
      },
    });
    console.log(`[FCM] ✅ Notificación enviada a userId=${userId}, messageId=${result}`);
  } catch (err) {
    console.error(`[FCM] ❌ Error enviando a userId=${userId}: ${err.code} - ${err.message}`);
    const invalidTokenCodes = new Set([
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
    ]);
    if (invalidTokenCodes.has(err.code)) {
      console.log(`[FCM] 🗑️ Token inválido eliminado para userId=${userId}`);
      await db
        .collection('users')
        .doc(userId)
        .collection('fcmTokens')
        .doc(token)
        .delete()
        .catch(() => {});
    }
  }
}

/**
 * Interpreta fecha+hora almacenada como hora Colombia (UTC-5) y retorna Date en UTC.
 */
function matchDateCOToUTC(dateStr, timeStr) {
  const t = String(timeStr || '00:00').slice(0, 5);
  return new Date(`${dateStr}T${t}:00-05:00`);
}

/**
 * Cron job — corre cada 5 minutos.
 *
 * Estrategia robusta: busca partidos que empiecen en los próximos 35 minutos
 * y que NO hayan sido notificados aún (campo notifiedAt en matchNotifications/{matchId}).
 * Al notificar, escribe ese registro para evitar duplicados aunque el backend
 * se reinicie o el cron corra varias veces.
 */
async function notifyMissingPredictions() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 35 * 60 * 1000); // próximos 35 min

  try {
    const matchesSnap = await db
      .collection('matches')
      .where('status', '==', 'scheduled')
      .get();

    for (const matchDoc of matchesSnap.docs) {
      const match = matchDoc.data();
      const matchUTC = matchDateCOToUTC(match.date, match.time);

      // Solo partidos que falten ≤ 35 min Y aún no hayan pasado
      if (matchUTC <= now || matchUTC > windowEnd) continue;

      const matchId = matchDoc.id;

      // Verificar si ya fue notificado (por cualquier torneo)
      const notifDoc = await db.collection('matchNotifications').doc(matchId).get();
      if (notifDoc.exists) continue; // ya notificado

      // Marcar como notificado ANTES de enviar para evitar duplicados en paralelo
      await db.collection('matchNotifications').doc(matchId).set({
        notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        matchDate: match.date,
        matchTime: match.time,
      });

      const tournamentsSnap = await db.collection('tournaments').get();

      for (const tournamentDoc of tournamentsSnap.docs) {
        const tournamentId = tournamentDoc.id;
        const tournament = tournamentDoc.data();

        const participantsSnap = await db
          .collection('participants')
          .where('tournamentId', '==', tournamentId)
          .where('status', '==', 'active')
          .get();

        for (const participantDoc of participantsSnap.docs) {
          const { userId } = participantDoc.data();

          const predictionId = `${userId}_${tournamentId}_${matchId}`;
          const predSnap = await db.collection('predictions').doc(predictionId).get();
          if (predSnap.exists) continue; // ya pronosticó

          const tokensSnap = await db
            .collection('users')
            .doc(userId)
            .collection('fcmTokens')
            .get();

          if (tokensSnap.empty) {
            console.log(`[Cron] ℹ️ Sin token FCM para userId=${userId} (torneo=${tournamentId})`);
            continue;
          }

          const minutesLeft = Math.round((matchUTC - now) / 60000);
          const homeTeam = match.homeTeam || 'Local';
          const awayTeam = match.awayTeam || 'Visitante';
          const payload = {
            title: `⏰ ¡Faltan ~${minutesLeft} minutos!`,
            body: `Aún no has pronosticado ${homeTeam} vs ${awayTeam} en "${tournament.name}". ¡Date prisa!`,
            data: {
              url: `/tournaments/${tournamentId}/predictions`,
              tournamentId,
              matchId,
            },
          };

          await Promise.all(
            tokensSnap.docs.map((tokenDoc) =>
              sendFCMNotification(userId, tokenDoc.data().token, payload)
            )
          );
        }
      }

      console.log(`[Cron] Notificaciones enviadas para partido ${matchId} (${match.homeTeam} vs ${match.awayTeam})`);
    }
  } catch (err) {
    console.error('[Cron] Error en notifyMissingPredictions:', err.message);
  }
}

// Corre cada 5 minutos
cron.schedule('*/5 * * * *', () => {
  notifyMissingPredictions();
});

// Ejecutar una vez al iniciar el servidor para no perder partidos si el backend arrancó tarde
notifyMissingPredictions();

console.log('[Cron] Notificaciones FCM programadas (cada 5 min) + ejecución inmediata al iniciar');

app.listen(port, () => {
  console.log(`Password recovery service listening on port ${port}`);
});