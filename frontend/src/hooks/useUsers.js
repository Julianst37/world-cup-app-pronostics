import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { loadParticipants, invalidateParticipantsCache } from './participantsCache';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export function useUsers(tournamentId) {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tournamentId || !currentUser) {
      setUsers([]);
      setLoading(false);
      return;
    }

    currentUser.getIdToken().then((idToken) =>
      loadParticipants(tournamentId, idToken)
    ).then((data) => {
      const sorted = [...data].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
      setUsers(sorted);
      setLoading(false);
    }).catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, [tournamentId, currentUser]);

  const updateParticipantStatus = useCallback(async (participantId, status) => {
    if (!currentUser) return;
    const idToken = await currentUser.getIdToken();
    const res = await fetch(`${API_BASE_URL}/api/participants/${participantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Error al actualizar el participante');
    }
    if (tournamentId) invalidateParticipantsCache(tournamentId);
  }, [currentUser, tournamentId]);

  const approveParticipant = useCallback(async (participantId, approve) => {
    if (!currentUser) return;
    const idToken = await currentUser.getIdToken();
    const res = await fetch(`${API_BASE_URL}/api/participants/${participantId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ approve }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Error al procesar la solicitud');
    }
    if (tournamentId) invalidateParticipantsCache(tournamentId);
  }, [currentUser, tournamentId]);

  const removeParticipant = useCallback(async (participantId) => {
    if (!currentUser) return;
    const idToken = await currentUser.getIdToken();
    const res = await fetch(`${API_BASE_URL}/api/participants/${participantId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Error al eliminar el participante');
    }
    if (tournamentId) invalidateParticipantsCache(tournamentId);
  }, [currentUser, tournamentId]);

  return { users, loading, error, updateParticipantStatus, approveParticipant, removeParticipant };
}

export default useUsers;
