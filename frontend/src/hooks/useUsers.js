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
    await updateDoc(docRef, { status, updatedAt: serverTimestamp() });
  }, []);

  const removeParticipant = useCallback(async (participantId) => {
    await deleteDoc(doc(db, 'participants', participantId));
  }, []);

  return { users, loading, error, updateParticipantStatus, removeParticipant };
}

export default useUsers;
