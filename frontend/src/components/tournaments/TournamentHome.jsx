import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useMatches } from '../../hooks/useMatches';
import { usePredictions } from '../../hooks/usePredictions';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Trophy, BarChart3, Users, Link2, Copy, Check, Share2 } from 'lucide-react';
import { FaFutbol } from 'react-icons/fa';
import toast from 'react-hot-toast';

export default function TournamentHome() {
  const { tournament } = useOutletContext();
  const { currentUser, userProfile } = useAuth();
  const { matches, loading: matchesLoading } = useMatches();
  const { predictions, loading: predictionsLoading } = usePredictions(tournament?.id);
  const [activeParticipants, setActiveParticipants] = useState(null);
  const [userRank, setUserRank] = useState(null);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(tournament.inviteCode);
    setCopied(true);
    toast.success('Código copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/dashboard?join=${tournament.inviteCode}`;
    const text = `¡Únete a mi torneo "${tournament.name}" en BIA Sports 2026! Usa el código: ${tournament.inviteCode} o haz clic aquí: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'BIA Sports 2026', text, url });
      } catch { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Enlace copiado al portapapeles');
    }
  };

  useEffect(() => {
    if (!tournament?.id) {
      setActiveParticipants(null);
      setParticipantsLoading(false);
      return;
    }

    setParticipantsLoading(true);
    const q = query(
      collection(db, 'participants'),
      where('tournamentId', '==', tournament.id),
      where('status', '==', 'active')
    );

    const unsub = onSnapshot(q, (snap) => {
      const parts = snap.docs.map((d) => d.data());
      setActiveParticipants(parts.length);
      const sorted = [...parts].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
      const idx = sorted.findIndex((p) => p.userId === currentUser?.uid);
      setUserRank(idx >= 0 ? idx + 1 : null);
      setParticipantsLoading(false);
    });

    return unsub;
  }, [tournament?.id]);

  const completedMatches = matches.filter((m) => m.status === 'finished').length;
  const totalPoints = predictions.reduce((sum, p) => sum + (p.points || 0), 0);

  const stats = [
    { label: 'Partidos jugados', value: matchesLoading ? null : completedMatches, Icon: FaFutbol },
    { label: 'Tus puntos', value: predictionsLoading ? null : totalPoints, Icon: Trophy },
    { label: 'Tus pronósticos', value: predictionsLoading ? null : predictions.length, Icon: BarChart3 },
    {
      label: 'Tu posición',
      value: participantsLoading ? null : (userRank != null ? `#${userRank}/${activeParticipants}` : '—'),
      Icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tournament Header */}
      <div className="bg-gradient-to-br from-blue-900 to-indigo-800 rounded-2xl p-8 text-white text-center">
        <img
          src="https://cdn.worldvectorlogo.com/logos/mundial-2026-world-cup.svg"
          alt="FIFA World Cup 2026"
          className="w-24 h-24 mx-auto mb-4 drop-shadow-lg"
        />
        <p className="text-blue-300 text-sm">FIFA World Cup 2026™</p>
      </div>

      {/* Welcome message */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5">
          <p className="text-gray-700 text-lg">
            Bienvenido, <span className="font-semibold">{userProfile?.displayName || currentUser?.email}</span>
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Haz tus predicciones antes de cada partido para acumular puntos.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <stat.Icon className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-800">
              {stat.value === null ? <span className="text-gray-300">—</span> : stat.value}
            </div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Invite code */}
      {tournament?.inviteCode && (
        <div className="bg-blue-50 dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1.5"><Link2 className="w-4 h-4" /> Invita a tus amigos</h3>
          <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">Comparte este código para unirse al torneo:</p>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-blue-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-slate-500 hover:bg-blue-50 dark:hover:bg-slate-600 rounded-lg px-4 py-2 transition group"
          >
            <code className="text-blue-900 dark:text-white font-mono font-bold text-xl tracking-widest">{tournament.inviteCode}</code>
            {copied
              ? <Check className="w-4 h-4 text-green-500" />
              : <Copy className="w-4 h-4 text-blue-400 group-hover:text-blue-600 dark:text-blue-300 dark:group-hover:text-blue-200" />}
          </button>
          <button
            onClick={handleShare}
            className="mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-4 py-2.5 transition text-sm w-full sm:w-auto"
          >
            <Share2 className="w-4 h-4" /> Compartir invitación
          </button>
        </div>
      )}
    </div>
  );
}
