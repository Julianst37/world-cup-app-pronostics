import { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useMatches } from '../../hooks/useMatches';
import { usePredictions } from '../../hooks/usePredictions';
import Loading from '../common/Loading';
import Modal from '../common/Modal';
import { formatColombiaTime } from '../../utils/helpers';

function PredictionModal({ match, prediction, onSave, onClose }) {
  const [home, setHome] = useState(prediction?.prediction?.homeScore ?? '');
  const [away, setAway] = useState(prediction?.prediction?.awayScore ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (home === '' || away === '') return;
    setSaving(true);
    await onSave(match.id || match.matchId, parseInt(home), parseInt(away));
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
        <div className="text-center flex-1">
          {match.homeTeamFlag && (
            <img src={match.homeTeamFlag} alt="" className="w-10 h-7 mx-auto mb-1 rounded" />
          )}
          <p className="font-semibold text-gray-800">{match.homeTeam}</p>
        </div>
        <div className="text-center px-4">
          <span className="text-gray-400 font-bold text-xl">VS</span>
        </div>
        <div className="text-center flex-1">
          {match.awayTeamFlag && (
            <img src={match.awayTeamFlag} alt="" className="w-10 h-7 mx-auto mb-1 rounded" />
          )}
          <p className="font-semibold text-gray-800">{match.awayTeam}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
          Tu pronóstico
        </label>
        <div className="flex items-center justify-center gap-4">
          <input
            type="number"
            value={home}
            onChange={(e) => setHome(e.target.value)}
            min={0}
            max={20}
            className="w-20 h-16 text-center text-3xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <span className="text-2xl font-bold text-gray-400">-</span>
          <input
            type="number"
            value={away}
            onChange={(e) => setAway(e.target.value)}
            min={0}
            max={20}
            className="w-20 h-16 text-center text-3xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || home === '' || away === ''}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
      >
        {saving ? 'Guardando...' : '💾 Guardar Pronóstico'}
      </button>
    </div>
  );
}

export default function PredictionsList() {
  const { tournament } = useOutletContext();
  const { matches, loading } = useMatches();
  const { predictions, savePrediction, getPredictionForMatch } = usePredictions(tournament?.id);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  if (loading) return <Loading />;

  const rounds = ['all', ...new Set(matches.map((m) => m.round))];
  const filteredMatches = filter === 'all' ? matches : matches.filter((m) => m.round === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Pronósticos</h2>
        <div className="text-sm text-gray-500">{predictions.length} guardados</div>
      </div>

      {/* Round filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {rounds.map((round) => (
          <button
            key={round}
            onClick={() => setFilter(round)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
              filter === round
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {round === 'all' ? 'Todos' : round}
          </button>
        ))}
      </div>

      {/* Matches list */}
      <div className="space-y-3">
        {filteredMatches.map((match) => {
          const matchId = match.id || match.matchId;
          const prediction = getPredictionForMatch(matchId);
          const isPast = new Date(match.date) < new Date();

          return (
            <div
              key={matchId}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  {match.round}{match.group ? ` · Grupo ${match.group}` : ''}
                </span>
                <span className="text-xs text-gray-500">
                  {formatColombiaTime(match.date, match.time)}
                </span>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-1">
                  {match.homeTeamFlag && (
                    <img src={match.homeTeamFlag} alt="" className="w-7 h-5 rounded" />
                  )}
                  <span className="font-semibold text-gray-800 text-sm">{match.homeTeam}</span>
                </div>

                <div className="text-center px-3">
                  {match.status === 'finished' ? (
                    <span className="font-bold text-gray-800">
                      {match.homeScore} - {match.awayScore}
                    </span>
                  ) : (
                    <span className="text-gray-400 font-bold">VS</span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className="font-semibold text-gray-800 text-sm">{match.awayTeam}</span>
                  {match.awayTeamFlag && (
                    <img src={match.awayTeamFlag} alt="" className="w-7 h-5 rounded" />
                  )}
                </div>
              </div>

              {match.stadium && (
                <p className="text-xs text-gray-400 mb-3">📍 {match.stadium}</p>
              )}

              <div className="flex items-center justify-between">
                {prediction ? (
                  <span className="text-sm text-blue-600 font-medium">
                    Tu pronóstico: {prediction.prediction.homeScore} - {prediction.prediction.awayScore}
                    {prediction.points !== null && (
                      <span className="ml-2 text-green-600">({prediction.points} pts)</span>
                    )}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">Sin pronóstico</span>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/matches/${matchId}`)}
                    className="text-xs text-gray-500 hover:text-gray-700 transition"
                  >
                    Ver detalles
                  </button>
                  {!isPast && (
                    <button
                      onClick={() => setSelectedMatch(match)}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition"
                    >
                      {prediction ? 'Editar' : 'Pronosticar'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedMatch && (
        <Modal
          isOpen={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          title={`${selectedMatch.homeTeam} vs ${selectedMatch.awayTeam}`}
        >
          <PredictionModal
            match={selectedMatch}
            prediction={getPredictionForMatch(selectedMatch.id || selectedMatch.matchId)}
            onSave={savePrediction}
            onClose={() => setSelectedMatch(null)}
          />
        </Modal>
      )}
    </div>
  );
}
