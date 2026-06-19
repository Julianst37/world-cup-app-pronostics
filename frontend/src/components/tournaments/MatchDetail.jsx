import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useFavorites } from '../../hooks/useFavorites';
import Loading from '../common/Loading';
import { useAuth } from '../../contexts/AuthContext';
import { formatColombiaTime, getRoundDisplayName } from '../../utils/helpers';
import { ArrowLeft, Lock, MapPin, Star } from 'lucide-react';
import { getCanonicalTeamDisplay } from '../../utils/worldCupTeams';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export default function MatchDetail() {
  const { matchId } = useParams();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const tournamentId = searchParams.get('tournamentId');
  const { toggleFavorite, isFavorite } = useFavorites(currentUser?.uid, tournamentId);
  const [match, setMatch] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const navigate = useNavigate();

  // Re-evalúa el bloqueo cada 30 segundos sin necesitar refrescar
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const isMatchLocked = useCallback((m, t) => {
    if (!m) return false;
    if (m.status === 'finished') return true;
    const lockMinutes = t?.predictionLockMinutes ?? 10;
    const rawTime = String(m.time || '00:00').slice(0, 5);
    const matchUTC = new Date(`${m.date}T${rawTime}:00-05:00`);
    const lockUTC = new Date(matchUTC.getTime() - lockMinutes * 60 * 1000);
    return new Date() >= lockUTC;
  }, []);

const handleGoBack = () => {
  navigate(-1);
  // Los filtros ya están guardados en localStorage, se restaurarán automáticamente
};

  useEffect(() => {
    if (!currentUser) return;

    // ✅ Limpiar estado anterior inmediatamente cuando cambia matchId
    setLoading(true);
    setMatch(null);
    setPredictions([]);
    setTournament(null);
    setParticipants([]);

    const load = async () => {
      const idToken = await currentUser.getIdToken();
      const headers = { Authorization: `Bearer ${idToken}` };

      const [matchRes, tournamentRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/matches?`, { headers }), // fallback: get all matches, find by id
        tournamentId ? fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}`, { headers }) : Promise.resolve(null),
      ]);

      if (matchRes.ok) {
        const allMatches = await matchRes.json();
        const found = allMatches.find((m) => m.id === matchId);
        if (found) setMatch(found);
      }

      if (tournamentRes?.ok) {
        const tData = await tournamentRes.json();
        setTournament(tData);
      } else {
        setTournament(null);
      }

      // Load active participants for the tournament
      if (tournamentId) {
        const participantsRes = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}/participants`, { headers });
        const allParticipants = participantsRes.ok ? await participantsRes.json() : [];
        const participantUsers = allParticipants
          .filter((p) => p.status === 'active')
          .map((p) => ({ userId: p.userId, userName: p.user?.displayName || p.displayName || p.userId }));
        setParticipants(participantUsers);
      }

      const params = new URLSearchParams({ matchId });
      if (tournamentId) params.set('tournamentId', tournamentId);
      // Get predictions for this match
      const predsRes = await fetch(`${API_BASE_URL}/api/predictions?${params}`, { headers }).catch(() => null);
      // Note: /api/predictions only returns current user's predictions
      // For MatchDetail we need all predictions for the match — use the tournament predictions endpoint
      let nextPredictions = [];
      if (tournamentId) {
        const allPredsRes = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}/predictions?matchId=${matchId}`, { headers });
        if (allPredsRes.ok) {
          const allPreds = await allPredsRes.json();
          // Admin endpoint returns all predictions without matchId filter; participant endpoint already filters by matchId
          nextPredictions = allPreds.filter((p) => String(p.matchId) === String(matchId));
        } else if (predsRes?.ok) {
          // Fallback to own predictions (match not finished yet)
          nextPredictions = await predsRes.json();
        }
      } else if (predsRes?.ok) {
        nextPredictions = await predsRes.json();
      }
      nextPredictions.sort((left, right) => {
        if ((right.points ?? -1) !== (left.points ?? -1)) {
          return (right.points ?? -1) - (left.points ?? -1);
        }
        return String(left.userName || '').localeCompare(String(right.userName || ''), 'es', { sensitivity: 'base' });
      });
      setPredictions(nextPredictions);
      setLoading(false);
    };
    load();
  }, [matchId, tournamentId, currentUser]);


  if (loading) return <Loading />;
  if (!match) return <div className="text-center py-10 text-gray-500">Partido no encontrado</div>;

  const matchIsFavorite = isFavorite(matchId);
  const homeTeam = getCanonicalTeamDisplay(match.homeTeam, match.homeTeamCode, match.homeTeamFlag);
  const awayTeam = getCanonicalTeamDisplay(match.awayTeam, match.awayTeamCode, match.awayTeamFlag);
  const locked = isMatchLocked(match, tournament) || tournament?.showPredictionsAlways === true;
  const myPrediction = predictions.find((p) => p.userId === currentUser?.uid);

  // When locked, show all participants (with or without prediction)
  const visiblePredictions = locked
    ? (() => {
        const predMap = new Map(predictions.map((p) => [p.userId, p]));
        const baseList = participants.length > 0
          ? participants.map((part) => predMap.get(part.userId) || { userId: part.userId, userName: part.userName, noPrediction: true })
          : predictions;
        return [...baseList].sort((a, b) => {
          if (a.noPrediction && !b.noPrediction) return 1;
          if (!a.noPrediction && b.noPrediction) return -1;
          if ((b.points ?? -1) !== (a.points ?? -1)) return (b.points ?? -1) - (a.points ?? -1);
          return String(a.userName || '').localeCompare(String(b.userName || ''), 'es', { sensitivity: 'base' });
        });
      })()
    : (myPrediction ? [myPrediction] : []);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={handleGoBack}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Pronósticos</span>
        </button>
        <button
          onClick={() => toggleFavorite(matchId)}
          className="p-2 hover:scale-110 transition"
          title={matchIsFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        >
          <Star
            className={`w-6 h-6 ${
              matchIsFavorite
                ? 'fill-yellow-500 text-yellow-500'
                : 'text-gray-300 hover:text-gray-500'
            }`}
          />
        </button>
      </div>
      <div className="bg-gradient-to-br from-blue-900 to-indigo-800 rounded-2xl p-8 text-white">
        <p className="text-blue-300 text-sm text-center mb-4">
          {getRoundDisplayName(match.round)}{match.group ? ` · Grupo ${match.group}` : ''}
        </p>

        <div className="flex items-center justify-between">
          <div className="text-center flex-1 min-w-0">
            {homeTeam.flag && (
              <img src={homeTeam.flag} alt="" className="w-16 h-12 mx-auto mb-2 rounded object-cover" />
            )}
            {/* Mostrar código en móvil, nombre en desktop */}
            <p className="font-bold text-2xl leading-tight px-1 sm:hidden">{homeTeam.code?.toUpperCase() || homeTeam.name}</p>
            <p className="font-bold text-base sm:text-xl leading-tight px-1 hidden sm:block">{homeTeam.name}</p>
          </div>

          <div className="text-center px-6">
            {match.status === 'finished' ? (
              <div className="text-5xl font-bold">
                {match.homeScore} - {match.awayScore}
              </div>
            ) : (
              <div>
                <div className="text-3xl font-bold">VS</div>
                <div className="text-blue-300 text-sm mt-1">
                  {formatColombiaTime(match.date, match.time)}
                </div>
              </div>
            )}
          </div>

          <div className="text-center flex-1 min-w-0">
            {awayTeam.flag && (
              <img src={awayTeam.flag} alt="" className="w-16 h-12 mx-auto mb-2 rounded object-cover" />
            )}
            {/* Mostrar código en móvil, nombre en desktop */}
            <p className="font-bold text-2xl leading-tight px-1 sm:hidden">{awayTeam.code?.toUpperCase() || awayTeam.name}</p>
            <p className="font-bold text-base sm:text-xl leading-tight px-1 hidden sm:block">{awayTeam.name}</p>
          </div>
        </div>

        {match.stadium && (
          <p className="text-blue-300 text-sm text-center mt-4"><MapPin className="w-3 h-3 inline mr-0.5" /> {match.stadium}</p>
        )}
      </div>

      {/* Predictions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">
            Pronósticos {locked ? `(${visiblePredictions.length})` : ''}
          </h3>
          {!locked && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
              <Lock className="w-3 h-3" />
              Visibles al bloquearse
            </span>
          )}
        </div>
        {!locked && (
          <p className="text-xs text-gray-400 mb-3">
            Los pronósticos de los demás participantes serán visibles una vez que el partido esté bloqueado.
          </p>
        )}
        {visiblePredictions.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {locked ? 'Nadie ha pronosticado este partido.' : 'No has hecho tu pronóstico aún.'}
          </p>
        ) : (
          <div className="space-y-2">
            {visiblePredictions.map((pred) => (
              <div
                key={pred.id || pred.userId}
                className="grid grid-cols-[minmax(0,1fr)_88px_72px] items-center gap-3 py-2 border-b border-gray-100 last:border-0"
              >
                <span className="min-w-0 text-sm text-gray-600 flex items-center gap-1.5 flex-wrap">
                  {pred.userName}
                  {pred.userId === currentUser?.uid && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Tú</span>
                  )}
                  {pred.noPrediction && (
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">Sin pronóstico</span>
                  )}
                </span>
                {pred.noPrediction ? (
                  <span className="text-center text-sm text-gray-300">—</span>
                ) : (
                  <span className="text-center font-semibold text-gray-800 tabular-nums">
                    {pred.prediction?.homeScore} - {pred.prediction?.awayScore}
                  </span>
                )}
                {pred.noPrediction ? (
                  <span className="text-right text-sm text-gray-300">—</span>
                ) : pred.points != null && pred.points > 0 ? (
                  <span className="text-right text-sm font-medium text-green-600 tabular-nums">{pred.points} pts</span>
                ) : (
                  <span className="text-right text-sm text-gray-400">-</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
