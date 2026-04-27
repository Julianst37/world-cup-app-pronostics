import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useMatches } from '../../hooks/useMatches';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import {
  DEFAULT_GLOBAL_ROUND_SETTINGS,
  PLAYOFF_ROUNDS,
  ROUNDS,
  SUPER_ADMIN_EMAIL,
} from '../../utils/constants';
import { calculateTournamentPredictionPoints, formatColombiaTime, getRoundDisplayName, isPlayoffRound, normalizeRoundName } from '../../utils/helpers';
import { getCanonicalTeamDisplay, SORTED_WORLD_CUP_2026_TEAMS } from '../../utils/worldCupTeams';
import Loading from '../common/Loading';
import Modal from '../common/Modal';
import toast from 'react-hot-toast';
import { CheckCircle2, ChevronDown, Eraser, Flag, Lock, RotateCcw, Search, ShieldCheck, Trophy } from 'lucide-react';

const ADMIN_ROUNDS = [ROUNDS.GROUP_STAGE, ...PLAYOFF_ROUNDS];

function getSafeString(value) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

function getMatchDocumentId(match) {
  const rawMatchId = match?.id ?? match?.matchId;
  return getSafeString(rawMatchId).trim();
}

function TeamSelect({ value, onChange, placeholder, excludedCode, compact = false }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const normalizedSearchTerm = getSafeString(searchTerm).trim().toLocaleLowerCase('es');

  useEffect(() => {
    if (!open) return undefined;

    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearchTerm('');
    }
  }, [open]);

  const normalizedExcludedCode = getSafeString(excludedCode);
  const normalizedValue = getSafeString(value);
  const availableTeams = SORTED_WORLD_CUP_2026_TEAMS.filter((team) => getSafeString(team.code) !== normalizedExcludedCode);
  const filteredTeams = availableTeams.filter((team) =>
    getSafeString(team.name).toLocaleLowerCase('es').includes(normalizedSearchTerm)
  );
  const selectedTeam = availableTeams.find((team) => getSafeString(team.code) === normalizedValue) || null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white text-left text-sm text-gray-700 shadow-sm transition hover:border-blue-300 ${
          compact ? 'w-auto min-w-[148px] px-3 py-2' : 'w-full px-3 py-2'
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          {selectedTeam ? (
            <>
              <img src={selectedTeam.flag} alt="" className="h-5 w-7 rounded-sm object-cover" />
              <span className="truncate font-medium text-gray-800">{selectedTeam.name}</span>
            </>
          ) : (
            <>
              <span className="flex h-5 w-7 items-center justify-center rounded-sm bg-gray-100 text-gray-400">
                <Flag className="h-3.5 w-3.5" />
              </span>
              <span className="truncate text-gray-400">{placeholder}</span>
            </>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar país"
              className="w-full border-0 p-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filteredTeams.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">No se encontraron países</div>
            ) : (
              filteredTeams.map((team) => (
                <button
                  key={team.code}
                  type="button"
                  onClick={() => {
                    onChange(getSafeString(team.code));
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                    normalizedValue === getSafeString(team.code) ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <img src={team.flag} alt="" className="h-5 w-7 rounded-sm object-cover" />
                  <span className="truncate">{team.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getInitialTeamCode(match, side) {
  const codeField = `${side}TeamCode`;
  if (match?.[codeField]) {
    return getSafeString(match[codeField]);
  }

  const teamName = getSafeString(match?.[`${side}Team`]);
  const selectedTeam = SORTED_WORLD_CUP_2026_TEAMS.find((team) => getSafeString(team.name) === teamName);
  return selectedTeam?.code || '';
}

function sanitizeScore(value) {
  return value.replace(/\D/g, '').slice(0, 2);
}

function hasCompleteScore(formState) {
  const homeScore = getSafeString(formState?.homeScore).trim();
  const awayScore = getSafeString(formState?.awayScore).trim();
  return homeScore !== '' && awayScore !== '';
}

function toOptionalScore(value) {
  const normalizedValue = getSafeString(value).trim();
  if (normalizedValue === '') {
    return null;
  }

  const numericValue = Number(normalizedValue);
  return Number.isInteger(numericValue) ? numericValue : null;
}

async function recalculateTournamentPointsForMatch(matchId, finalizedMatch) {
  const impactedPredictionsSnapshot = await getDocs(
    query(collection(db, 'predictions'), where('matchId', '==', matchId))
  );

  if (impactedPredictionsSnapshot.empty) {
    return;
  }

  const tournamentIds = [...new Set(impactedPredictionsSnapshot.docs.map((docSnapshot) => docSnapshot.data().tournamentId).filter(Boolean))];

  for (const tournamentId of tournamentIds) {
    const [tournamentSnapshot, tournamentPredictionsSnapshot, participantsSnapshot] = await Promise.all([
      getDoc(doc(db, 'tournaments', tournamentId)),
      getDocs(query(collection(db, 'predictions'), where('tournamentId', '==', tournamentId))),
      getDocs(query(collection(db, 'participants'), where('tournamentId', '==', tournamentId))),
    ]);

    if (!tournamentSnapshot.exists()) {
      continue;
    }

    const tournament = { id: tournamentSnapshot.id, ...tournamentSnapshot.data() };
    const tournamentPredictions = tournamentPredictionsSnapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ref: docSnapshot.ref,
      ...docSnapshot.data(),
    }));

    const matchIds = [...new Set(tournamentPredictions.map((prediction) => prediction.matchId).filter(Boolean))];
    const matchSnapshots = await Promise.all(
      matchIds.map(async (predictionMatchId) => {
        if (predictionMatchId === matchId) {
          return [predictionMatchId, finalizedMatch];
        }

        const predictionMatchSnapshot = await getDoc(doc(db, 'matches', predictionMatchId));
        return [predictionMatchId, predictionMatchSnapshot.exists() ? { id: predictionMatchSnapshot.id, ...predictionMatchSnapshot.data() } : null];
      })
    );

    const matchMap = new Map(matchSnapshots);
    const participantTotals = new Map(
      participantsSnapshot.docs.map((participantSnapshot) => [participantSnapshot.data().userId, 0])
    );
    const batch = writeBatch(db);

    tournamentPredictions.forEach((prediction) => {
      const predictionMatch = matchMap.get(prediction.matchId);
      const nextPoints = predictionMatch?.status === 'finished'
        ? calculateTournamentPredictionPoints(prediction.prediction, predictionMatch, tournament)
        : null;

      if (prediction.points !== nextPoints) {
        batch.set(prediction.ref, { points: nextPoints, updatedAt: serverTimestamp() }, { merge: true });
      }

      if (nextPoints !== null) {
        participantTotals.set(prediction.userId, (participantTotals.get(prediction.userId) || 0) + nextPoints);
      }
    });

    participantsSnapshot.docs.forEach((participantSnapshot) => {
      const nextTotal = participantTotals.get(participantSnapshot.data().userId) || 0;
      if ((participantSnapshot.data().points || 0) !== nextTotal) {
        batch.set(participantSnapshot.ref, { points: nextTotal, updatedAt: serverTimestamp() }, { merge: true });
      }
    });

    await batch.commit();
  }
}

export default function AdminTournament() {
  const { currentUser } = useAuth();
  const { matches, loading: matchesLoading } = useMatches();
  const { settings, loading: settingsLoading, updateSettings } = usePlatformSettings();
  const [filterRound, setFilterRound] = useState(ROUNDS.GROUP_STAGE);
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterDate, setFilterDate] = useState('all');
  const [matchForms, setMatchForms] = useState({});
  const [savingRound, setSavingRound] = useState('');
  const [savingMatchId, setSavingMatchId] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;
  const playoffRounds = settings?.playoffRounds || DEFAULT_GLOBAL_ROUND_SETTINGS;

  const availableRounds = useMemo(
    () => ADMIN_ROUNDS.filter((round) => round === ROUNDS.GROUP_STAGE || playoffRounds[round] === true),
    [playoffRounds]
  );

  useEffect(() => {
    if (!matches.length) return;

    setMatchForms((previous) => {
      const next = { ...previous };

      matches.forEach((match) => {
        const matchId = getMatchDocumentId(match);
        if (!matchId) {
          return;
        }

        if (!next[matchId]) {
          next[matchId] = {
            homeTeamCode: getInitialTeamCode(match, 'home'),
            awayTeamCode: getInitialTeamCode(match, 'away'),
            homeScore: match.homeScore ?? '',
            awayScore: match.awayScore ?? '',
          };
        }
      });

      return next;
    });
  }, [matches]);

  const groups = useMemo(() => {
    const allGroups = ['all', ...new Set(matches.map((match) => match.group).filter(Boolean))];
    return allGroups.sort((left, right) => {
      if (left === 'all') return -1;
      if (right === 'all') return 1;
      return left.localeCompare(right);
    });
  }, [matches]);

  const dates = useMemo(() => {
    const uniqueDates = [...new Set(matches.map((match) => match.date).filter(Boolean))];
    uniqueDates.sort((left, right) => new Date(left) - new Date(right));
    return ['all', ...uniqueDates];
  }, [matches]);

  const filteredMatches = useMemo(() => {
    let result = matches.filter((match) => normalizeRoundName(match.round) === filterRound);

    if (filterGroup !== 'all') {
      result = result.filter((match) => match.group === filterGroup);
    }

    if (filterDate !== 'all') {
      result = result.filter((match) => match.date === filterDate);
    }

    return result.sort((left, right) => {
      const leftDateTime = `${left.date}T${left.time || '00:00'}`;
      const rightDateTime = `${right.date}T${right.time || '00:00'}`;
      return new Date(leftDateTime) - new Date(rightDateTime);
    });
  }, [matches, filterRound, filterGroup, filterDate]);

  const filteredPlayoffMatches = useMemo(
    () => filteredMatches.filter((match) => isPlayoffRound(match.round)),
    [filteredMatches]
  );

  useEffect(() => {
    if (!availableRounds.includes(filterRound)) {
      setFilterRound(ROUNDS.GROUP_STAGE);
      setFilterGroup('all');
      setFilterDate('all');
    }
  }, [availableRounds, filterRound]);

  if (matchesLoading || settingsLoading) {
    return <Loading />;
  }

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-500">
        <Lock className="mx-auto mb-3 h-10 w-10 text-gray-400" />
        <p className="font-medium text-gray-700">Solo el super admin puede administrar los partidos.</p>
        <p className="mt-1 text-sm">Este módulo está reservado para {SUPER_ADMIN_EMAIL}.</p>
      </div>
    );
  }

  const handleToggleRound = async (round) => {
    const nextValue = !playoffRounds[round];
    setSavingRound(round);
    try {
      await updateSettings({
        playoffRounds: {
          ...playoffRounds,
          [round]: nextValue,
        },
      });
      toast.success(`${getRoundDisplayName(round)} ${nextValue ? 'habilitada' : 'deshabilitada'} globalmente`);
    } catch {
      toast.error('No fue posible actualizar la ronda');
    } finally {
      setSavingRound('');
    }
  };

  const handleTeamChange = async (match, field, value) => {
    const matchId = getMatchDocumentId(match);
    if (!matchId) {
      toast.error('No se pudo identificar el partido a actualizar');
      return;
    }

    const nextFormState = {
      ...(matchForms[matchId] || {}),
      [field]: getSafeString(value),
    };

    if (
      (field === 'homeTeamCode' && value === nextFormState.awayTeamCode) ||
      (field === 'awayTeamCode' && value === nextFormState.homeTeamCode)
    ) {
      toast.error('No puedes repetir la misma selección en ambos lados');
      return;
    }

    setMatchForms((previous) => ({
      ...previous,
      [matchId]: nextFormState,
    }));

    if (!isPlayoffRound(match.round)) {
      return;
    }

    if (!nextFormState.homeTeamCode || !nextFormState.awayTeamCode) {
      return;
    }

    setSavingMatchId(`${matchId}:teams`);
    try {
      const payload = buildMatchPayload(match, nextFormState);
      await setDoc(doc(db, 'matches', matchId), payload, { merge: true });
      toast.success('Llave actualizada');
    } catch (error) {
      toast.error(error.message || 'No fue posible guardar la llave');
    } finally {
      setSavingMatchId('');
    }
  };

  const handleScoreChange = (matchId, field, value) => {
    setMatchForms((previous) => ({
      ...previous,
      [matchId]: {
        ...previous[matchId],
        [field]: sanitizeScore(value),
      },
    }));
  };

  const syncMatchForm = (matchId, updates) => {
    setMatchForms((previous) => ({
      ...previous,
      [matchId]: {
        ...(previous[matchId] || {}),
        ...updates,
      },
    }));
  };

  const buildMatchPayload = (match, formState) => {
    const payload = {
      updatedAt: serverTimestamp(),
    };

    if (isPlayoffRound(match.round)) {
      const homeTeam = SORTED_WORLD_CUP_2026_TEAMS.find((team) => team.code === formState.homeTeamCode);
      const awayTeam = SORTED_WORLD_CUP_2026_TEAMS.find((team) => team.code === formState.awayTeamCode);

      if (!homeTeam || !awayTeam) {
        throw new Error('Debes seleccionar ambas selecciones para la llave');
      }

      if (homeTeam.code === awayTeam.code) {
        throw new Error('No puedes repetir la misma selección en ambos lados');
      }

      payload.homeTeam = homeTeam.name;
      payload.homeTeamCode = homeTeam.code;
      payload.homeTeamFlag = homeTeam.flag;
      payload.awayTeam = awayTeam.name;
      payload.awayTeamCode = awayTeam.code;
      payload.awayTeamFlag = awayTeam.flag;
      payload.configured = true;
    }

    return payload;
  };

  const handleFinalizeMatch = async (match) => {
    const matchId = getMatchDocumentId(match);
    if (!matchId) {
      toast.error('No se pudo identificar el partido a finalizar');
      return;
    }

    const formState = matchForms[matchId];
    if (!hasCompleteScore(formState)) {
      toast.error('Debes ingresar el resultado completo antes de finalizar');
      return;
    }

    const homeScore = Number(formState?.homeScore);
    const awayScore = Number(formState?.awayScore);

    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
      toast.error('Debes ingresar el resultado completo antes de finalizar');
      return;
    }

    setSavingMatchId(`${matchId}:finish`);
    try {
      const payload = {
        ...buildMatchPayload(match, formState),
        homeScore,
        awayScore,
        status: 'finished',
      };

      await setDoc(doc(db, 'matches', matchId), payload, { merge: true });
      await recalculateTournamentPointsForMatch(matchId, {
        ...match,
        ...payload,
        id: matchId,
      });
      toast.success('Encuentro finalizado correctamente');
    } catch (error) {
      toast.error(error.message || 'No fue posible finalizar el encuentro');
    } finally {
      setSavingMatchId('');
    }
  };

  const handleClearMatchResult = async (match, options = {}) => {
    const { showToast = true, manageSavingState = true } = options;
    const matchId = getMatchDocumentId(match);
    if (!matchId) {
      if (showToast) {
        toast.error('No se pudo identificar el partido');
      }
      return;
    }

    if (manageSavingState) {
      setSavingMatchId(`${matchId}:clear`);
    }
    try {
      const payload = {
        updatedAt: serverTimestamp(),
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
      };

      await setDoc(doc(db, 'matches', matchId), payload, { merge: true });
      syncMatchForm(matchId, { homeScore: '', awayScore: '' });
      await recalculateTournamentPointsForMatch(matchId, {
        ...match,
        ...payload,
        id: matchId,
      });
      if (showToast) {
        toast.success('Resultado limpiado correctamente');
      }
    } catch (error) {
      if (showToast) {
        toast.error(error.message || 'No fue posible limpiar el resultado');
      }
      throw error;
    } finally {
      if (manageSavingState) {
        setSavingMatchId('');
      }
    }
  };

  const handleUnfinishMatch = async (match, options = {}) => {
    const { showToast = true, manageSavingState = true } = options;
    const matchId = getMatchDocumentId(match);
    if (!matchId) {
      if (showToast) {
        toast.error('No se pudo identificar el partido');
      }
      return;
    }

    const formState = matchForms[matchId] || {};
    const homeScore = toOptionalScore(formState.homeScore) ?? match.homeScore ?? null;
    const awayScore = toOptionalScore(formState.awayScore) ?? match.awayScore ?? null;

    if (manageSavingState) {
      setSavingMatchId(`${matchId}:unfinish`);
    }
    try {
      const payload = {
        updatedAt: serverTimestamp(),
        homeScore,
        awayScore,
        status: 'scheduled',
      };

      await setDoc(doc(db, 'matches', matchId), payload, { merge: true });
      syncMatchForm(matchId, {
        homeScore: homeScore === null ? '' : String(homeScore),
        awayScore: awayScore === null ? '' : String(awayScore),
      });
      await recalculateTournamentPointsForMatch(matchId, {
        ...match,
        ...payload,
        id: matchId,
      });
      if (showToast) {
        toast.success('El partido volvió a estado pendiente');
      }
    } catch (error) {
      if (showToast) {
        toast.error(error.message || 'No fue posible quitar el estado finalizado');
      }
      throw error;
    } finally {
      if (manageSavingState) {
        setSavingMatchId('');
      }
    }
  };

  const handleBulkClearResults = async () => {
    const matchesToClear = filteredMatches.filter((match) => match.homeScore !== null || match.awayScore !== null || match.status === 'finished');

    if (!matchesToClear.length) {
      toast.error('No hay resultados cargados en los partidos filtrados');
      return;
    }

    setSavingMatchId('bulk:clear');
    try {
      for (const match of matchesToClear) {
        await handleClearMatchResult(match, { showToast: false, manageSavingState: false });
      }
      toast.success('Se limpiaron los resultados de los partidos filtrados');
    } catch (error) {
      toast.error(error.message || 'No fue posible limpiar algunos resultados');
    } finally {
      setSavingMatchId('');
    }
  };

  const handleBulkUnfinishMatches = async () => {
    const matchesToUnfinish = filteredMatches.filter((match) => match.status === 'finished');

    if (!matchesToUnfinish.length) {
      toast.error('No hay partidos finalizados en los filtros actuales');
      return;
    }

    setSavingMatchId('bulk:unfinish');
    try {
      for (const match of matchesToUnfinish) {
        await handleUnfinishMatch(match, { showToast: false, manageSavingState: false });
      }
      toast.success('Los partidos filtrados volvieron a estado pendiente');
    } catch (error) {
      toast.error(error.message || 'No fue posible actualizar algunos partidos');
    } finally {
      setSavingMatchId('');
    }
  };

  const handleClearMatchBracket = async (match, options = {}) => {
    const { showToast = true, manageSavingState = true } = options;
    const matchId = getMatchDocumentId(match);

    if (!matchId) {
      if (showToast) {
        toast.error('No se pudo identificar el partido');
      }
      return;
    }

    if (!isPlayoffRound(match.round)) {
      if (showToast) {
        toast.error('Solo puedes limpiar llaves en partidos de playoffs');
      }
      return;
    }

    if (manageSavingState) {
      setSavingMatchId(`${matchId}:clear-bracket`);
    }

    try {
      const payload = {
        updatedAt: serverTimestamp(),
        homeTeam: '',
        homeTeamCode: '',
        homeTeamFlag: '',
        awayTeam: '',
        awayTeamCode: '',
        awayTeamFlag: '',
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        configured: false,
      };

      await setDoc(doc(db, 'matches', matchId), payload, { merge: true });
      syncMatchForm(matchId, {
        homeTeamCode: '',
        awayTeamCode: '',
        homeScore: '',
        awayScore: '',
      });
      await recalculateTournamentPointsForMatch(matchId, {
        ...match,
        ...payload,
        id: matchId,
      });

      if (showToast) {
        toast.success('Llave limpiada correctamente');
      }
    } catch (error) {
      if (showToast) {
        toast.error(error.message || 'No fue posible limpiar la llave');
      }
      throw error;
    } finally {
      if (manageSavingState) {
        setSavingMatchId('');
      }
    }
  };

  const handleBulkClearBrackets = async () => {
    if (!filteredPlayoffMatches.length) {
      toast.error('No hay partidos de playoffs en los filtros actuales');
      return;
    }

    setSavingMatchId('bulk:clear-brackets');
    try {
      for (const match of filteredPlayoffMatches) {
        await handleClearMatchBracket(match, { showToast: false, manageSavingState: false });
      }
      toast.success('Se limpiaron las llaves de los partidos filtrados');
    } catch (error) {
      toast.error(error.message || 'No fue posible limpiar algunas llaves');
    } finally {
      setSavingMatchId('');
    }
  };

  const openActionModal = (action) => {
    setPendingAction(action);
  };

  const executePendingAction = async () => {
    if (!pendingAction) {
      return;
    }

    const action = pendingAction;
    setPendingAction(null);

    if (action.type === 'clear-match') {
      await handleClearMatchResult(action.match);
      return;
    }

    if (action.type === 'unfinish-match') {
      await handleUnfinishMatch(action.match);
      return;
    }

    if (action.type === 'clear-bulk') {
      await handleBulkClearResults();
      return;
    }

    if (action.type === 'unfinish-bulk') {
      await handleBulkUnfinishMatches();
      return;
    }

    if (action.type === 'clear-bracket-match') {
      await handleClearMatchBracket(action.match);
      return;
    }

    if (action.type === 'clear-bracket-bulk') {
      await handleBulkClearBrackets();
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-900 to-indigo-800 p-6 text-white">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-blue-200" />
          <div>
            <h2 className="text-2xl font-bold">Administración global de partidos</h2>
            <p className="text-sm text-blue-100">
              Configura llaves de playoffs, habilita rondas finales y registra resultados oficiales.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-gray-800">Habilitar rondas finales para todos los torneos</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PLAYOFF_ROUNDS.map((round) => {
            const isEnabled = playoffRounds[round];
            const isSaving = savingRound === round;

            return (
              <button
                key={round}
                type="button"
                onClick={() => handleToggleRound(round)}
                disabled={isSaving}
                className={`rounded-xl border-2 p-4 text-left transition ${
                  isEnabled
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                } ${isSaving ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{getRoundDisplayName(round)}</span>
                  <span className="text-xs font-medium uppercase tracking-wide">
                    {isSaving ? 'Guardando...' : isEnabled ? 'Habilitada' : 'Bloqueada'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Administrar partidos</h3>
          <p className="text-sm text-gray-500">Filtra los encuentros y registra el resultado oficial en orden cronológico.</p>
        </div>

        <div className="rounded-xl border border-gray-200 p-4 space-y-3 mb-4">
          <h4 className="text-sm font-semibold text-gray-700">Filtros</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">Ronda</label>
              <select
                value={filterRound}
                onChange={(event) => {
                  setFilterRound(event.target.value);
                  setFilterGroup('all');
                  setFilterDate('all');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {availableRounds.map((round) => (
                  <option key={round} value={round}>
                    {getRoundDisplayName(round)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">Grupo</label>
              <select
                value={filterGroup}
                onChange={(event) => setFilterGroup(event.target.value)}
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
              <label className="text-xs text-gray-600 font-medium mb-1 block">Fecha</label>
              <select
                value={filterDate}
                onChange={(event) => setFilterDate(event.target.value)}
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
        </div>

        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">Acciones masivas sobre los partidos filtrados</p>
            <p className="text-xs text-gray-500">Puedes limpiar resultados o devolver encuentros finalizados a estado pendiente.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => openActionModal({ type: 'clear-bulk' })}
              disabled={savingMatchId === 'bulk:clear' || savingMatchId === 'bulk:unfinish' || filteredMatches.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <Eraser className="h-4 w-4" />
              Limpiar resultados
            </button>
            <button
              type="button"
              onClick={() => openActionModal({ type: 'unfinish-bulk' })}
              disabled={savingMatchId === 'bulk:clear' || savingMatchId === 'bulk:unfinish' || filteredMatches.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Quitar finalizado
            </button>
            <button
              type="button"
              onClick={() => openActionModal({ type: 'clear-bracket-bulk' })}
              disabled={savingMatchId === 'bulk:clear-brackets' || filteredPlayoffMatches.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Eraser className="h-4 w-4" />
              Limpiar llaves
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {filteredMatches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
              No hay partidos cargados para esta ronda.
            </div>
          ) : (
            filteredMatches.map((match, index) => {
              const matchId = getMatchDocumentId(match);
              const formState = matchForms[matchId] || {
                homeTeamCode: '',
                awayTeamCode: '',
                homeScore: '',
                awayScore: '',
              };
              const isPlayoffMatch = isPlayoffRound(match.round);
              const isSavingTeams = savingMatchId === `${matchId}:teams`;
              const isFinalizing = savingMatchId === `${matchId}:finish`;
              const isClearing = savingMatchId === `${matchId}:clear`;
              const isUnfinishing = savingMatchId === `${matchId}:unfinish`;
              const isClearingBracket = savingMatchId === `${matchId}:clear-bracket`;
              const canFinalizeMatch = hasCompleteScore(formState) && (!isPlayoffMatch || (formState.homeTeamCode && formState.awayTeamCode));
              const homeTeam = getCanonicalTeamDisplay(match.homeTeam, match.homeTeamCode, match.homeTeamFlag);
              const awayTeam = getCanonicalTeamDisplay(match.awayTeam, match.awayTeamCode, match.awayTeamFlag);

              return (
                <div key={matchId} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition">
                  <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {getRoundDisplayName(match.round)}{match.group ? ` · Grupo ${match.group}` : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{formatColombiaTime(match.date, match.time)}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                        match.status === 'finished' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {match.status === 'finished' && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {match.status === 'finished' ? 'Finalizado' : 'Pendiente'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col items-center flex-1">
                      <div className="flex items-center justify-center mb-2 min-h-[40px]">
                        {isPlayoffMatch ? (
                          <TeamSelect
                            value={formState.homeTeamCode}
                            onChange={(value) => handleTeamChange(match, 'homeTeamCode', value)}
                            placeholder="Local"
                            excludedCode={formState.awayTeamCode}
                            compact
                          />
                        ) : homeTeam.flag ? (
                          <img src={homeTeam.flag} alt={homeTeam.name || 'Local'} className="w-10 h-7 rounded object-cover" title={homeTeam.name} />
                        ) : (
                          <div className="w-10 h-7 bg-gray-300 rounded flex items-center justify-center text-xs text-gray-500">?</div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2 px-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formState.homeScore}
                          onChange={(event) => handleScoreChange(matchId, 'homeScore', event.target.value)}
                          className="w-12 h-10 text-center text-lg font-bold border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="-"
                          maxLength={2}
                        />
                        <span className="text-xl font-bold text-gray-400">-</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formState.awayScore}
                          onChange={(event) => handleScoreChange(matchId, 'awayScore', event.target.value)}
                          className="w-12 h-10 text-center text-lg font-bold border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="-"
                          maxLength={2}
                        />
                      </div>
                      <span className="text-gray-500 text-xs">VS</span>
                    </div>

                    <div className="flex flex-col items-center flex-1">
                      <div className="flex items-center justify-center mb-2 min-h-[40px]">
                        {isPlayoffMatch ? (
                          <TeamSelect
                            value={formState.awayTeamCode}
                            onChange={(value) => handleTeamChange(match, 'awayTeamCode', value)}
                            placeholder="Visitante"
                            excludedCode={formState.homeTeamCode}
                            compact
                          />
                        ) : awayTeam.flag ? (
                          <img src={awayTeam.flag} alt={awayTeam.name || 'Visitante'} className="w-10 h-7 rounded object-cover" title={awayTeam.name} />
                        ) : (
                          <div className="w-10 h-7 bg-gray-300 rounded flex items-center justify-center text-xs text-gray-500">?</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    {match.stadium && (
                      <p className="text-xs text-gray-400">{match.stadium}</p>
                    )}
                    {isPlayoffMatch && isSavingTeams && (
                      <p className="text-xs text-blue-600">Guardando llaves...</p>
                    )}
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleFinalizeMatch(match)}
                        disabled={isSavingTeams || isFinalizing || isClearing || isUnfinishing || isClearingBracket || !canFinalizeMatch}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg transition disabled:opacity-50"
                      >
                        {isFinalizing ? 'Finalizando...' : match.status === 'finished' ? 'Actualizar resultado' : 'Finalizar encuentro'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openActionModal({ type: 'clear-match', match })}
                        disabled={isSavingTeams || isFinalizing || isClearing || isUnfinishing || isClearingBracket}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <Eraser className="h-3.5 w-3.5" />
                        {isClearing ? 'Limpiando...' : 'Limpiar resultado'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openActionModal({ type: 'unfinish-match', match })}
                        disabled={isSavingTeams || isFinalizing || isClearing || isUnfinishing || isClearingBracket || match.status !== 'finished'}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {isUnfinishing ? 'Quitando...' : 'Quitar finalizado'}
                      </button>
                      {isPlayoffMatch && (
                        <button
                          type="button"
                          onClick={() => openActionModal({ type: 'clear-bracket-match', match })}
                          disabled={isSavingTeams || isFinalizing || isClearing || isUnfinishing || isClearingBracket}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Eraser className="h-3.5 w-3.5" />
                          {isClearingBracket ? 'Limpiando llave...' : 'Limpiar llave'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Modal
        isOpen={!!pendingAction}
        onClose={() => setPendingAction(null)}
        title={pendingAction?.type?.includes('clear-bracket') ? 'Limpiar llaves' : pendingAction?.type?.includes('clear') ? 'Limpiar resultados' : 'Quitar estado finalizado'}
        size="sm"
      >
        <div className="space-y-4 text-left">
          <p className="text-sm text-gray-600">
            {pendingAction?.type === 'clear-match' && 'Se eliminará el marcador oficial de este partido y volverá a estado pendiente.'}
            {pendingAction?.type === 'clear-bulk' && 'Se eliminarán los marcadores oficiales de todos los partidos filtrados y volverán a estado pendiente.'}
            {pendingAction?.type === 'unfinish-match' && 'El partido dejará de estar finalizado, pero conservará el marcador actual para que puedas ajustarlo.'}
            {pendingAction?.type === 'unfinish-bulk' && 'Todos los partidos finalizados dentro de los filtros actuales volverán a estado pendiente conservando sus marcadores.'}
            {pendingAction?.type === 'clear-bracket-match' && 'Se eliminarán las selecciones, el marcador y el estado finalizado de este partido para dejar la llave vacía.'}
            {pendingAction?.type === 'clear-bracket-bulk' && 'Se eliminarán las selecciones, los marcadores y el estado finalizado de todos los partidos de playoffs filtrados para dejar sus llaves vacías.'}
          </p>
          <p className="text-sm font-medium text-gray-800">
            {pendingAction?.match
              ? `${getCanonicalTeamDisplay(pendingAction.match.homeTeam, pendingAction.match.homeTeamCode, pendingAction.match.homeTeamFlag).name} vs ${getCanonicalTeamDisplay(pendingAction.match.awayTeam, pendingAction.match.awayTeamCode, pendingAction.match.awayTeamFlag).name}`
              : pendingAction?.type === 'clear-bracket-bulk'
                ? `${filteredPlayoffMatches.length} partido(s) de playoffs filtrado(s)`
                : `${filteredMatches.length} partido(s) filtrado(s)`}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPendingAction(null)}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={executePendingAction}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Confirmar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}