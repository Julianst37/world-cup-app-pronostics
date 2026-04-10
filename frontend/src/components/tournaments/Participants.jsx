import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUsers } from '../../hooks/useUsers';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Loading from '../common/Loading';
import toast from 'react-hot-toast';

const STATUS_LABELS = {
  active: { label: 'Activo', color: 'bg-green-100 text-green-700' },
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  rejected: { label: 'Rechazado', color: 'bg-red-100 text-red-700' },
  inactive: { label: 'Inactivo', color: 'bg-gray-100 text-gray-600' },
};

export default function Participants() {
  const { tournament } = useOutletContext();
  const { currentUser } = useAuth();
  const { updateParticipantStatus, removeParticipant } = useUsers(tournament?.id);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = tournament?.adminId === currentUser?.uid;

  useEffect(() => {
    if (!tournament?.id) return;

    const q = query(
      collection(db, 'participants'),
      where('tournamentId', '==', tournament.id)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      const withProfiles = await Promise.all(
        data.map(async (p) => {
          const userDoc = await getDoc(doc(db, 'users', p.userId));
          return {
            ...p,
            user: userDoc.exists() ? userDoc.data() : { displayName: 'Usuario desconocido', email: '' },
          };
        })
      );

      setParticipants(withProfiles);
      setLoading(false);
    });

    return unsubscribe;
  }, [tournament?.id]);

  if (loading) return <Loading />;

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Participantes</h2>
        <div className="space-y-3">
          {participants.filter((p) => p.status === 'active').map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700">
                {p.user?.displayName?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">{p.user?.displayName}</p>
                <p className="text-xs text-gray-500">@{p.user?.username}</p>
              </div>
              <div className="ml-auto text-sm font-semibold text-blue-700">{p.points || 0} pts</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const handleStatusChange = async (participantId, newStatus) => {
    try {
      await updateParticipantStatus(participantId, newStatus);
      toast.success('Estado actualizado');
    } catch {
      toast.error('Error al actualizar estado');
    }
  };

  const handleRemove = async (participantId) => {
    if (!confirm('¿Eliminar a este participante?')) return;
    try {
      await removeParticipant(participantId);
      toast.success('Participante eliminado');
    } catch {
      toast.error('Error al eliminar participante');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Participantes ({participants.length})</h2>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {participants.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <span className="text-4xl block mb-2">👥</span>
            <p>No hay participantes aún</p>
          </div>
        ) : (
          participants.map((p) => {
            const statusInfo = STATUS_LABELS[p.status] || STATUS_LABELS.active;
            return (
              <div
                key={p.id}
                className="flex items-center gap-4 px-4 py-4 border-b border-gray-100 last:border-0"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700 flex-shrink-0">
                  {p.user?.displayName?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm">{p.user?.displayName}</p>
                  <p className="text-xs text-gray-500">{p.user?.email}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                <span className="text-sm font-bold text-blue-700 w-16 text-right">{p.points || 0} pts</span>

                {p.userId !== currentUser?.uid && (
                  <div className="flex gap-2">
                    {p.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(p.id, 'active')}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded transition"
                        >
                          ✓ Aprobar
                        </button>
                        <button
                          onClick={() => handleStatusChange(p.id, 'rejected')}
                          className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition"
                        >
                          ✗ Rechazar
                        </button>
                      </>
                    )}
                    {p.status === 'active' && (
                      <button
                        onClick={() => handleStatusChange(p.id, 'inactive')}
                        className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded transition"
                      >
                        Inhabilitar
                      </button>
                    )}
                    {p.status === 'inactive' && (
                      <button
                        onClick={() => handleStatusChange(p.id, 'active')}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition"
                      >
                        Habilitar
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(p.id)}
                      className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
