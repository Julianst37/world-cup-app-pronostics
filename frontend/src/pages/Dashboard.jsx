import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTournaments } from '../hooks/useTournaments';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { Trophy, Users, Link2, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const { tournaments, loading, joinTournament, fetchTournaments } = useTournaments();
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      if (fetchTournaments) fetchTournaments();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchTournaments]);

  const handleJoin = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!joinCode.trim()) {
      toast.error('Código de invitación requerido');
      return;
    }

    if (joinCode.trim().length !== 8) {
      toast.error('El código debe tener 8 caracteres');
      return;
    }

    if (!/^[A-Z0-9]+$/.test(joinCode.trim())) {
      toast.error('El código debe contener solo letras mayúsculas y números');
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
      toast.error(err.message || 'Error al unirse al torneo');
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <Loading />;

  const isAdminOfAny = tournaments.some((t) => t.adminId === currentUser?.uid);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">
          ¡Hola, {userProfile?.displayName || currentUser?.email}!
        </h1>
        <p className="text-blue-200">
          Bienvenido a tu dashboard de pronósticos del Mundial 2026
        </p>
      </div>

      {/* Quick Stats */}
      {isAdminOfAny && (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <div className="text-3xl font-bold text-blue-700">{tournaments.length}</div>
          <div className="text-sm text-gray-500 mt-1">Torneos activos</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <div className="text-3xl font-bold text-green-600">
            {tournaments.reduce((sum, t) => sum + (t.memberCount || 0), 0)}
          </div>
          <div className="text-sm text-gray-500 mt-1">Total participantes</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center col-span-2 md:col-span-1">
          <div className="text-3xl font-bold text-orange-500">104</div>
          <div className="text-sm text-gray-500 mt-1">Partidos totales</div>
        </div>
      </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          to="/tournaments/create"
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-center transition"
        >
          + Crear Torneo
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
        <h2 className="text-xl font-bold text-gray-800 mb-4">Mis Torneos</h2>
        {tournaments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No tienes torneos aún</h3>
            <p className="text-gray-500 mb-6">Crea tu primer torneo o únete usando un código de invitación</p>
            <Link
              to="/tournaments/create"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition"
            >
              Crear mi primer torneo
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map((tournament) => (
              <div
                key={tournament.id}
                onClick={() => navigate(`/tournaments/${tournament.id}/home`)}
                className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md p-5 cursor-pointer transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{tournament.name}</h3>
                    {tournament.description && (
                      <p className="text-gray-500 text-sm mt-1 line-clamp-1">{tournament.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {tournament.memberCount} participantes
                      </span>
                      {tournament.adminId === currentUser?.uid && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          Admin
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Join Modal */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        title="Unirse a un torneo"
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
            {joining ? 'Uniéndose...' : 'Unirse al Torneo'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
