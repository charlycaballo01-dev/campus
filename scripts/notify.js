/**
 * Envía notificaciones push (FCM) revisando Firestore. Corre gratis vía GitHub Actions
 * (cron programado) — NO depende de Cloud Functions ni del plan Blaze de Firebase.
 * Mandar push (FCM) y leer/escribir Firestore son gratis siempre, en cualquier plan.
 *
 * Uso:
 *   node scripts/notify.js frequent   -> novedades + reservas + cola de push (cada 15 min)
 *   node scripts/notify.js daily      -> inactividad + ritmo semanal (una vez al día)
 *
 * Necesita la variable de entorno FIREBASE_SERVICE_ACCOUNT con el JSON completo
 * de la cuenta de servicio de Firebase (se configura como GitHub Secret, ver instrucciones
 * en README-notificaciones.md).
 */
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const messaging = admin.messaging();

async function sendPushToStudent(studentId, title, body) {
  const snap = await db.collection('students').doc(studentId).get();
  const token = snap.exists ? snap.data().fcmToken : null;
  if (!token) return;
  try {
    await messaging.send({ token, notification: { title, body } });
    console.log(`Push enviado a ${studentId}: ${title}`);
  } catch (err) {
    console.error(`Error enviando push a ${studentId}:`, err.message);
    // Token vencido/inválido (el alumno desinstaló, cambió de navegador, etc.) -> lo limpiamos
    if (err.code === 'messaging/registration-token-not-registered') {
      await db.collection('students').doc(studentId).update({ fcmToken: admin.firestore.FieldValue.delete() });
    }
  }
}

// 1) Cola genérica de push (la usan las felicitaciones al aprobar/completar una materia)
async function processPushQueue() {
  const snap = await db.collection('pushQueue').get();
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.studentId) await sendPushToStudent(data.studentId, data.title || 'C.A.E.R.', data.body || '');
    await doc.ref.delete();
  }
}

// 2) Novedades nuevas publicadas desde el panel admin -> aviso a todos los alumnos activos
async function processNewUpdates() {
  const snap = await db.collection('updates').get();
  const pending = snap.docs.filter(d => !d.data().notified);
  if (!pending.length) return;
  const studentsSnap = await db.collection('students').where('status', '==', 'Activo').get();
  const activeStudents = studentsSnap.docs.filter(d => d.data().fcmToken);
  for (const doc of pending) {
    const update = doc.data();
    await Promise.all(
      activeStudents.map(s => sendPushToStudent(s.id, '📢 Nueva novedad de C.A.E.R.', update.title || ''))
    );
    await doc.ref.update({ notified: true });
  }
}

// 3) Recordatorio de clase particular reservada (1 hora y media antes)
async function processBookingReminders() {
  const now = new Date();
  const in90min = new Date(now.getTime() + 90 * 60000);
  const snap = await db.collection('bookings').where('status', 'in', ['Reservada', 'Confirmada']).get();
  for (const doc of snap.docs) {
    const b = doc.data();
    if (b.reminderSent || !b.date || !b.time) continue;
    const bookingDateTime = new Date(`${b.date}T${b.time}:00`);
    if (bookingDateTime > now && bookingDateTime <= in90min) {
      await sendPushToStudent(b.studentId, '⏰ Tu clase se acerca', `Tenés tu clase particular hoy a las ${b.time}.`);
      await doc.ref.update({ reminderSent: true });
    }
  }
}

// 4) Inactividad + ritmo de avance (corre una vez al día)
async function processDailyReminders() {
  const now = new Date();
  const snap = await db.collection('students').where('status', '==', 'Activo').get();
  for (const doc of snap.docs) {
    const s = doc.data();
    if (!s.fcmToken) continue;

    // --- Inactividad ---
    const lastActive = s.lastActiveAt ? new Date(s.lastActiveAt) : null;
    const daysInactive = lastActive ? Math.floor((now - lastActive) / 86400000) : 999;
    const lastPing = s.lastInactivityPingAt ? new Date(s.lastInactivityPingAt) : null;
    const daysSincePing = lastPing ? Math.floor((now - lastPing) / 86400000) : 999;

    if (daysInactive >= 3 && daysSincePing >= 3) {
      await sendPushToStudent(
        doc.id,
        '¡Te extrañamos! 👋',
        `Hace ${daysInactive} días que no entrás a C.A.E.R. Volvé y seguí donde dejaste.`
      );
      await doc.ref.update({ lastInactivityPingAt: now.toISOString() });
    }

    // --- Ritmo semanal ---
    const lastSnapshotAt = s.weeklyPctSnapshotAt ? new Date(s.weeklyPctSnapshotAt) : null;
    const daysSinceSnapshot = lastSnapshotAt ? Math.floor((now - lastSnapshotAt) / 86400000) : 999;
    if (daysSinceSnapshot >= 7) {
      const currentPct = s.overallPct || 0;
      const prevPct = s.weeklyPctSnapshot ?? currentPct;
      if (currentPct - prevPct < 3 && daysInactive < 3) {
        await sendPushToStudent(
          doc.id,
          'Vamos que se puede 💪',
          `Esta semana avanzaste poco (estás en ${currentPct}%). Un empujoncito más y lo lográs.`
        );
      }
      await doc.ref.update({ weeklyPctSnapshot: currentPct, weeklyPctSnapshotAt: now.toISOString() });
    }
  }
}

async function main() {
  const mode = process.argv[2] || 'frequent';
  if (mode === 'frequent') {
    await processPushQueue();
    await processNewUpdates();
    await processBookingReminders();
  } else if (mode === 'daily') {
    await processDailyReminders();
  } else {
    console.error('Modo desconocido:', mode, '(usar "frequent" o "daily")');
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
