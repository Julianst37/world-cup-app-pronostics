import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useMatches } from '../../hooks/useMatches';
import { usePredictions } from '../../hooks/usePredictions';

export default function TournamentHome() {
  const { tournament } = useOutletContext();
  const { currentUser, userProfile } = useAuth();
  const { matches } = useMatches({ status: 'scheduled' });
  const { predictions } = usePredictions(tournament?.id);

  const now = new Date();
  const nextMatch = matches.find((m) => new Date(m.date) >= now);
  const completedMatches = matches.filter((m) => m.status === 'finished').length;
  const totalPoints = predictions.reduce((sum, p) => sum + (p.points || 0), 0);

  const stats = [
    { label: 'Partidos jugados', value: completedMatches, icon: '⚽' },
    { label: 'Tus puntos', value: totalPoints, icon: '🏆' },
    { label: 'Tus pronósticos', value: predictions.length, icon: '📊' },
    { label: 'Participantes', value: tournament?.memberCount || 1, icon: '👥' },
  ];

  return (
    <div className="space-y-6">
      {/* Tournament Header */}
      <div className="bg-gradient-to-br from-blue-900 to-indigo-800 rounded-2xl p-8 text-white text-center">
        <div className="text-6xl mb-4">🌍⚽🌎</div>
        <h2 className="text-3xl font-bold mb-2">{tournament?.name}</h2>
        {tournament?.description && (
          <p className="text-blue-200 text-lg">{tournament.description}</p>
        )}
        <p className="text-blue-300 text-sm mt-3">FIFA World Cup 2026™</p>
      </div>

      {/* Welcome message */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-gray-700 text-lg">
          👋 Bienvenido, <span className="font-semibold">{userProfile?.displayName || currentUser?.email}</span>
        </p>
        <p className="text-gray-500 text-sm mt-1">
          Haz tus predicciones antes de cada partido para acumular puntos.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-3xl mb-2">{stat.icon}</div>
            <div className="text-2xl font-bold text-gray-800">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Next Match */}
      {nextMatch && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-3">⏰ Próximo partido</h3>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              {nextMatch.homeTeamFlag && (
                <img src={nextMatch.homeTeamFlag} alt="" className="w-8 h-6 mx-auto mb-1 rounded" />
              )}
              <span className="font-medium text-gray-800">{nextMatch.homeTeam}</span>
            </div>
            <div className="text-center px-4">
              <div className="text-2xl font-bold text-gray-400">VS</div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(nextMatch.date).toLocaleDateString('es-CO', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                {nextMatch.time}
              </div>
            </div>
            <div className="text-center flex-1">
              {nextMatch.awayTeamFlag && (
                <img src={nextMatch.awayTeamFlag} alt="" className="w-8 h-6 mx-auto mb-1 rounded" />
              )}
              <span className="font-medium text-gray-800">{nextMatch.awayTeam}</span>
            </div>
          </div>
          {nextMatch.stadium && (
            <p className="text-xs text-gray-500 text-center mt-3">📍 {nextMatch.stadium}</p>
          )}
        </div>
      )}

      {/* Invite code */}
      {tournament?.inviteCode && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
          <h3 className="font-semibold text-blue-800 mb-1">🔗 Invita a tus amigos</h3>
          <p className="text-sm text-blue-600 mb-2">Comparte este código para unirse al torneo:</p>
          <code className="text-blue-900 font-mono font-bold text-xl">{tournament.inviteCode}</code>
        </div>
      )}
    </div>
  );
}
