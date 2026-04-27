import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  increment,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './useAuth';
import { generateInviteCode } from '../utils/helpers';

export function useTournaments() {
  const { currentUser } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      setTournaments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'participants'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const tournamentIds = snapshot.docs.map((d) => d.data().tournamentId);
        if (tournamentIds.length === 0) {
          setTournaments([]);
          setLoading(false);
          return;
        }

        const tournamentDocs = await Promise.all(
          tournamentIds.map((id) => getDoc(doc(db, 'tournaments', id)))
        );

        const existingDocs = tournamentDocs.filter((d) => d.exists());

        const participantCounts = await Promise.all(
          existingDocs.map((d) =>
            getCountFromServer(
              query(
                collection(db, 'participants'),
                where('tournamentId', '==', d.id),
                where('status', '==', 'active')
              )
            )
          )
        );

        const data = existingDocs.map((d, i) => ({
          id: d.id,
          ...d.data(),
          memberCount: participantCounts[i].data().count,
        }));

        setTournaments(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  const createTournament = useCallback(
    async (tournamentData) => {
      if (!currentUser) throw new Error('Must be logged in');

      const inviteCode = generateInviteCode();
      const newTournament = {
        ...tournamentData,
        adminId: currentUser.uid,
        inviteCode,
        memberCount: 1,
        secondRoundMultiplier: tournamentData.secondRoundMultiplier || 2,
        predictionLockMinutes: tournamentData.predictionLockMinutes || 10,
        pointConfig: tournamentData.pointConfig || {
          exact: 3,
          difference: 2,
          winner: 1,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'tournaments'), newTournament);

      // Add creator as participant
      await addDoc(collection(db, 'participants'), {
        userId: currentUser.uid,
        tournamentId: docRef.id,
        points: 0,
        status: 'active',
        role: 'admin',
        joinedAt: serverTimestamp(),
      });

      return docRef.id;
    },
    [currentUser]
  );

  const updateTournament = useCallback(async (tournamentId, data) => {
    const docRef = doc(db, 'tournaments', tournamentId);
    await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
  }, []);

  const deleteTournament = useCallback(async (tournamentId) => {
    await deleteDoc(doc(db, 'tournaments', tournamentId));
  }, []);

  const joinTournament = useCallback(
    async (inviteCode) => {
      if (!currentUser) throw new Error('Must be logged in');

      const q = query(
        collection(db, 'tournaments'),
        where('inviteCode', '==', inviteCode)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) throw new Error('El torneo no existe, por favor verifica el código de invitación e intenta nuevamente');

      const tournament = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

      // Check if already a participant
      const participantQ = query(
        collection(db, 'participants'),
        where('userId', '==', currentUser.uid),
        where('tournamentId', '==', tournament.id)
      );

      const existingParticipant = await getDocs(participantQ);

      if (!existingParticipant.empty) throw new Error('Ya eres participante de este torneo');

      const status = tournament.requiresApproval ? 'pending' : 'active';

      await addDoc(collection(db, 'participants'), {
        userId: currentUser.uid,
        tournamentId: tournament.id,
        points: 0,
        status,
        role: 'member',
        joinedAt: serverTimestamp(),
      });

      // Incrementar memberCount solo si se une directamente (sin aprobación)
      if (!tournament.requiresApproval) {
        await updateDoc(doc(db, 'tournaments', tournament.id), {
          memberCount: increment(1),
        });
      }

      // Crear notificación para el admin si requiere aprobación
      if (tournament.requiresApproval) {
        const adminNotificationRef = collection(db, 'notifications');
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();

        await addDoc(adminNotificationRef, {
          adminId: tournament.adminId,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          userId: currentUser.uid,
          userName: userData?.displayName || currentUser.email,
          type: 'pending_approval',
          read: false,
          createdAt: serverTimestamp(),
          redirectUrl: `/tournaments/${tournament.id}/participants`
        });
      }

      return tournament;
    },
    [currentUser]
  );

  const getTournament = useCallback(async (tournamentId) => {
    const docRef = doc(db, 'tournaments', tournamentId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  }, []);

    const fetchTournaments = useCallback(async () => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'participants'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'active')
    );

    const snapshot = await getDocs(q);
    const tournamentIds = snapshot.docs.map((d) => d.data().tournamentId);

    if (tournamentIds.length === 0) {
      setTournaments([]);
      return;
    }

    const tournamentDocs = await Promise.all(
      tournamentIds.map((id) => getDoc(doc(db, 'tournaments', id)))
    );

    const existingDocs = tournamentDocs.filter((d) => d.exists());

    const participantCounts = await Promise.all(
      existingDocs.map((d) =>
        getCountFromServer(
          query(
            collection(db, 'participants'),
            where('tournamentId', '==', d.id),
            where('status', '==', 'active')
          )
        )
      )
    );

    const data = existingDocs.map((d, i) => ({
      id: d.id,
      ...d.data(),
      memberCount: participantCounts[i].data().count,
    }));

    setTournaments(data);
  }, [currentUser]);

  return {
    tournaments,
    loading,
    error,
    createTournament,
    updateTournament,
    deleteTournament,
    joinTournament,
    getTournament,
    fetchTournaments
  };
}

export default useTournaments;
