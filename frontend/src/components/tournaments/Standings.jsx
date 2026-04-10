import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Loading from '../common/Loading';

export default function Standings() {
  const { tournament } = useOutletContext();
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournament?.id) return;

    const q = query(
      collection(db, 'participants'),
      where('tournamentId', '==', tournament.id),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const participants = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Fetch user profiles
      const withProfiles = await Promise.all(
        participants.map(async (p) => {
          const userDoc = await getDoc(doc(db, 'users', p.userId));
          return {
            ...p,
            user: userDoc.exists() ? userDoc.data() : { displayName: 'Usuario', username: '' },
          };
        })
      );

      // Sort by points descending
      withProfiles.sort((a, b) => (b.points || 0) - (a.points || 0));
      setStandings(withProfiles);
      setLoading(false);
    });

    return unsubscribe;
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
            <span className="text-4xl block mb-2">🏆</span>
            <p>No hay participantes activos aún</p>
          </div>
        ) : (
          standings.map((entry, index) => (
            <div
              key={entry.id}
              className={`grid grid-cols-12 px-4 py-4 border-b border-gray-100 last:border-0 items-center ${
                index === 0 ? 'bg-yellow-50' : index === 1 ? 'bg-gray-50' : index === 2 ? 'bg-orange-50' : ''
              }`}
            >
              <div className="col-span-1 text-center">
                {index === 0 ? (
                  <span className="text-xl">🥇</span>
                ) : index === 1 ? (
                  <span className="text-xl">🥈</span>
                ) : index === 2 ? (
                  <span className="text-xl">🥉</span>
                ) : (
                  <span className="text-gray-500 font-medium">{index + 1}</span>
                )}
              </div>
              <div className="col-span-7">
                <p className="font-semibold text-gray-800">{entry.user?.displayName}</p>
                <p className="text-xs text-gray-500">@{entry.user?.username}</p>
              </div>
              <div className="col-span-4 text-right">
                <span className="text-xl font-bold text-blue-700">{entry.points || 0}</span>
                <span className="text-xs text-gray-500 ml-1">pts</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
