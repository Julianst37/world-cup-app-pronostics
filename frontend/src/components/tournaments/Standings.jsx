import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, getDocsFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Loading from '../common/Loading';
import TeamAvatar from '../common/TeamAvatar';
import { Trophy, ArrowUp, ArrowDown, Minus } from 'lucide-react';

const getPreviousStandingsKey = (tournamentId) => `standings_${tournamentId}`;

const getFallbackUser = () => ({ displayName: 'Usuario', username: '' });

async function buildStandingsEntries(participants, previousStandingsRef) {
  const withProfiles = await Promise.all(
    participants.map(async (participant) => {
      const userDoc = await getDoc(doc(db, 'users', participant.userId));

      return {
        ...participant,
        user: userDoc.exists() ? userDoc.data() : getFallbackUser(),
      };
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
  const previousStandings = useRef(null);

  useEffect(() => {
    if (!tournament?.id) return;

    let isMounted = true;
    let hasProcessedServerSnapshot = false;
    setLoading(true);
    setStandings([]);

    // Load previous standings from localStorage
    try {
      const saved = localStorage.getItem(getPreviousStandingsKey(tournament.id));
      if (saved) {
        previousStandings.current = JSON.parse(saved);
      }
    } catch (_) {
      previousStandings.current = null;
    }

    const q = query(
      collection(db, 'participants'),
      where('tournamentId', '==', tournament.id),
      where('status', '==', 'active')
    );

    const hydrateStandings = async (participants) => {
      const standingsWithMovement = await buildStandingsEntries(participants, previousStandings);

      if (!isMounted) {
        return;
      }

      setStandings(standingsWithMovement);
      persistStandingsSnapshot(tournament.id, standingsWithMovement);
      setLoading(false);
    };

    let unsubscribe = () => {};

    const initializeStandings = async () => {
      try {
        let initialSnapshot;

        try {
          initialSnapshot = await getDocsFromServer(q);
          hasProcessedServerSnapshot = true;
        } catch (_) {
          initialSnapshot = await getDocs(q);
        }

        if (!isMounted) {
          return;
        }

        await hydrateStandings(initialSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));

        unsubscribe = onSnapshot(q, async (snapshot) => {
          if (hasProcessedServerSnapshot && snapshot.metadata.fromCache) {
            return;
          }

          hasProcessedServerSnapshot = true;
          await hydrateStandings(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
      } catch (_) {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeStandings();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [tournament?.id]);

  if (loading) return <Loading />;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Tabla de Posiciones</h2>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
          <span className="col-span-1 text-center">#</span>
          <span className="col-span-7">Participante</span>
          <span className="col-span-4 text-right">Puntos</span>
        </div>

        {standings.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p>No hay participantes activos aún</p>
          </div>
        ) : (
          standings.map((entry, index) => (
            <div
              key={entry.id}
              className={`grid grid-cols-12 px-4 py-4 border-b border-gray-100 dark:border-gray-700 last:border-0 items-center ${
                index === 0
                  ? 'bg-yellow-50 dark:bg-yellow-900/20'
                  : index === 1
                  ? 'bg-gray-50 dark:bg-gray-700/30'
                  : index === 2
                  ? 'bg-orange-50 dark:bg-orange-900/20'
                  : 'dark:bg-gray-800'
              }`}
            >
              <div className="col-span-1 text-center">
                <span className="text-gray-700 dark:text-gray-200 font-semibold">{entry.position}</span>
              </div>
              <div className="col-span-7 flex items-center gap-3">
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
              <div className="col-span-4 text-right">
                <span className="text-xl font-bold text-blue-700 dark:text-blue-400">{entry.points || 0}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">pts</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
