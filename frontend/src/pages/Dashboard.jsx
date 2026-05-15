import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTournaments } from '../hooks/useTournaments';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { Trophy, Users, Link2, ArrowRight, Trash2, AlertTriangle, LogOut } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const { tournaments, loading, joinTournament, fetchTournaments, deleteTournament, leaveTournament } = useTournaments();
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [tournamentToDelete, setTournamentToDelete] = useState(null);
  const [tournamentHasPredictions, setTournamentHasPredictions] = useState(false);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tournamentToLeave, setTournamentToLeave] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open join modal if ?join= param is present in URL
  useEffect(() => {
    const joinParam = searchParams.get('join');
    if (joinParam) {
      setJoinCode(joinParam.toUpperCase());
      setShowJoinModal(true);
      setSearchParams({}, { replace: true });
    }
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!joinCode.trim()) {
      toast.error('Código de invitación requerido');
      return;
    }

    if (joinCode.trim().length < 6) {
      toast.error('El código debe tener al menos 6 caracteres');
      return;
    }

    if (!/^[A-Z0-9]+$/.test(joinCode.trim())) {
      toast.error('El código debe contener solo letras mayúsculas y números.');
      return;
    }

    setJoining(true);
    try {
      const tournament = await joinTournament(joinCode.trim().toUpperCase());
      const message = tournament.requiresApproval
        ? `Solicitud enviada a "${tournament.name}". El administrador debe aprobarte.`
        : `¡Te uniste a "${tournament.name}"!`;
      toast.success(message);
      setShowJoinModal(false);
      setJoinCode('');
    } catch (err) {
      toast.error(err.message || 'Error al unirse a la polla');
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteClick = async (e, tournament) => {
    e.stopPropagation();
    setCheckingDelete(true);
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/predictions?tournamentId=${tournament.id}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const preds = res.ok ? await res.json() : [];
      setTournamentHasPredictions(preds.length > 0);
    } catch {
      setTournamentHasPredictions(false);
    } finally {
      setCheckingDelete(false);
    }
    setTournamentToDelete(tournament);
  };

  const handleConfirmDelete = async () => {
    if (!tournamentToDelete) return;
    setDeleting(true);
    try {
      await deleteTournament(tournamentToDelete.id);
      toast.success(`Polla "${tournamentToDelete.name}" eliminada`);
      setTournamentToDelete(null);
    } catch {
      toast.error('Error al eliminar la polla');
    } finally {
      setDeleting(false);
    }
  };

  const handleLeaveClick = (e, tournament) => {
    e.stopPropagation();
    setTournamentToLeave(tournament);
  };

  const handleConfirmLeave = async () => {
    if (!tournamentToLeave) return;
    setLeaving(true);
    try {
      await leaveTournament(tournamentToLeave.id);
      toast.success(`Saliste de la polla "${tournamentToLeave.name}"`);
      setTournamentToLeave(null);
    } catch (err) {
      if (err.code === 'has-predictions') {
        toast.error(err.message);
        setTournamentToLeave(null);
      } else {
        toast.error('Error al salir de la polla');
      }
    } finally {
      setLeaving(false);
    }
  };

  if (loading) return <Loading />;

  const isAdminOfAny = tournaments.some((t) => t.adminId === currentUser?.uid);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1 break-words min-w-0">
          ¡Hola, {userProfile?.displayName || currentUser?.email}!
        </h1>
        <p className="text-blue-200">
          Bienvenido a tu dashboard de pronósticos de BIA Sports 2026
        </p>
      </div>

      {/* Quick Stats removed */}

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          to="/tournaments/create"
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-center transition"
        >
          + Crear Polla
        </Link>
        <button
          onClick={() => setShowJoinModal(true)}
          className="flex-1 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
        >
          <Link2 className="w-4 h-4" /> Unirse con código
        </button>
      </div>

      {/* Tournaments List */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Mis Pollas ({tournaments.length})
        </h2>
        {tournaments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No tienes pollas aún</h3>
            <p className="text-gray-500 mb-6">Crea tu primera polla o únete usando un código de invitación</p>
            <Link
              to="/tournaments/create"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition"
            >
              Crear mi primera polla
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map((tournament) => (
              <div
                key={tournament.id}
                onClick={() => {
                  if (tournament.status === 'inactive') {
                    toast.error('Esta polla está desactivada y no se puede acceder');
                    return;
                  }
                  if (tournament.participantStatus === 'pending') {
                    toast('Tu solicitud está pendiente de aprobación', { icon: '⏳', id: 'pending-approval' });
                    return;
                  }
                  navigate(`/tournaments/${tournament.id}/home`);
                }}
                className={`bg-white rounded-xl border p-5 transition ${
                  tournament.status === 'inactive'
                    ? 'border-gray-200 opacity-70 cursor-not-allowed'
                    : tournament.participantStatus === 'pending'
                    ? 'border-yellow-200 opacity-80 cursor-not-allowed'
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
                          tournament.status === 'inactive' ? 'bg-red-500' : 'bg-green-500'
                        }`}
                      />
                      <h3 className="font-bold text-gray-800 text-lg">{tournament.name}</h3>
                    </div>
                    {tournament.description && (
                      <p className="text-gray-500 text-sm mt-1 line-clamp-1">{tournament.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {tournament.memberCount} participantes
                      </span>
                      {tournament.adminId === currentUser?.uid ? (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          Admin
                        </span>
                      ) : tournament.participantStatus === 'pending' ? (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                          Pendiente de aprobación
                        </span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Participante
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {tournament.adminId === currentUser?.uid && (
                      <button
                        onClick={(e) => handleDeleteClick(e, tournament)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                        title="Eliminar polla"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {tournament.adminId !== currentUser?.uid && tournament.status !== 'finished' && tournament.participantStatus !== 'pending' && (
                      <button
                        onClick={(e) => handleLeaveClick(e, tournament)}
                        className="p-2 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition"
                        title="Salir de la polla"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    )}
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!tournamentToDelete}
        onClose={() => !deleting && setTournamentToDelete(null)}
        title="Eliminar polla"
        size="sm"
      >
        {checkingDelete ? (
          <p className="text-gray-500 text-center py-4">Verificando...</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                {tournamentHasPredictions ? (
                  <>
                    <p className="font-semibold text-gray-800 mb-1">Esta polla tiene pronósticos guardados</p>
                    <p className="text-sm text-gray-600">
                      Al eliminar <span className="font-medium">"{tournamentToDelete?.name}"</span>, también se eliminarán
                      todos los pronósticos y participantes asociados. Esta acción no se puede deshacer.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-gray-800 mb-1">¿Confirmar eliminación?</p>
                    <p className="text-sm text-gray-600">
                      ¿Estás seguro de que deseas eliminar la polla <span className="font-medium">"{tournamentToDelete?.name}"</span>?
                      Esta acción no se puede deshacer.
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setTournamentToDelete(null)}
                disabled={deleting}
                className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Leave Confirmation Modal */}
      <Modal
        isOpen={!!tournamentToLeave}
        onClose={() => !leaving && setTournamentToLeave(null)}
        title="Salir de la polla"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-800 mb-1">¿Confirmar salida?</p>
              <p className="text-sm text-gray-600">
                ¿Estás seguro de que deseas salir de la polla{' '}
                <span className="font-medium">"{tournamentToLeave?.name}"</span>? Dejarás de ser
                participante y no podrás volver a ingresar a menos que uses el código de invitación.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setTournamentToLeave(null)}
              disabled={leaving}
              className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmLeave}
              disabled={leaving}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {leaving ? 'Saliendo...' : 'Sí, salir'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Join Modal */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        title="Unirse a una polla"
        size="sm"
      >
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código de invitación
            </label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center font-mono font-bold text-lg tracking-widest"
              placeholder="XXXXXXXX"
              maxLength={10}
              required
            />
          </div>
          <button
            type="submit"
            disabled={joining}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {joining ? 'Uniéndose...' : 'Unirse a la Polla'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
