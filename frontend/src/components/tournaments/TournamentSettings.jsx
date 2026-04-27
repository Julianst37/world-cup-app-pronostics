import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTournaments } from '../../hooks/useTournaments';
import { useMatches } from '../../hooks/useMatches';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../common/Modal';
import { getRoundDisplayName } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { Lock, Copy, Save, Link2, Check, CircleHelp } from 'lucide-react';

export default function TournamentSettings() {
  const { tournament, setTournament } = useOutletContext();
  const { updateTournament } = useTournaments();
  const { currentUser } = useAuth();
  const { matches } = useMatches();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showScoringExample, setShowScoringExample] = useState(false);
  const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));
  const [formData, setFormData] = useState({
    name: tournament?.name || '',
    description: tournament?.description || '',
    maxUsers: tournament?.maxUsers || 50,
    requiresApproval: tournament?.requiresApproval || false,
    secondRoundMultiplier: tournament?.secondRoundMultiplier || 2,
    predictionLockMinutes: tournament?.predictionLockMinutes || 10,
    pointConfig: tournament?.pointConfig || { exact: 3, difference: 2, winner: 1 },
  });
  const predictionLockTooltip = `El usuario podrá ingresar su pronóstico hasta ${formData.predictionLockMinutes || 10} minutos antes del partido`;

  const isAdmin = tournament?.adminId === currentUser?.uid;
  const groupStageExample = matches.find((match) => match.round === 'Group Stage') || matches[0] || null;
  const secondRoundExample = matches.find((match) => match.round && match.round !== 'Group Stage') || null;
  const exactBasePoints = formData.pointConfig.exact;
  const differenceBasePoints = formData.pointConfig.difference;
  const winnerBasePoints = formData.pointConfig.winner;
  const secondRoundMultiplier = formData.secondRoundMultiplier || 1;
  const exactTotalPoints = exactBasePoints * 2 + differenceBasePoints + winnerBasePoints;
  const differenceTotalPoints = differenceBasePoints + winnerBasePoints;

  if (!isAdmin) {
    return (
      <div className="text-center py-16 text-gray-500">
        <Lock className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p>Solo el administrador puede ver la configuración.</p>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'predictionLockMinutes') {
      if (value === '' || /^\d+$/.test(value)) {
        setFormData((prev) => ({ ...prev, predictionLockMinutes: value }));
      }
      return;
    }

    const numericValue = parseInt(value, 10) || 0;
    const normalizedValue = name === 'secondRoundMultiplier'
      ? clampValue(numericValue, 1, 10)
      : numericValue;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox'
        ? checked
        : type === 'number'
          ? normalizedValue
          : value,
    }));
  };

  const handlePredictionLockBlur = () => {
    const numericValue = parseInt(formData.predictionLockMinutes, 10);
    setFormData((prev) => ({
      ...prev,
      predictionLockMinutes: Number.isNaN(numericValue) ? 10 : clampValue(numericValue, 10, 60),
    }));
  };

  const handlePointChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      pointConfig: { ...prev.pointConfig, [key]: parseInt(value) || 0 },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const normalizedFormData = {
        ...formData,
        predictionLockMinutes: clampValue(parseInt(formData.predictionLockMinutes, 10) || 10, 10, 60),
      };
      await updateTournament(tournament.id, normalizedFormData);
      setTournament({ ...tournament, ...normalizedFormData });
      toast.success('Configuración guardada');
    } catch {
      toast.error('Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(tournament.inviteCode);
    setCopied(true);
    toast.success('Código copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Configuración del Torneo</h2>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-stretch">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Límite de participantes</label>
            <input
              type="number"
              name="maxUsers"
              value={formData.maxUsers}
              onChange={handleChange}
              min={2}
              max={500}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="requiresApproval"
                checked={formData.requiresApproval}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">Requiere aprobación de admin</span>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Puntos por predicción</h3>
              <button
                type="button"
                title="Ver ejemplo de puntuación"
                onClick={() => setShowScoringExample(true)}
                className="text-gray-400 hover:text-gray-600 transition"
                aria-label="Ver ejemplo de puntuación"
              >
                <CircleHelp className="w-4 h-4" />
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-3 items-stretch">
              {[
                { key: 'winner', label: 'Ganador o empate' },
                { key: 'exact', label: 'Goles por equipo' },
                { key: 'difference', label: 'Diferencia de goles' },
              ].map(({ key, label }) => (
                <div key={key} className="flex flex-col">
                  <label className="block min-h-[40px] text-xs text-gray-500 mb-1">{label}</label>
                  <input
                    type="number"
                    value={formData.pointConfig[key]}
                    onChange={(e) => handlePointChange(key, e.target.value)}
                    min={0}
                    max={10}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center font-bold text-lg"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <span>Multiplicador segunda ronda</span>
                <span
                  title={`A partir de la segunda ronda (Ronda de 32, 16avos, Cuartos de final, Semifinales, 3er puesto y Final), los puntos obtenidos se multiplicarán x${formData.secondRoundMultiplier}`}
                  className="text-gray-400 hover:text-gray-600 cursor-help"
                >
                  <CircleHelp className="w-4 h-4" />
                </span>
              </label>
              <input
                type="number"
                name="secondRoundMultiplier"
                value={formData.secondRoundMultiplier}
                onChange={handleChange}
                min={1}
                max={10}
                step={1}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <span>Minutos bloqueo de pronóstico</span>
                <span
                  title={predictionLockTooltip}
                  className="text-gray-400 hover:text-gray-600 cursor-help"
                >
                  <CircleHelp className="w-4 h-4" />
                </span>
              </label>
              <input
                type="number"
                name="predictionLockMinutes"
                value={formData.predictionLockMinutes}
                onChange={handleChange}
                onBlur={handlePredictionLockBlur}
                min={10}
                max={60}
                step={1}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Guardando...' : <><Save className="w-4 h-4 inline mr-1.5" /> Guardar Cambios</>}
          </button>
        </form>

        <div className="flex h-full flex-col gap-4">
          {tournament?.inviteCode && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
              <h3 className="font-semibold text-blue-800 mb-1 flex items-center gap-1.5">
                <Link2 className="w-4 h-4" /> Código de invitación
              </h3>
              <p className="text-sm text-blue-600 mb-2">Comparte este código para unirse al torneo:</p>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex w-full items-center justify-between gap-2 bg-white border border-blue-300 hover:border-blue-500 hover:bg-blue-50 rounded-lg px-4 py-3 transition group"
              >
                <code className="text-blue-900 font-mono font-bold text-xl tracking-widest">{tournament.inviteCode}</code>
                {copied
                  ? <Check className="w-4 h-4 text-green-500 shrink-0" />
                  : <Copy className="w-4 h-4 text-blue-400 group-hover:text-blue-600 shrink-0" />}
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showScoringExample}
        onClose={() => setShowScoringExample(false)}
        title="Ejemplo de puntuación"
        size="lg"
      >
        <div className="space-y-4 text-left">
          <p className="text-sm text-gray-600">Ejemplos usando partidos existentes y la configuración actual.</p>

          {groupStageExample && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Fase de grupos</p>
              <p className="font-medium text-gray-800">{groupStageExample.homeTeam} vs {groupStageExample.awayTeam}</p>
              <p className="text-sm text-gray-500 mb-3">Resultado ejemplo: 2 - 1</p>
              <div className="space-y-2 text-sm">
                <div className="rounded-md bg-white/70 px-3 py-2">
                  <p className="font-medium text-gray-800">Pronóstico 2-1</p>
                  <p className="text-xs text-blue-700">{winnerBasePoints} + {differenceBasePoints} + ({exactBasePoints} x 2) = {exactTotalPoints} pts</p>
                </div>
                <div className="rounded-md bg-white/70 px-3 py-2">
                  <p className="font-medium text-gray-800">Pronóstico 1-0</p>
                  <p className="text-xs text-blue-700">{winnerBasePoints} + {differenceBasePoints} = {differenceTotalPoints} pts</p>
                </div>
                <div className="rounded-md bg-white/70 px-3 py-2">
                  <p className="font-medium text-gray-800">Pronóstico 3-1</p>
                  <p className="text-xs text-blue-700">{winnerBasePoints} + {exactBasePoints} = {winnerBasePoints + exactBasePoints} pts</p>
                </div>
                <div className="rounded-md bg-white/70 px-3 py-2">
                  <p className="font-medium text-gray-800">Pronóstico 4-2</p>
                  <p className="text-xs text-blue-700">{winnerBasePoints} pts</p>
                </div>
              </div>
            </div>
          )}

          {secondRoundExample && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Segunda ronda</p>
              <p className="font-medium text-gray-800">{secondRoundExample.homeTeam} vs {secondRoundExample.awayTeam}</p>
              <p className="text-sm text-gray-500 mb-1">{getRoundDisplayName(secondRoundExample.round)}</p>
              <p className="text-sm text-gray-500 mb-3">Resultado ejemplo: 2 - 1 con multiplicador x{secondRoundMultiplier}</p>
              <div className="space-y-2 text-sm">
                <div className="rounded-md bg-white/70 px-3 py-2">
                  <p className="font-medium text-gray-800">Pronóstico 2-1</p>
                  <p className="text-xs text-amber-700">{exactTotalPoints} x {secondRoundMultiplier} = {exactTotalPoints * secondRoundMultiplier} pts</p>
                </div>
                <div className="rounded-md bg-white/70 px-3 py-2">
                  <p className="font-medium text-gray-800">Pronóstico 1-0</p>
                  <p className="text-xs text-amber-700">{differenceTotalPoints} x {secondRoundMultiplier} = {differenceTotalPoints * secondRoundMultiplier} pts</p>
                </div>
                <div className="rounded-md bg-white/70 px-3 py-2">
                  <p className="font-medium text-gray-800">Pronóstico 3-1</p>
                  <p className="text-xs text-amber-700">{winnerBasePoints} x {secondRoundMultiplier} = {winnerBasePoints * secondRoundMultiplier} pts</p>
                </div>
                <div className="rounded-md bg-white/70 px-3 py-2">
                  <p className="font-medium text-gray-800">Pronóstico 4-1</p>
                  <p className="text-xs text-amber-700">{winnerBasePoints + exactBasePoints} x {secondRoundMultiplier} = {(winnerBasePoints + exactBasePoints) * secondRoundMultiplier} pts</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
