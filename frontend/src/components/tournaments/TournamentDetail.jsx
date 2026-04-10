import { useState, useEffect } from 'react';
import { useParams, NavLink, Outlet, Navigate } from 'react-router-dom';
import { useTournaments } from '../../hooks/useTournaments';
import { useAuth } from '../../contexts/AuthContext';
import Loading from '../common/Loading';
import Error from '../common/Error';

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

  const tabs = [
    { to: 'home', label: 'Home', icon: '🏠' },
    { to: 'predictions', label: 'Pronósticos', icon: '⚽' },
    { to: 'standings', label: 'Posiciones', icon: '🏆' },
    { to: 'participants', label: 'Participantes', icon: '👥' },
    ...(tournament?.adminId === currentUser?.uid
      ? [{ to: 'settings', label: 'Configuración', icon: '⚙️' }]
      : []),
  ];

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-800 to-indigo-700 p-6 text-white">
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
              <span>{tab.icon}</span>
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      <Outlet context={{ tournament, setTournament }} />
    </div>
  );
}
