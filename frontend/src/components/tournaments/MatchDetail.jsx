import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Loading from '../common/Loading';
import { formatColombiaTime } from '../../utils/helpers';

export default function MatchDetail() {
  const { matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const matchDoc = await getDoc(doc(db, 'matches', matchId));
      if (matchDoc.exists()) {
        setMatch({ id: matchDoc.id, ...matchDoc.data() });
      }

      const predsQuery = query(
        collection(db, 'predictions'),
        where('matchId', '==', matchId)
      );
      const predsSnap = await getDocs(predsQuery);
      setPredictions(predsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    load();
  }, [matchId]);

  if (loading) return <Loading />;
  if (!match) return <div className="text-center py-10 text-gray-500">Partido no encontrado</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-gradient-to-br from-blue-900 to-indigo-800 rounded-2xl p-8 text-white">
        <p className="text-blue-300 text-sm text-center mb-4">
          {match.round}{match.group ? ` · Grupo ${match.group}` : ''}
        </p>

        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            {match.homeTeamFlag && (
              <img src={match.homeTeamFlag} alt="" className="w-16 h-12 mx-auto mb-2 rounded" />
            )}
            <p className="font-bold text-xl">{match.homeTeam}</p>
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

          <div className="text-center flex-1">
            {match.awayTeamFlag && (
              <img src={match.awayTeamFlag} alt="" className="w-16 h-12 mx-auto mb-2 rounded" />
            )}
            <p className="font-bold text-xl">{match.awayTeam}</p>
          </div>
        </div>

        {match.stadium && (
          <p className="text-blue-300 text-sm text-center mt-4">📍 {match.stadium}</p>
        )}
      </div>

      {/* Predictions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">
          Pronósticos ({predictions.length})
        </h3>
        {predictions.length === 0 ? (
          <p className="text-gray-500 text-sm">Nadie ha pronosticado este partido aún.</p>
        ) : (
          <div className="space-y-2">
            {predictions.map((pred) => (
              <div
                key={pred.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-sm text-gray-600">{pred.userId}</span>
                <span className="font-semibold text-gray-800">
                  {pred.prediction?.homeScore} - {pred.prediction?.awayScore}
                </span>
                {pred.points !== null && (
                  <span className="text-sm font-medium text-green-600">{pred.points} pts</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
