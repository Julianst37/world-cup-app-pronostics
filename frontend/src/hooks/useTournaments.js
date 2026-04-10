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
  serverTimestamp,
  arrayUnion,
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

        const data = tournamentDocs
          .filter((d) => d.exists())
          .map((d) => ({ id: d.id, ...d.data() }));

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

      const snapshot = await new Promise((resolve, reject) => {
        const unsub = onSnapshot(q, resolve, reject);
        return unsub;
      });

      if (snapshot.empty) throw new Error('Tournament not found');

      const tournament = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

      // Check if already a participant
      const participantQ = query(
        collection(db, 'participants'),
        where('userId', '==', currentUser.uid),
        where('tournamentId', '==', tournament.id)
      );

      const existingParticipant = await new Promise((resolve, reject) => {
        const unsub = onSnapshot(participantQ, resolve, reject);
        return unsub;
      });

      if (!existingParticipant.empty) throw new Error('Already a participant');

      const status = tournament.requiresApproval ? 'pending' : 'active';

      await addDoc(collection(db, 'participants'), {
        userId: currentUser.uid,
        tournamentId: tournament.id,
        points: 0,
        status,
        role: 'member',
        joinedAt: serverTimestamp(),
      });

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

  return {
    tournaments,
    loading,
    error,
    createTournament,
    updateTournament,
    deleteTournament,
    joinTournament,
    getTournament,
  };
}

export default useTournaments;
