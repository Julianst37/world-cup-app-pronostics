import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Loading from '../common/Loading';
import TeamAvatar from '../common/TeamAvatar';
import { Trophy, ArrowUp, ArrowDown, Minus, Share2 } from 'lucide-react';
import { loadParticipants, fetchUserProfile, loadStandingsDoc, invalidateParticipantsCache } from '../../hooks/participantsCache';
import html2canvas from 'html2canvas';

const getPreviousStandingsKey = (tournamentId) => `standings_${tournamentId}`;

const fmtCOP = (v) => {
  const n = Number(v);
  if (isNaN(n)) return '$ 0';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
};

const getPrizeForPosition = (prizeConfig, position) => {
  if (!prizeConfig) return null;
  const item = (prizeConfig.distribution || []).find((d) => d.position === position);
  if (!item) return null;
  const total = Number(prizeConfig.totalAmount) || 0;
  const val = parseFloat(item.value) || 0;
  return item.type === 'percentage' ? Math.round((val * total) / 100) : val;
};

const getFallbackUser = () => ({ displayName: 'Usuario', username: '' });

async function buildStandingsEntries(participants, previousStandingsRef, idToken) {
  // participants may come from standings doc (has displayName/username/favoriteTeam at top level)
  // or from loadParticipants fallback (needs profile fetch)
  const withProfiles = await Promise.all(
    participants.map(async (p) => {
      const profile = await fetchUserProfile(p.userId, idToken);
      return { ...p, user: profile };
    })
  );

  withProfiles.sort((a, b) => (b.points || 0) - (a.points || 0));

  return withProfiles.map((entry, index) => {
    const newPosition = index + 1;
    let previousPosition = null;

    if (previousStandingsRef.current) {
      const prevEntry = previousStandingsRef.current.find((participant) => participant.userId === entry.userId);
      previousPosition = prevEntry ? prevEntry.position : null;
    }

    let movement = 'same';
    if (previousPosition !== null) {
      if (newPosition < previousPosition) movement = 'up';
      else if (newPosition > previousPosition) movement = 'down';
    }

    return {
      ...entry,
      position: newPosition,
      previousPosition,
      movement,
      positionChange: previousPosition !== null ? previousPosition - newPosition : 0,
    };
  });
}

function persistStandingsSnapshot(tournamentId, standings) {
  const standingsToSave = standings.map((entry) => ({
    userId: entry.userId,
    position: entry.position,
    points: entry.points,
  }));

  localStorage.setItem(getPreviousStandingsKey(tournamentId), JSON.stringify(standingsToSave));
}

export default function Standings() {
  const { tournament } = useOutletContext();
  const { currentUser } = useAuth();
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sharing, setSharing] = useState(false);
  const previousStandings = useRef(null);
  const tableRef = useRef(null);

  useEffect(() => {
    if (!tournament?.id) return;

    let isMounted = true;
    setLoading(true);
    setStandings([]);
    setError(null);

    // Load previous standings from localStorage
    try {
      const saved = localStorage.getItem(getPreviousStandingsKey(tournament.id));
      if (saved) {
        previousStandings.current = JSON.parse(saved);
      }
    } catch (_) {
      previousStandings.current = null;
    }

    const initializeStandings = async () => {
      try {
        const idToken = await currentUser?.getIdToken();

        const hydrateStandings = async (participants, hasFinishedMatches = true) => {
          const standingsWithMovement = await buildStandingsEntries(participants, previousStandings, idToken);
          if (!isMounted) return;
          setStandings(standingsWithMovement);
          if (hasFinishedMatches) persistStandingsSnapshot(tournament.id, standingsWithMovement);
          setLoading(false);
        };

        // Always fetch fresh participants to reflect approval/removal changes immediately
        invalidateParticipantsCache(tournament.id);
        const all = await loadParticipants(tournament.id, idToken);
        const active = all.filter((p) => p.status === 'active');

        // Try standings doc for pre-computed points data
        const standingsData = await loadStandingsDoc(tournament.id, idToken);

        if (!isMounted) return;

        if (standingsData !== null && standingsData.length > 0) {
          // Merge: use standings entries for points, but add any newly approved
          // participant that isn't in the snapshot yet (they get 0 points)
          const inStandings = new Set(standingsData.map((e) => e.userId));
          const newParticipants = active.filter((p) => !inStandings.has(p.userId));
          await hydrateStandings([...standingsData, ...newParticipants]);
        } else {
          // No finalized matches yet — show all active participants with 0 points, no movement
          previousStandings.current = null;
          await hydrateStandings(active, false);
        }
      } catch (err) {
        console.error('Standings error:', err);
        if (isMounted) { setError(err.message); setLoading(false); }
      }
    };

    initializeStandings();

    return () => { isMounted = false; };
  }, [tournament?.id]);

  const handleShare = async () => {
    if (!tableRef.current) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(tableRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) { setSharing(false); return; }
        const file = new File([blob], 'posiciones.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Tabla de posiciones — ${tournament?.name}`,
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'posiciones.png';
          a.click();
          URL.revokeObjectURL(url);
        }
        setSharing(false);
      }, 'image/png');
    } catch {
      setSharing(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <div className="text-center py-10 text-red-500">Error al cargar posiciones: {error}</div>;

  const prizeConfig = tournament?.prizeConfig ?? null;
  const isFinished = tournament?.status === 'finished';
  const showPrizeColumn = prizeConfig && isFinished;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Tabla de Posiciones</h2>
        <button
          onClick={handleShare}
          disabled={sharing || standings.length === 0}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-lg px-3 py-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Share2 className="w-4 h-4" />
          {sharing ? 'Generando...' : 'Compartir'}
        </button>
      </div>

      {prizeConfig && (
        <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 px-4 py-3 flex items-start gap-3">
          <Trophy className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
              Premio total: {fmtCOP(prizeConfig.totalAmount)}
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-2">
              {prizeConfig.winnersCount === 1 ? '1er puesto' : `Distribuido entre los ${prizeConfig.winnersCount} primeros`}
            </p>
            <div className="flex flex-wrap gap-2">
              {(prizeConfig.distribution || []).map((item, i) => {
                const val = parseFloat(item.value) || 0;
                const amount = item.type === 'percentage'
                  ? Math.round((val * Number(prizeConfig.totalAmount)) / 100)
                  : val;
                return (
                  <span key={i} className="text-xs bg-yellow-100 dark:bg-yellow-800/40 text-yellow-800 dark:text-yellow-300 px-2 py-0.5 rounded-full font-medium">
                    {i + 1}° — {isFinished ? fmtCOP(amount) : (item.type === 'percentage' ? `${item.value}%` : fmtCOP(amount))}
                  </span>
                );
              })}
            </div>
            {!isFinished && (
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2 italic">Los ganadores del premio se revelarán cuando la polla finalice.</p>
            )}
          </div>
        </div>
      )}

      <div ref={tableRef} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
          <span className="col-span-1 text-center">#</span>
          <span className={showPrizeColumn ? 'col-span-5' : 'col-span-7'}>Participante</span>
          {showPrizeColumn && <span className="col-span-3 text-right text-yellow-600">Premio</span>}
          <span className={showPrizeColumn ? 'col-span-3 text-right' : 'col-span-4 text-right'}>Puntos</span>
        </div>

        {standings.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p>No hay participantes activos aún</p>
          </div>
        ) : (
          standings.map((entry, index) => {
            const prizeAmount = getPrizeForPosition(prizeConfig, index + 1);
            const winnersCount = prizeConfig ? (prizeConfig.winnersCount || 1) : 1;
            const isWinner = index < winnersCount;
            const isFirst = index === 0;

            let rowBg;
            if (prizeConfig) {
              if (isFirst) {
                rowBg = 'bg-yellow-50 dark:bg-yellow-900/20';
              } else if (isWinner) {
                rowBg = 'bg-green-50 dark:bg-green-900/15';
              } else {
                rowBg = 'dark:bg-gray-800';
              }
            } else {
              if (index === 0) rowBg = 'bg-yellow-50 dark:bg-yellow-900/20';
              else if (index === 1) rowBg = 'bg-gray-50 dark:bg-gray-700/30';
              else if (index === 2) rowBg = 'bg-orange-50 dark:bg-orange-900/20';
              else rowBg = 'dark:bg-gray-800';
            }

            return (
            <div
              key={entry.userId ?? index}
              className={`grid grid-cols-12 px-4 py-4 border-b border-gray-100 dark:border-gray-700 last:border-0 items-center ${rowBg}`}
            >
              <div className="col-span-1 text-center">
                <span className="text-gray-700 dark:text-gray-200 font-semibold">{entry.position}</span>
              </div>
              <div className={`${showPrizeColumn ? 'col-span-5' : 'col-span-7'} flex items-center gap-3`}>
                <TeamAvatar
                  teamCode={entry.user?.favoriteTeam}
                  name={entry.user?.displayName}
                  size={36}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                    {entry.user?.displayName}
                    {entry.userId === currentUser?.uid && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium">Tú</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">@{entry.user?.username}</p>
                </div>
                {/* Position movement indicator */}
                {entry.previousPosition !== null && (
                  <div className="flex-shrink-0">
                    {entry.movement === 'up' && (
                      <div className="flex items-center gap-1 text-green-600">
                        <ArrowUp className="w-4 h-4" />
                        <span className="text-xs font-semibold">+{entry.positionChange}</span>
                      </div>
                    )}
                    {entry.movement === 'down' && (
                      <div className="flex items-center gap-1 text-red-600">
                        <ArrowDown className="w-4 h-4" />
                        <span className="text-xs font-semibold">-{Math.abs(entry.positionChange)}</span>
                      </div>
                    )}
                    {entry.movement === 'same' && (
                      <div className="flex items-center text-gray-400">
                        <Minus className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                )}
              </div>
              {showPrizeColumn && (
                <div className="col-span-3 text-right">
                  {prizeAmount != null ? (
                    <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">{fmtCOP(prizeAmount)}</span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </div>
              )}
              <div className={`${showPrizeColumn ? 'col-span-3' : 'col-span-4'} text-right`}>
                <span className="text-xl font-bold text-blue-700 dark:text-blue-400">{entry.points || 0}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">pts</span>
              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}
