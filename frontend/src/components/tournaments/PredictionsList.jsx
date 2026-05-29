import { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
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
import { PLAYOFF_ROUNDS, ROUNDS } from '../../utils/constants';

const ITEMS_PER_PAGE = 10;

// Leer filtros guardados desde sessionStorage (para inicialización lazy)
const getInitialFilters = () => {
  try {
    const saved = sessionStorage.getItem('predictionFilters');
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
  const { currentUser } = useAuth();
  // Platform settings must come before useMatches so we can pass the enabled rounds
  const { settings: platformSettings, loading: platformSettingsLoading } = usePlatformSettings();
  const enabledRounds = useMemo(() => {
    // Always return an array - use defaults while settings load
    const { playoffRounds = {} } = platformSettings;
    return [ROUNDS.GROUP_STAGE, ...PLAYOFF_ROUNDS.filter((r) => playoffRounds[r] === true)];
  }, [platformSettings]);
  const { matches, loading } = useMatches({ rounds: enabledRounds });
  const { predictions, savePrediction, getPredictionForMatch, clearPrediction, clearAllPredictions, refreshPredictions } = usePredictions(tournament?.id);
  const { favorites, toggleFavorite, isFavorite } = useFavorites(currentUser?.uid, tournament?.id);
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
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rulesTab, setRulesTab] = useState('primera');
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
  sessionStorage.setItem('predictionFilters', JSON.stringify(filters));
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
  // Obtener borradores guardados en sessionStorage (solo para la sesión actual)
  const getDraftKey = () => `predictionDrafts_${tournament?.id}`;
  let drafts = {};
  try {
    const saved = sessionStorage.getItem(getDraftKey());
    if (saved) {
      drafts = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading drafts:', e);
  }

  const initial = {};
  paginatedMatches.forEach((match) => {
    const matchId = String(match.id || match.matchId);
    const existing = predictionsMap.get(matchId);
    
    // Priorizar: 1) Borrador de sesión, 2) Predicción guardada en BD, 3) Vacío
    initial[matchId] = drafts[matchId] || {
      home: existing?.prediction?.homeScore ?? '',
      away: existing?.prediction?.awayScore ?? '',
    };
  });
  
  setCurrentPredictions(prev => {
    const newState = { ...prev, ...initial };
    return newState;
  });
}, [paginatedMatches, predictionsMap, tournament?.id]);

  // ✅ Guardar borradores en sessionStorage cuando cambien (solo para la sesión)
  useEffect(() => {
    if (!tournament?.id) return;
    try {
      const draftKey = `predictionDrafts_${tournament.id}`;
      // Filtrar solo los que tienen valores no guardados
      const draftsToSave = Object.entries(currentPredictions).reduce((acc, [matchId, pred]) => {
        // Guardar solo si hay valores
        if (pred.home !== '' || pred.away !== '') {
          acc[matchId] = pred;
        }
        return acc;
      }, {});
      sessionStorage.setItem(draftKey, JSON.stringify(draftsToSave));
    } catch (e) {
      console.error('Error saving drafts:', e);
    }
  }, [currentPredictions, tournament?.id]);
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
      // ✅ Limpiar borrador del sessionStorage
      try {
        const draftKey = `predictionDrafts_${tournament?.id}`;
        const drafts = JSON.parse(sessionStorage.getItem(draftKey) || '{}');
        delete drafts[String(matchId)];
        sessionStorage.setItem(draftKey, JSON.stringify(drafts));
      } catch (e) {
        console.error('Error clearing draft:', e);
      }
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
      // ✅ Limpiar borradores del sessionStorage
      try {
        const draftKey = `predictionDrafts_${tournament?.id}`;
        const drafts = JSON.parse(sessionStorage.getItem(draftKey) || '{}');
        ids.forEach(id => delete drafts[id]);
        sessionStorage.setItem(draftKey, JSON.stringify(drafts));
      } catch (e) {
        console.error('Error clearing drafts:', e);
      }
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
    const results = await Promise.allSettled(
      toSave.map(([matchId, pred]) =>
        savePrediction(matchId, parseInt(pred.home), parseInt(pred.away))
      )
    );

    const failed = [];
    let hasLockError = false;

    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const [matchId] = toSave[idx];
        failed.push(matchId);
        const msg = result.reason?.message || '';
        if (msg.includes('plazo para pronosticar') || msg.includes('bloqueado')) {
          hasLockError = true;
        }
      }
    });

    // Revert inputs for failed predictions to their last saved value
    if (failed.length > 0) {
      setCurrentPredictions((prev) => {
        const next = { ...prev };
        failed.forEach((matchId) => {
          const existing = predictionsMap.get(String(matchId));
          next[String(matchId)] = {
            home: existing?.prediction?.homeScore ?? '',
            away: existing?.prediction?.awayScore ?? '',
          };
        });
        return next;
      });
    }

    const saved = toSave.length - failed.length;
    if (saved > 0) {
      toast.success(`${saved} pronóstico(s) guardado(s)`);
      // ✅ Limpiar borradores guardados exitosamente
      try {
        const draftKey = `predictionDrafts_${tournament?.id}`;
        const drafts = JSON.parse(sessionStorage.getItem(draftKey) || '{}');
        toSave.forEach(([matchId]) => {
          if (!failed.includes(matchId)) {
            delete drafts[String(matchId)];
          }
        });
        sessionStorage.setItem(draftKey, JSON.stringify(drafts));
      } catch (e) {
        console.error('Error clearing drafts:', e);
      }
    }
    if (hasLockError) toast.error('Uno o más pronósticos ya están bloqueados y fueron revertidos');
    else if (failed.length > 0) toast.error('Error al guardar algunos pronósticos');
  } catch (error) {
    if (error.message === 'No eres un participante activo en este torneo') {
      toast.error('No eres un participante activo en esta polla', { duration: 4000 });
      setTimeout(() => navigate('/dashboard'), 1500);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <h2 className="text-xl font-bold text-gray-800 shrink-0">Pronósticos</h2>
          <span className="text-sm text-gray-500 shrink-0">{predictions.length} guardados</span>
        </div>
        <div className="flex items-center justify-between sm:justify-end sm:gap-2 shrink-0">
          <button
            onClick={async () => {
              setRefreshing(true);
              try { await refreshPredictions(); } finally { setRefreshing(false); }
            }}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition disabled:opacity-50 whitespace-nowrap"
            title="Refrescar pronósticos desde el servidor"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{refreshing ? 'Refrescando...' : 'Refrescar'}</span>
            <span className="sm:hidden">{refreshing ? '...' : 'Ref'}</span>
          </button>
          <button
            onClick={handleClearAll}
            disabled={clearingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50 whitespace-nowrap"
            title="Limpiar todos los pronósticos desbloqueados"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{clearingAll ? 'Limpiando...' : 'Limpiar todos'}</span>
            <span className="sm:hidden">{clearingAll ? '...' : 'Limpiar'}</span>
          </button>
          <button
            onClick={() => setShowRulesModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition whitespace-nowrap"
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Ver Reglas</span>
            <span className="sm:hidden">Reglas</span>
          </button>
        </div>
      </div>

      <Modal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        title="Reglas de la polla"
        size="lg"
      >
        {(() => {
          const pointConfig = tournament?.pointConfig || { exact: 3, difference: 2, winner: 1 };
          const multiplier = tournament?.secondRoundMultiplier ?? 2;
          const lockMinutes = tournament?.predictionLockMinutes || 10;
          const exactBase = pointConfig.exact;
          const diffBase = pointConfig.difference;
          const winnerBase = pointConfig.winner;
          const exactTotal = winnerBase + diffBase + exactBase * 2;
          const diffTotal = winnerBase + diffBase;
          const groupStageExample = matches.find((m) => m.round === 'Group Stage') || matches[0] || null;

          return (
            <div className="space-y-4 text-left">
              <p className="text-sm text-gray-500 dark:text-gray-400">Los ejemplos están basados en la configuración actual de la polla.</p>
              {/* Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setRulesTab('primera')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition ${rulesTab === 'primera' ? 'border-blue-600 text-blue-700 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  Primera ronda
                </button>
                {multiplier > 1 && (
                  <button
                    onClick={() => setRulesTab('segunda')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition ${rulesTab === 'segunda' ? 'border-amber-600 text-amber-700 dark:text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                    Segunda ronda (×{multiplier})
                  </button>
                )}
              </div>

              {/* Primera ronda */}
              {rulesTab === 'primera' && (
                <>
                  {groupStageExample && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Resultado real: 2-1 (local gana)</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{groupStageExample.homeTeam} vs {groupStageExample.awayTeam}</p>
                      {[
                        { pred: '2-1', pts: exactTotal, items: [
                          { pts: winnerBase, label: 'Acertaste el ganador (local)', ok: true },
                          { pts: diffBase, label: 'Acertaste la diferencia de goles (1)', ok: true },
                          { pts: exactBase * 2, label: 'Acertaste los goles del local (2) y del visitante (1)', ok: true },
                        ]},
                        { pred: '1-0', pts: diffTotal, items: [
                          { pts: winnerBase, label: 'Acertaste el ganador (local)', ok: true },
                          { pts: diffBase, label: 'Acertaste la diferencia de goles (1)', ok: true },
                          { pts: 0, label: 'Goles exactos no coinciden (1≠2, 0≠1)', ok: false },
                        ]},
                        { pred: '3-1', pts: winnerBase + exactBase, items: [
                          { pts: winnerBase, label: 'Acertaste el ganador (local)', ok: true },
                          { pts: 0, label: 'Diferencia de goles incorrecta (2≠1)', ok: false },
                          { pts: exactBase, label: 'Acertaste los goles del visitante (1)', ok: true },
                        ]},
                        { pred: '4-2', pts: winnerBase, items: [
                          { pts: winnerBase, label: 'Acertaste el ganador (local)', ok: true },
                          { pts: 0, label: 'Diferencia de goles incorrecta (2≠1)', ok: false },
                          { pts: 0, label: 'Goles exactos no coinciden', ok: false },
                        ]},
                      ].map(({ pred, pts, items }) => (
                        <div key={pred} className="rounded-md bg-white dark:bg-gray-700 px-3 py-2.5 space-y-1.5 border border-gray-100 dark:border-gray-600">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Pronóstico {pred}</span>
                            <span className={`font-bold text-sm ${pts > 0 ? 'text-blue-700 dark:text-blue-400' : 'text-gray-400'}`}>{pts} pts</span>
                          </div>
                          <div className="space-y-0.5">
                            {items.map((item, i) => (
                              <div key={i} className="flex gap-2 text-xs">
                                <span className={`font-semibold w-6 shrink-0 ${item.ok ? 'text-green-600' : 'text-gray-400'}`}>+{item.pts}</span>
                                <span className={item.ok ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}>{item.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {groupStageExample && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Resultado real: 1-1 (empate)</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{groupStageExample.homeTeam} vs {groupStageExample.awayTeam}</p>
                      {[
                        { pred: '1-1', pts: exactTotal, items: [
                          { pts: winnerBase, label: 'Acertaste el empate', ok: true },
                          { pts: diffBase, label: 'Acertaste la diferencia de goles (0)', ok: true },
                          { pts: exactBase * 2, label: 'Acertaste los goles del local (1) y del visitante (1)', ok: true },
                        ]},
                        { pred: '0-0', pts: diffTotal, items: [
                          { pts: winnerBase, label: 'Acertaste el empate', ok: true },
                          { pts: diffBase, label: 'Acertaste la diferencia de goles (0)', ok: true },
                          { pts: 0, label: 'Goles exactos no coinciden (0≠1)', ok: false },
                        ]},
                        { pred: '2-1', pts: exactBase, items: [
                          { pts: 0, label: 'No acertaste el resultado (fue empate, no hubo ganador)', ok: false },
                          { pts: 0, label: 'Diferencia de goles incorrecta (1≠0)', ok: false },
                          { pts: 0, label: 'Goles del local no coinciden (2≠1)', ok: false },
                          { pts: exactBase, label: 'Acertaste los goles del visitante (1)', ok: true },
                        ]},
                      ].map(({ pred, pts, items }) => (
                        <div key={pred} className="rounded-md bg-white dark:bg-gray-700 px-3 py-2.5 space-y-1.5 border border-gray-100 dark:border-gray-600">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Pronóstico {pred}</span>
                            <span className={`font-bold text-sm ${pts > 0 ? 'text-blue-700 dark:text-blue-400' : 'text-gray-400'}`}>{pts} pts</span>
                          </div>
                          <div className="space-y-0.5">
                            {items.map((item, i) => (
                              <div key={i} className="flex gap-2 text-xs">
                                <span className={`font-semibold w-6 shrink-0 ${item.ok ? 'text-green-600' : 'text-gray-400'}`}>+{item.pts}</span>
                                <span className={item.ok ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}>{item.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Cierre de pronósticos</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Los pronósticos se bloquean <span className="font-semibold">{lockMinutes} minutos</span> antes del inicio de cada partido.</p>
                  </div>
                </>
              )}

              {/* Segunda ronda */}
              {rulesTab === 'segunda' && multiplier > 1 && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">A partir de Octavos, Cuartos, Semis, 3er puesto y Final los puntos se multiplican por <span className="font-bold text-amber-700 dark:text-amber-400">×{multiplier}</span>. El resultado se evalúa sobre los <span className="font-semibold">90 min reglamentarios</span>, sin tiempo extra ni penales.</p>

                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Resultado real: 2-1 (local gana)</p>
                    {[
                      { pred: '2-1', pts: exactTotal * multiplier, items: [
                        { pts: winnerBase * multiplier, label: `Acertaste el ganador (local) ×${multiplier}`, ok: true },
                        { pts: diffBase * multiplier, label: `Acertaste la diferencia de goles (1) ×${multiplier}`, ok: true },
                        { pts: exactBase * 2 * multiplier, label: `Acertaste los goles del local (2) y del visitante (1) ×${multiplier}`, ok: true },
                      ]},
                      { pred: '1-0', pts: diffTotal * multiplier, items: [
                        { pts: winnerBase * multiplier, label: `Acertaste el ganador (local) ×${multiplier}`, ok: true },
                        { pts: diffBase * multiplier, label: `Acertaste la diferencia de goles (1) ×${multiplier}`, ok: true },
                        { pts: 0, label: 'Goles exactos no coinciden (1≠2, 0≠1)', ok: false },
                      ]},
                      { pred: '3-1', pts: (winnerBase + exactBase) * multiplier, items: [
                        { pts: winnerBase * multiplier, label: `Acertaste el ganador (local) ×${multiplier}`, ok: true },
                        { pts: 0, label: 'Diferencia de goles incorrecta (2≠1)', ok: false },
                        { pts: exactBase * multiplier, label: `Acertaste los goles del visitante (1) ×${multiplier}`, ok: true },
                      ]},
                      { pred: '4-2', pts: winnerBase * multiplier, items: [
                        { pts: winnerBase * multiplier, label: `Acertaste el ganador (local) ×${multiplier}`, ok: true },
                        { pts: 0, label: 'Diferencia de goles incorrecta (2≠1)', ok: false },
                        { pts: 0, label: 'Goles exactos no coinciden', ok: false },
                      ]},
                    ].map(({ pred, pts, items }) => (
                      <div key={pred} className="rounded-md bg-white dark:bg-slate-700 px-3 py-2.5 space-y-1.5 border border-amber-100 dark:border-amber-900/30">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Pronóstico {pred}</span>
                          <span className={`font-bold text-sm ${pts > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400'}`}>{pts} pts</span>
                        </div>
                        <div className="space-y-0.5">
                          {items.map((item, i) => (
                            <div key={i} className="flex gap-2 text-xs">
                              <span className={`font-semibold w-6 shrink-0 ${item.ok ? 'text-green-600' : 'text-gray-400'}`}>+{item.pts}</span>
                              <span className={item.ok ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Resultado real: 1-1 (empate)</p>
                    {[
                      { pred: '1-1', pts: exactTotal * multiplier, items: [
                        { pts: winnerBase * multiplier, label: `Acertaste el empate ×${multiplier}`, ok: true },
                        { pts: diffBase * multiplier, label: `Acertaste la diferencia de goles (0) ×${multiplier}`, ok: true },
                        { pts: exactBase * 2 * multiplier, label: `Acertaste los goles del local (1) y del visitante (1) ×${multiplier}`, ok: true },
                      ]},
                      { pred: '0-0', pts: diffTotal * multiplier, items: [
                        { pts: winnerBase * multiplier, label: `Acertaste el empate ×${multiplier}`, ok: true },
                        { pts: diffBase * multiplier, label: `Acertaste la diferencia de goles (0) ×${multiplier}`, ok: true },
                        { pts: 0, label: 'Goles exactos no coinciden (0≠1)', ok: false },
                      ]},
                      { pred: '2-1', pts: exactBase * multiplier, items: [
                        { pts: 0, label: 'No acertaste el resultado (fue empate)', ok: false },
                        { pts: 0, label: 'Diferencia de goles incorrecta (1≠0)', ok: false },
                        { pts: 0, label: 'Goles del local no coinciden (2≠1)', ok: false },
                        { pts: exactBase * multiplier, label: `Acertaste los goles del visitante (1) ×${multiplier}`, ok: true },
                      ]},
                    ].map(({ pred, pts, items }) => (
                      <div key={pred} className="rounded-md bg-white dark:bg-slate-700 px-3 py-2.5 space-y-1.5 border border-amber-100 dark:border-amber-900/30">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Pronóstico {pred}</span>
                          <span className={`font-bold text-sm ${pts > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400'}`}>{pts} pts</span>
                        </div>
                        <div className="space-y-0.5">
                          {items.map((item, i) => (
                            <div key={i} className="flex gap-2 text-xs">
                              <span className={`font-semibold w-6 shrink-0 ${item.ok ? 'text-green-600' : 'text-gray-400'}`}>+{item.pts}</span>
                              <span className={item.ok ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
