import { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useMatches } from '../../hooks/useMatches';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import { usePredictions } from '../../hooks/usePredictions';
import { useFavorites } from '../../hooks/useFavorites';
import Loading from '../common/Loading';
import Modal from '../common/Modal';
import { calculateTournamentPredictionPoints, formatColombiaTime, getRoundDisplayName, isRoundGloballyEnabled, normalizeRoundName } from '../../utils/helpers';
import { getCanonicalTeamDisplay } from '../../utils/worldCupTeams';
import toast from 'react-hot-toast';
import { BookOpen, MapPin, Save, Star, X, RotateCcw } from 'lucide-react';
import { FaFutbol } from 'react-icons/fa';

const ITEMS_PER_PAGE = 10;

// Leer filtros guardados desde localStorage (para inicialización lazy)
const getInitialFilters = () => {
  try {
    const saved = localStorage.getItem('predictionFilters');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        round: parsed.round || 'all',
        group: parsed.group || 'all',
        date: parsed.date || 'all',
        predictionStatus: parsed.predictionStatus || 'all',
        showFavorites: parsed.showFavorites || false,
        page: parsed.page || 1,
      };
    }
  } catch (_) {}
  return { round: 'all', group: 'all', date: 'all', predictionStatus: 'all', showFavorites: false, page: 1 };
};

// Función para obtener últimos 3 resultados del equipo
const getTeamResults = (matches, teamData) => {
  if (!teamData?.name && !teamData?.code) {
    return [];
  }

  const teamMatches = matches
    .filter(
      (match) => {
        const homeTeam = getCanonicalTeamDisplay(match.homeTeam, match.homeTeamCode, match.homeTeamFlag);
        const awayTeam = getCanonicalTeamDisplay(match.awayTeam, match.awayTeamCode, match.awayTeamFlag);
        const isSameTeam = teamData.code
          ? homeTeam.code === teamData.code || awayTeam.code === teamData.code
          : homeTeam.name === teamData.name || awayTeam.name === teamData.name;

        return isSameTeam && match.status === 'finished' && match.homeScore !== null && match.awayScore !== null;
      }
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  return teamMatches.map((match) => {
    const homeTeam = getCanonicalTeamDisplay(match.homeTeam, match.homeTeamCode, match.homeTeamFlag);
    const isHome = teamData.code ? homeTeam.code === teamData.code : homeTeam.name === teamData.name;
    const teamScore = isHome ? match.homeScore : match.awayScore;
    const opponentScore = isHome ? match.awayScore : match.homeScore;

    if (teamScore > opponentScore) return 'W';
    if (teamScore < opponentScore) return 'L';
    return 'D';
  });
};

// Componente para mostrar resultado
const ResultBadge = ({ result }) => {
  if (!result) return <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-bold">-</span>;

  const config = {
    W: { bg: 'bg-green-200', text: 'text-green-700' },
    L: { bg: 'bg-red-200', text: 'text-red-700' },
    D: { bg: 'bg-yellow-200', text: 'text-yellow-700' },
  };

  const { bg, text } = config[result] || config.D;
  return <span className={`${bg} ${text} px-2 py-1 rounded text-xs font-bold`}>{result}</span>;
};

export default function PredictionsList() {
  const { tournament } = useOutletContext();
  const { matches, loading } = useMatches();
  const { settings: platformSettings, loading: platformSettingsLoading } = usePlatformSettings();
  const { predictions, savePrediction, getPredictionForMatch, clearPrediction, clearAllPredictions } = usePredictions(tournament?.id);
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const [filterRound, setFilterRound] = useState(() => getInitialFilters().round);
  const [filterGroup, setFilterGroup] = useState(() => getInitialFilters().group);
  const [filterDate, setFilterDate] = useState(() => getInitialFilters().date);
  const [filterPredictionStatus, setFilterPredictionStatus] = useState(() => getInitialFilters().predictionStatus);
  const [filterFavorites, setFilterFavorites] = useState(() => getInitialFilters().showFavorites || false);
  const [currentPage, setCurrentPage] = useState(() => getInitialFilters().page);
  const [currentPredictions, setCurrentPredictions] = useState({});
  const [savingAll, setSavingAll] = useState(false);
  const [clearingId, setClearingId] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [, setTick] = useState(0);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const navigate = useNavigate();

  // Re-evalúa el estado de bloqueo cada 30 segundos sin necesitar refrescar la página
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const predictionsMap = useMemo(() => {
    return new Map(predictions.map((prediction) => [String(prediction.matchId), prediction]));
  }, [predictions]);

  const favoriteMatchIds = useMemo(() => {
    return new Set(favorites.map((favoriteId) => String(favoriteId)));
  }, [favorites]);

  const isPredictionLocked = (match) => {
    if (!match) return false;
    if (match.status === 'finished') return true;

    const lockMinutes = tournament?.predictionLockMinutes || 10;
    // Interpretar la hora del partido como hora Colombia (UTC-5) con offset explícito
    const rawTime = String(match.time || '00:00').slice(0, 5);
    const matchDate = new Date(`${match.date}T${rawTime}:00-05:00`);
    const lockDate = new Date(matchDate.getTime() - lockMinutes * 60 * 1000);

    return new Date() >= lockDate;
  };

  const globallyAvailableMatches = useMemo(() => {
    const playoffRounds = platformSettings?.playoffRounds || {};

    return matches.filter((match) => isRoundGloballyEnabled(match.round, playoffRounds));
  }, [matches, platformSettings?.playoffRounds]);

  // Filtrar matches
  const filteredMatches = useMemo(() => {
    let result = globallyAvailableMatches;

    if (filterRound !== 'all') {
      result = result.filter((match) => normalizeRoundName(match.round) === filterRound);
    }

    if (filterGroup !== 'all') {
      result = result.filter((m) => m.group === filterGroup);
    }

    if (filterDate !== 'all') {
      const matchDate = new Date(filterDate).toDateString();
      result = result.filter((m) => new Date(m.date).toDateString() === matchDate);
    }

    if (filterPredictionStatus !== 'all') {
      result = result.filter((match) => {
        const hasPrediction = predictionsMap.has(String(match.id || match.matchId));
        return filterPredictionStatus === 'with'
          ? hasPrediction
          : !hasPrediction;
      });
    }

    // Filter by favorites
    if (filterFavorites) {
      result = result.filter((m) => {
        const matchId = m.id || m.matchId;
        return favoriteMatchIds.has(String(matchId));
      });
    }

    result.sort((a, b) => {
      const dateTimeA = `${a.date}T${a.time || '00:00'}`;
      const dateTimeB = `${b.date}T${b.time || '00:00'}`;
      return new Date(dateTimeA) - new Date(dateTimeB);
    });

    return result;
  }, [globallyAvailableMatches, filterRound, filterGroup, filterDate, filterPredictionStatus, filterFavorites, predictionsMap, favoriteMatchIds]);

// ✅ Guardar filtros cuando cambien
useEffect(() => {
  const filters = {
    round: filterRound,
    group: filterGroup,
    date: filterDate,
    predictionStatus: filterPredictionStatus,
    showFavorites: filterFavorites,
    page: currentPage,
  };
  localStorage.setItem('predictionFilters', JSON.stringify(filters));
}, [filterRound, filterGroup, filterDate, filterPredictionStatus, filterFavorites, currentPage]);

  // Paginación
  const totalPages = Math.ceil(filteredMatches.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedMatches = useMemo(
    () => filteredMatches.slice(startIdx, startIdx + ITEMS_PER_PAGE),
    [filteredMatches, startIdx]
  );

      // Inicializar predicciones actuales
useEffect(() => {
  const initial = {};
  paginatedMatches.forEach((match) => {
    const matchId = String(match.id || match.matchId);
    const existing = predictionsMap.get(matchId);
    
    initial[matchId] = {
      home: existing?.prediction?.homeScore ?? '',
      away: existing?.prediction?.awayScore ?? '',
    };
  });
  
  setCurrentPredictions(prev => {
    const newState = { ...prev, ...initial };
    return newState;
  });
}, [paginatedMatches, predictionsMap]);
  // Obtener valores únicos para filtros
  const rounds = useMemo(() => {
    const allRounds = ['all', ...new Set(globallyAvailableMatches.map((match) => normalizeRoundName(match.round)).filter(Boolean))];

    return allRounds;
  }, [globallyAvailableMatches]);

  useEffect(() => {
    if (filterRound !== 'all' && !rounds.includes(filterRound)) {
      setFilterRound('all');
      setCurrentPage(1);
    }
  }, [filterRound, rounds]);

    const groups = useMemo(() => {
    const allGroups = ['all', ...new Set(globallyAvailableMatches.map((m) => m.group).filter(Boolean))];
    
    // ✅ Ordenar grupos alfabéticamente
    return allGroups.sort((a, b) => {
      if (a === 'all') return -1;
      if (b === 'all') return 1;
      return a.localeCompare(b);
    });
  }, [globallyAvailableMatches]);
  const dates = ['all', ...new Set(globallyAvailableMatches.map((m) => new Date(m.date).toISOString().split('T')[0]))];

  const handleFilterChange = (setter, value) => {
    setter(value);
    setCurrentPage(1);
  };

  // Manejar cambio de input
  const handlePredictionChange = (matchId, team, value) => {
    const sanitizedValue = value.replace(/\D/g, '').slice(0, 2);
    const matchIdStr = String(matchId);
    setCurrentPredictions((prev) => ({
      ...prev,
      [matchIdStr]: {
        ...prev[matchIdStr],
        [team]: sanitizedValue,
      },
    }));
  };

  const handleClearPrediction = async (matchId) => {
    setClearingId(String(matchId));
    try {
      await clearPrediction(matchId);
      setCurrentPredictions((prev) => ({
        ...prev,
        [String(matchId)]: { home: '', away: '' },
      }));
      toast.success('Pronóstico eliminado');
    } catch {
      toast.error('Error al limpiar el pronóstico');
    } finally {
      setClearingId(null);
    }
  };

  const handleClearAll = async () => {
    const unlockedWithPrediction = filteredMatches.filter((match) => {
      const matchId = String(match.id || match.matchId);
      return !isPredictionLocked(match) && predictionsMap.has(matchId);
    });

    if (unlockedWithPrediction.length === 0) {
      toast.error('No hay pronósticos desbloqueados para limpiar');
      return;
    }

    setClearingAll(true);
    try {
      const ids = unlockedWithPrediction.map((m) => String(m.id || m.matchId));
      await clearAllPredictions(ids);
      setCurrentPredictions((prev) => {
        const next = { ...prev };
        ids.forEach((id) => { next[id] = { home: '', away: '' }; });
        return next;
      });
      toast.success(`${ids.length} pronóstico(s) eliminado(s)`);
    } catch {
      toast.error('Error al limpiar los pronósticos');
    } finally {
      setClearingAll(false);
    }
  };

  // Guardar todos los cambios (solo los modificados y con resultados)
 const handleSaveAll = async () => {
  const toSave = [];

  for (const [matchId, pred] of Object.entries(currentPredictions)) {
    if (pred.home === '' || pred.away === '') continue;

    const match = filteredMatches.find((item) => String(item.id || item.matchId) === String(matchId));
    if (!match || isPredictionLocked(match)) continue;

    const existing = predictionsMap.get(String(matchId));
    const wasModified =
      existing?.prediction?.homeScore !== parseInt(pred.home) ||
      existing?.prediction?.awayScore !== parseInt(pred.away);

    if (wasModified) {
      toSave.push([matchId, pred]);
    }
  }

  if (toSave.length === 0) {
    toast.error('No hay cambios válidos para guardar');
    return;
  }

  setSavingAll(true);
  try {
    await Promise.all(
      toSave.map(([matchId, pred]) =>
        savePrediction(matchId, parseInt(pred.home), parseInt(pred.away))
      )
    );
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    toast.success(`${toSave.length} pronóstico(s) guardado(s)`);
  } catch (error) {
    if (error.message === 'No eres un participante activo en este torneo') {
      toast.error('No eres un participante activo en este torneo', { duration: 4000 });
      setTimeout(() => navigate('/dashboard'), 1500);
    } else if (error.message?.includes('plazo para pronosticar') || error.message?.includes('bloqueado')) {
      toast.error('Uno o más pronósticos ya están bloqueados');
    } else if (error.message === 'Los pronósticos deben tener máximo dos dígitos') {
      toast.error('Cada resultado debe tener máximo dos dígitos');
    } else {
      toast.error('Error al guardar pronósticos');
    }
  } finally {
    setSavingAll(false);
  }
};

const hasChanges = useMemo(() => {
  for (const [matchId, pred] of Object.entries(currentPredictions)) {
    if (pred.home === '' || pred.away === '') continue;
    
    const existing = predictions.find((p) => String(p.matchId) === String(matchId));
    const wasModified =
      existing?.prediction?.homeScore !== parseInt(pred.home) ||
      existing?.prediction?.awayScore !== parseInt(pred.away);
    
    if (wasModified) return true;
  }
  return false;
}, [currentPredictions, predictionsMap]);

  if (loading || platformSettingsLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Pronósticos</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{predictions.length} guardados</span>
          <button
            onClick={handleClearAll}
            disabled={clearingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
            title="Limpiar todos los pronósticos desbloqueados"
          >
            <RotateCcw className="w-4 h-4" />
            {clearingAll ? 'Limpiando...' : 'Limpiar todos'}
          </button>
          <button
            onClick={() => setShowRulesModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
          >
            <BookOpen className="w-4 h-4" />
            Ver Reglas
          </button>
        </div>
      </div>

      <Modal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        title="Reglas del torneo"
        size="lg"
      >
        {(() => {
          const pointConfig = tournament?.pointConfig || { exact: 3, difference: 2, winner: 1 };
          const multiplier = tournament?.secondRoundMultiplier ?? 2;
          const lockMinutes = tournament?.predictionLockMinutes || 10;
          const exactTotal = pointConfig.winner + pointConfig.difference + pointConfig.exact * 2;
          const differenceTotal = pointConfig.winner + pointConfig.difference;
          return (
            <div className="space-y-5 text-left">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Puntos por pronóstico (Fase de grupos)</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-2xl font-bold text-blue-600">{pointConfig.winner}</p>
                    <p className="text-xs text-gray-500 mt-1">Ganador o empate</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-2xl font-bold text-blue-600">{pointConfig.difference}</p>
                    <p className="text-xs text-gray-500 mt-1">Diferencia de goles</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-2xl font-bold text-blue-600">{pointConfig.exact}</p>
                    <p className="text-xs text-gray-500 mt-1">Goles por equipo</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Ejemplos de puntuación (resultado real: 2 - 1)</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center bg-white rounded-md border border-gray-200 px-3 py-2">
                    <span className="font-medium text-gray-700">Pronóstico 2-1 <span className="text-xs text-gray-400">(exacto)</span></span>
                    <span className="text-blue-700 font-semibold">{exactTotal} pts</span>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-md border border-gray-200 px-3 py-2">
                    <span className="font-medium text-gray-700">Pronóstico 1-0 <span className="text-xs text-gray-400">(dif. correcta)</span></span>
                    <span className="text-blue-700 font-semibold">{differenceTotal} pts</span>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-md border border-gray-200 px-3 py-2">
                    <span className="font-medium text-gray-700">Pronóstico 3-1 <span className="text-xs text-gray-400">(ganador + visitante exacto)</span></span>
                    <span className="text-blue-700 font-semibold">{pointConfig.winner + pointConfig.exact} pts</span>
                  </div>
                  <div className="flex justify-between items-center bg-white rounded-md border border-gray-200 px-3 py-2">
                    <span className="font-medium text-gray-700">Pronóstico 4-2 <span className="text-xs text-gray-400">(solo ganador correcto)</span></span>
                    <span className="text-blue-700 font-semibold">{pointConfig.winner} pts</span>
                  </div>
                </div>
              </div>

              {multiplier > 1 && (() => {
                  const exactTotal = pointConfig.winner + pointConfig.difference + pointConfig.exact * 2;
                  const differenceTotal = pointConfig.winner + pointConfig.difference;
                  return (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">Segunda ronda (x{multiplier})</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          A partir de la Ronda de 32, 16avos, Cuartos, Semis, 3er puesto y Final, los puntos se multiplican por{' '}
                          <span className="font-bold text-amber-700">x{multiplier}</span>.{' '}
                          El pronóstico se evalúa sobre el resultado al final de los <span className="font-semibold">90 minutos reglamentarios</span>, sin contar tiempo extra ni penales.
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Ejemplos con resultado 2‑1 (x{multiplier}):</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center bg-white dark:bg-slate-700 rounded-md px-3 py-2">
                          <span className="font-medium text-gray-700 dark:text-gray-100">Pronóstico 2-1 <span className="text-xs text-gray-400 dark:text-gray-400">(exacto)</span></span>
                          <span className="text-amber-700 dark:text-amber-400 font-semibold">{exactTotal} × {multiplier} = {exactTotal * multiplier} pts</span>
                        </div>
                        <div className="flex justify-between items-center bg-white dark:bg-slate-700 rounded-md px-3 py-2">
                          <span className="font-medium text-gray-700 dark:text-gray-100">Pronóstico 1-0 <span className="text-xs text-gray-400 dark:text-gray-400">(dif. correcta)</span></span>
                          <span className="text-amber-700 dark:text-amber-400 font-semibold">{differenceTotal} × {multiplier} = {differenceTotal * multiplier} pts</span>
                        </div>
                        <div className="flex justify-between items-center bg-white dark:bg-slate-700 rounded-md px-3 py-2">
                          <span className="font-medium text-gray-700 dark:text-gray-100">Pronóstico 3-1 <span className="text-xs text-gray-400 dark:text-gray-400">(ganador + visitante exacto)</span></span>
                          <span className="text-amber-700 dark:text-amber-400 font-semibold">{pointConfig.winner + pointConfig.exact} × {multiplier} = {(pointConfig.winner + pointConfig.exact) * multiplier} pts</span>
                        </div>
                        <div className="flex justify-between items-center bg-white dark:bg-slate-700 rounded-md px-3 py-2">
                          <span className="font-medium text-gray-700 dark:text-gray-100">Pronóstico 4-2 <span className="text-xs text-gray-400 dark:text-gray-400">(solo ganador)</span></span>
                          <span className="text-amber-700 dark:text-amber-400 font-semibold">{pointConfig.winner} × {multiplier} = {pointConfig.winner * multiplier} pts</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Cierre de pronósticos</p>
                <p className="text-sm text-gray-700">Los pronósticos se bloquean <span className="font-semibold">{lockMinutes} minutos</span> antes del inicio de cada partido.</p>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Filtros</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-600 font-medium mb-1 block">Ronda</label>
            <select
              value={filterRound}
              onChange={(e) => handleFilterChange(setFilterRound, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {rounds.map((round) => (
                <option key={round} value={round}>
                  {round === 'all' ? 'Todas las rondas' : getRoundDisplayName(round)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600 font-medium mb-1 block">Grupo</label>
            <select
              value={filterGroup}
              onChange={(e) => handleFilterChange(setFilterGroup, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {groups.map((group) => (
                <option key={group} value={group}>
                  {group === 'all' ? 'Todos los grupos' : `Grupo ${group}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600 font-medium mb-1 block">Estado del pronóstico</label>
            <select
              value={filterPredictionStatus}
              onChange={(e) => handleFilterChange(setFilterPredictionStatus, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">Todos</option>
              <option value="with">Con pronóstico</option>
              <option value="without">Sin pronóstico</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600 font-medium mb-1 block">Fecha</label>
            <select
              value={filterDate}
              onChange={(e) => handleFilterChange(setFilterDate, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {dates.map((date) => (
                <option key={date} value={date}>
                  {date === 'all'
                    ? 'Todas las fechas'
                    : new Date(date).toLocaleDateString('es-CO', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
          <button
            onClick={() => handleFilterChange(setFilterFavorites, !filterFavorites)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              filterFavorites
                ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-400'
                : 'bg-gray-100 text-gray-600 border-2 border-gray-300 hover:border-yellow-400'
            }`}
          >
            <Star
              className={`w-4 h-4 ${
                filterFavorites ? 'fill-yellow-500 text-yellow-600' : 'text-gray-500'
              }`}
            />
            {filterFavorites ? 'Solo favoritos' : 'Mostrar favoritos'}
          </button>
        </div>
      </div>

      {/* Matches list */}
      <div className="space-y-3">
        {filteredMatches.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FaFutbol className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No hay partidos</h3>
            <p className="text-gray-500">Selecciona otros filtros</p>
          </div>
        ) : (
          <>
            {paginatedMatches.map((match) => {
              const matchId = match.id || match.matchId;
              const isLocked = isPredictionLocked(match);
              const pred = currentPredictions[matchId];
              const savedPrediction = predictionsMap.get(String(matchId));
              const homeTeam = getCanonicalTeamDisplay(match.homeTeam, match.homeTeamCode, match.homeTeamFlag);
              const awayTeam = getCanonicalTeamDisplay(match.awayTeam, match.awayTeamCode, match.awayTeamFlag);
              const homeResults = getTeamResults(matches, homeTeam);
              const awayResults = getTeamResults(matches, awayTeam);

              return (
                <div
                  key={matchId}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-y-1.5 mb-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full shrink-0">
                      {getRoundDisplayName(match.round)}{match.group ? ` · Grupo ${match.group}` : ''}
                    </span>
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatColombiaTime(match.date, match.time)}
                      </span>
                      {isLocked && match.status !== 'finished' && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                          Bloqueado
                        </span>
                      )}
                      <button
                        onClick={() => toggleFavorite(matchId)}
                        className="p-1 hover:scale-110 transition"
                        title={favoriteMatchIds.has(String(matchId)) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                      >
                        <Star
                          className={`w-4 h-4 ${
                            favoriteMatchIds.has(String(matchId))
                              ? 'fill-yellow-500 text-yellow-500'
                              : 'text-gray-300 hover:text-gray-500'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* LAYOUT CON INPUTS INLINE Y RESULTADOS */}
                  <div className="flex items-center justify-between mb-4">
                    {/* EQUIPO HOME */}
                    <div className="flex flex-col items-center flex-1 min-w-0">
                     <div className="flex flex-col items-center gap-1 mb-2">
                      {homeTeam.flag && homeTeam.name ? (
                        <img src={homeTeam.flag} alt="" className="w-8 h-6 rounded object-cover" />
                      ) : (
                        <div className="w-8 h-6 bg-gray-300 rounded flex items-center justify-center text-xs">
                          ?
                        </div>
                      )}
                      <span className="font-semibold text-gray-800 text-xs text-center leading-tight line-clamp-2 px-1">
                        {homeTeam.name || 'Por definir'}
                      </span>
                    </div>
                      {/* ✅ Últimos 3 resultados */}
                      <div className="flex gap-1">
                        {homeResults.length > 0 ? (
                          homeResults.map((result, idx) => (
                            <ResultBadge key={idx} result={result} />
                          ))
                        ) : (
                          <ResultBadge result={null} />
                        )}
                      </div>
                    </div>

                    {/* INPUTS Y VS */}
                    <div className="flex flex-col items-center gap-2 px-3 shrink-0">
                      <div className="flex items-center gap-2">
                        {!isLocked ? (
                          <>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={pred?.home ?? ''}
                              onChange={(e) => handlePredictionChange(matchId, 'home', e.target.value)}
                              min={0}
                              disabled={!homeTeam.name || !awayTeam.name}
                              className="w-12 h-10 text-center text-lg font-bold border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="-"
                              maxLength={2}
                            />
                            <span className="text-xl font-bold text-gray-400">-</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={pred?.away ?? ''}
                              onChange={(e) => handlePredictionChange(matchId, 'away', e.target.value)}
                              min={0}
                              disabled={!homeTeam.name || !awayTeam.name}
                              className="w-12 h-10 text-center text-lg font-bold border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="-"
                              maxLength={2}
                            />
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            {savedPrediction?.prediction && (
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                                Tu pronóstico: {savedPrediction.prediction.homeScore} - {savedPrediction.prediction.awayScore}
                              </span>
                            )}
                            <span className="text-lg font-bold text-gray-800">
                              {match.homeScore} - {match.awayScore}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-gray-500 text-xs">VS</span>
                    </div>

                    {/* EQUIPO AWAY */}
                    <div className="flex flex-col items-center flex-1 min-w-0">
                     <div className="flex flex-col items-center gap-1 mb-2">
                    {awayTeam.flag && awayTeam.name ? (
                      <img src={awayTeam.flag} alt="" className="w-8 h-6 rounded object-cover" />
                    ) : (
                      <div className="w-8 h-6 bg-gray-300 rounded flex items-center justify-center text-xs">
                        ?
                      </div>
                    )}
                    <span className="font-semibold text-gray-800 text-xs text-center leading-tight line-clamp-2 px-1">
                      {awayTeam.name || 'Por definir'}
                    </span>
                  </div>
                      {/* ✅ Últimos 3 resultados */}
                      <div className="flex gap-1 justify-end">
                        {awayResults.length > 0 ? (
                          awayResults.map((result, idx) => (
                            <ResultBadge key={idx} result={result} />
                          ))
                        ) : (
                          <ResultBadge result={null} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ✅ STADIUM Y VER DETALLES CENTRADOS */}
                  <div className="text-center space-y-2">
                    {match.stadium && (
                      <p className="text-xs text-gray-400"><MapPin className="w-3 h-3 inline mr-0.5 text-red-500" /> {match.stadium}</p>
                    )}
                    <button
                      onClick={() => navigate(`/matches/${matchId}?tournamentId=${tournament.id}`)}
                      className="text-xs text-blue-600 hover:text-blue-800 transition"
                    >
                      Ver detalles
                    </button>
                  </div>

                  {match.status === 'finished' && savedPrediction && (
                    <div className="text-right mt-2">
                      <span className="text-sm font-bold text-green-600">
                        +{calculateTournamentPredictionPoints(
                          savedPrediction.prediction,
                          match,
                          tournament
                        )} pts
                      </span>
                    </div>
                  )}

                  {/* Clear prediction button */}
                  {!isLocked && savedPrediction && (
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => handleClearPrediction(matchId)}
                        disabled={clearingId === String(matchId)}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition disabled:opacity-50"
                        title="Limpiar pronóstico"
                      >
                        <X className="w-3 h-3" />
                        {clearingId === String(matchId) ? 'Limpiando...' : 'Limpiar pronóstico'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 transition"
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
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>

     {filteredMatches.length > 0 && (
      <div className="sticky bottom-4 flex justify-center">
        <button
          onClick={handleSaveAll}
          disabled={savingAll || !hasChanges}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition disabled:opacity-50 shadow-lg"
        >
          {savingAll ? 'Guardando...' : <><Save className="w-4 h-4 inline mr-1.5" /> Guardar Todos los Cambios</>}
        </button>
      </div>
    )}
    </div>
  );
}