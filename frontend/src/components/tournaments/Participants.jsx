import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUsers } from '../../hooks/useUsers';
import { collection, query, where, onSnapshot, getDoc, doc, getDocs, getDocsFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Loading from '../common/Loading';
import Modal from '../common/Modal';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import TeamAvatar from '../common/TeamAvatar';

const STATUS_CONFIG = {
  active: { label: 'Activo', color: 'bg-green-100 text-green-700' },
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  rejected: { label: 'Rechazado', color: 'bg-red-100 text-red-700' },
  inactive: { label: 'Inactivo', color: 'bg-gray-100 text-gray-600' },
};

const ITEMS_PER_PAGE = 10;

const getFallbackUser = () => ({ displayName: 'Usuario desconocido', email: '', username: '' });

async function buildParticipantsEntries(data) {
  const withProfiles = await Promise.all(
    data.map(async (participant) => {
      const userDoc = await getDoc(doc(db, 'users', participant.userId));

      return {
        ...participant,
        user: userDoc.exists() ? userDoc.data() : getFallbackUser(),
      };
    })
  );

  withProfiles.sort((a, b) => {
    return (a.user?.displayName || '').localeCompare(b.user?.displayName || '');
  });

  return withProfiles;
}

export default function Participants() {
  const { tournament } = useOutletContext();
  const { currentUser } = useAuth();
  const { updateParticipantStatus, removeParticipant } = useUsers(tournament?.id);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }
  const [deleting, setDeleting] = useState(false);

  const isAdmin = tournament?.adminId === currentUser?.uid;

  useEffect(() => {
    if (!tournament?.id) return;

    let isMounted = true;
    let hasProcessedServerSnapshot = false;
    setLoading(true);
    setParticipants([]);

    const q = query(
      collection(db, 'participants'),
      where('tournamentId', '==', tournament.id)
    );

    const hydrateParticipants = async (data) => {
      const withProfiles = await buildParticipantsEntries(data);

      if (!isMounted) {
        return;
      }

      setParticipants(withProfiles);
      setLoading(false);
    };

    let unsubscribe = () => {};

    const initializeParticipants = async () => {
      try {
        let initialSnapshot;

        try {
          initialSnapshot = await getDocsFromServer(q);
          hasProcessedServerSnapshot = true;
        } catch (_) {
          initialSnapshot = await getDocs(q);
        }

        if (!isMounted) {
          return;
        }

        await hydrateParticipants(initialSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));

        unsubscribe = onSnapshot(q, async (snapshot) => {
          if (hasProcessedServerSnapshot && snapshot.metadata.fromCache) {
            return;
          }

          hasProcessedServerSnapshot = true;
          await hydrateParticipants(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
      } catch (_) {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeParticipants();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [tournament?.id]);

  if (loading) return <Loading />;

  const filteredParticipants = statusFilter === 'all'
    ? participants
    : participants.filter((participant) => participant.status === statusFilter);

  // Paginación
  const totalPages = Math.ceil(filteredParticipants.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedParticipants = filteredParticipants.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Participantes</h2>
        <div className="space-y-3">
          {participants.filter((p) => p.status === 'active').map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <TeamAvatar teamCode={p.user?.favoriteTeam} name={p.user?.displayName} size={36} />
              <div>
                <p className="font-medium text-gray-800 text-sm flex items-center gap-1.5">
                  {p.user?.displayName}
                  {p.userId === currentUser?.uid && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Tú</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">@{p.user?.username}</p>
              </div>
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

  const handleFilterChange = (event) => {
    setStatusFilter(event.target.value);
    setCurrentPage(1);
  };

  const handleRemove = async (participantId) => {
    if (deleting) return;
    setDeleting(true);
    try {
      await removeParticipant(participantId);
      toast.success('Participante eliminado');
      setConfirmDelete(null);
    } catch {
      toast.error('Error al eliminar participante');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Participantes ({filteredParticipants.length})</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="participants-status-filter" className="text-sm font-medium text-gray-600">
            Filtrar por estado
          </label>
          <select
            id="participants-status-filter"
            value={statusFilter}
            onChange={handleFilterChange}
            className="text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="pending">Pendientes</option>
            <option value="rejected">Rechazados</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Usuario</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Estado</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedParticipants.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <TeamAvatar teamCode={p.user?.favoriteTeam} name={p.user?.displayName} size={32} />
                      <div>
                        <p className="font-medium text-gray-800 flex items-center gap-1.5">
                          {p.user?.displayName}
                          {p.userId === currentUser?.uid && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Tú</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">@{p.user?.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.user?.email}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_CONFIG[p.status]?.color}`}>
                      {STATUS_CONFIG[p.status]?.label || p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="grid grid-cols-[minmax(0,1fr)_32px] items-center justify-center gap-2 max-w-[220px] mx-auto">
                      <select
                        value={p.status}
                        onChange={(e) => handleStatusChange(p.id, e.target.value)}
                        className="w-full text-xs px-2 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 cursor-pointer transition"
                      >
                        <option value="active">Activo</option>
                        <option value="pending">Pendiente</option>
                        <option value="rejected">Rechazado</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                      {p.userId !== currentUser?.uid && (
                        <button
                          onClick={() => setConfirmDelete({ id: p.id, name: p.user?.displayName })}
                          title="Eliminar participante"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {p.userId === currentUser?.uid && <div className="w-8 h-8" aria-hidden="true" />}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedParticipants.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                    No hay participantes con ese estado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-white disabled:opacity-50 transition"
            >
              ← Anterior
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 hover:bg-white'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-white disabled:opacity-50 transition"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Eliminar participante"
        size="sm"
      >
        <div className="py-2">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-red-500" />
          </div>
          <p className="text-gray-700 mb-1">¿Estás seguro de que deseas eliminar a</p>
          <p className="font-semibold text-gray-900 text-lg mb-4">{confirmDelete?.name}?</p>
          <p className="text-sm text-gray-500 mb-6">Esta acción no se puede deshacer.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmDelete(null)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleRemove(confirmDelete.id)}
              disabled={deleting}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium disabled:opacity-50"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}