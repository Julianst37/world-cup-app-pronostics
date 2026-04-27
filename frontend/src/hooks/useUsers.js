import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  addDoc,
  getDoc,
  getDocs,
  increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export function useUsers(tournamentId) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tournamentId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'participants'),
      where('tournamentId', '==', tournamentId),
      orderBy('points', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [tournamentId]);


  const updateParticipantStatus = useCallback(async (participantId, status) => {
    const docRef = doc(db, 'participants', participantId);
    const participantDoc = await getDoc(docRef);
    const participant = participantDoc.data();

    await updateDoc(docRef, { status, updatedAt: serverTimestamp() });

    // Actualizar memberCount según el cambio de estado
    const tournamentRef = doc(db, 'tournaments', participant.tournamentId);
    const prevStatus = participant.status;
    if (prevStatus !== 'active' && status === 'active') {
      await updateDoc(tournamentRef, { memberCount: increment(1) });
    } else if (prevStatus === 'active' && status !== 'active') {
      await updateDoc(tournamentRef, { memberCount: increment(-1) });
    }

    // Crear notificación para el usuario
    if (status === 'active' || status === 'rejected') {
      const userDoc = await getDoc(doc(db, 'users', participant.userId));
      const userData = userDoc.data();
      const tournamentDoc = await getDoc(doc(db, 'tournaments', participant.tournamentId));
      const tournamentData = tournamentDoc.data();

      const notificationType = status === 'active' ? 'approved' : 'rejected';
      const redirectUrl = status === 'active' ? `/tournaments/${participant.tournamentId}/home` : '/dashboard';

      await addDoc(collection(db, 'notifications'), {
        userId: participant.userId,
        tournamentId: participant.tournamentId,
        tournamentName: tournamentData?.name,
        type: notificationType,
        read: false,
        createdAt: serverTimestamp(),
        redirectUrl
      });
    }

    // Notificación cuando se inhabilita
    if (status === 'inactive') {
      const userDoc = await getDoc(doc(db, 'users', participant.userId));
      const userData = userDoc.data();
      const tournamentDoc = await getDoc(doc(db, 'tournaments', participant.tournamentId));
      const tournamentData = tournamentDoc.data();

      await addDoc(collection(db, 'notifications'), {
        userId: participant.userId,
        tournamentId: participant.tournamentId,
        tournamentName: tournamentData?.name,
        type: 'disabled',
        read: false,
        createdAt: serverTimestamp(),
        redirectUrl: '/dashboard'
      });
    }
  }, []);

  const removeParticipant = useCallback(async (participantId) => {
    const docRef = doc(db, 'participants', participantId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const { userId, tournamentId, status } = snap.data();

    // Decrementar memberCount si estaba activo
    if (status === 'active') {
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        memberCount: increment(-1),
      });
    }

    // Eliminar pronósticos del usuario en este torneo
    const predsQuery = query(
      collection(db, 'predictions'),
      where('userId', '==', userId),
      where('tournamentId', '==', tournamentId)
    );
    const predsSnap = await getDocs(predsQuery);
    await Promise.all(predsSnap.docs.map((d) => deleteDoc(d.ref)));

    // Eliminar participante
    await deleteDoc(docRef);
  }, []);

  return { users, loading, error, updateParticipantStatus, removeParticipant };
}

export default useUsers;
