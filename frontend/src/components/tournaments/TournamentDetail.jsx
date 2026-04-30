import { useState, useEffect } from 'react';
import { useParams, NavLink, Outlet, Navigate, Link } from 'react-router-dom';
import { useTournaments } from '../../hooks/useTournaments';
import { useAuth } from '../../contexts/AuthContext';
import Loading from '../common/Loading';
import Error from '../common/Error';
import { Home, ClipboardList, Trophy, Users, Settings, Lock } from 'lucide-react';

export default function TournamentDetail() {
  const { tournamentId } = useParams();
  const { getTournament } = useTournaments();
  const { currentUser } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getTournament(tournamentId);
        if (!data) throw new Error('Torneo no encontrado');
        setTournament(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tournamentId, getTournament]);

  if (loading) return <Loading />;
  if (error) return <Error message={error} />;

  if (tournament?.status === 'inactive') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center px-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-10 shadow-sm">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Torneo desactivado</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            El torneo <span className="font-semibold text-gray-700 dark:text-gray-200">"{tournament.name}"</span> ha sido desactivado por el administrador de la plataforma. No es posible acceder hasta que sea reactivado.
          </p>
          <Link
            to="/dashboard"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg transition text-sm"
          >
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { to: 'home', label: 'Inicio', Icon: Home },
    { to: 'predictions', label: 'Pronósticos', Icon: ClipboardList },
    { to: 'standings', label: 'Posiciones', Icon: Trophy },
    { to: 'participants', label: 'Participantes', Icon: Users },
    ...(tournament?.adminId === currentUser?.uid
      ? [{ to: 'settings', label: 'Configuración', Icon: Settings }]
      : []),
  ];

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-800 to-indigo-700 p-6 text-white text-center">
          <h1 className="text-2xl font-bold">{tournament?.name}</h1>
          {tournament?.description && (
            <p className="text-blue-200 mt-1 text-sm">{tournament.description}</p>
          )}
        </div>

        <div className="flex overflow-x-auto border-b border-gray-200">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`
              }
            >
              <tab.Icon className="w-4 h-4" />
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      <Outlet context={{ tournament, setTournament }} />
    </div>
  );
}
