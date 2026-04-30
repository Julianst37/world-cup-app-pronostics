import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTournaments } from '../../hooks/useTournaments';
import { useMatches } from '../../hooks/useMatches';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../common/Modal';
import { getRoundDisplayName } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { Lock, Copy, Save, Link2, Check, CircleHelp, Share2 } from 'lucide-react';

export default function TournamentSettings() {
  const { tournament, setTournament } = useOutletContext();
  const { updateTournament } = useTournaments();
  const { currentUser } = useAuth();
  const { matches } = useMatches();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showScoringExample, setShowScoringExample] = useState(false);
  const [errors, setErrors] = useState({});
  const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));
  const [formData, setFormData] = useState({
    name: tournament?.name || '',
    description: tournament?.description || '',
    limitParticipants: tournament?.maxUsers != null && tournament?.maxUsers !== 0,
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

  const validateField = (name, value) => {
    switch (name) {
      case 'name':
        if (!value || !value.trim()) return 'El nombre del torneo es obligatorio';
        if (value.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres';
        if (value.trim().length > 60) return 'El nombre no puede superar los 60 caracteres';
        return null;
      case 'maxUsers': {
        if (!formData.limitParticipants) return null;
        if (value === '' || value === null || value === undefined) return 'El límite de participantes es obligatorio';
        const n = parseInt(value, 10);
        if (isNaN(n)) return 'El límite de participantes es obligatorio';
        if (n < 2) return 'Debe haber al menos 2 participantes';
        if (n > 500) return 'El límite máximo es 500 participantes';
        return null;
      }
      case 'secondRoundMultiplier': {
        if (value === '' || value === null || value === undefined) return 'El multiplicador es obligatorio';
        const n = parseInt(value, 10);
        if (isNaN(n)) return 'El multiplicador es obligatorio';
        if (n < 1) return 'El multiplicador debe ser al menos 1';
        if (n > 10) return 'El multiplicador no puede ser mayor a 10';
        return null;
      }
      case 'predictionLockMinutes': {
        if (value === '' || value === null || value === undefined) return 'El tiempo de bloqueo es obligatorio';
        const n = parseInt(value, 10);
        if (isNaN(n)) return 'El tiempo de bloqueo es obligatorio';
        if (n < 10) return 'El mínimo es 10 minutos';
        if (n > 60) return 'El máximo es 60 minutos';
        return null;
      }
      default:
        return null;
    }
  };

  const validateAll = () => {
    const next = {
      name: validateField('name', formData.name),
      maxUsers: validateField('maxUsers', formData.maxUsers),
      secondRoundMultiplier: validateField('secondRoundMultiplier', formData.secondRoundMultiplier),
      predictionLockMinutes: validateField('predictionLockMinutes', formData.predictionLockMinutes),
    };
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // For all number fields: allow free typing (including empty), only validate on submit
    if (type === 'number' || name === 'predictionLockMinutes' || name === 'secondRoundMultiplier' || name === 'maxUsers') {
      if (value === '' || /^\d+$/.test(value)) {
        setFormData((prev) => ({ ...prev, [name]: value }));
        // Only show error if there's already a value that's out of range; clear error when empty
        if (value !== '') {
          setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
        } else {
          setErrors((prev) => ({ ...prev, [name]: null }));
        }
      }
      return;
    }

    const newValue = type === 'checkbox' ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: newValue }));
    if (name !== 'description' && name !== 'requiresApproval' && name !== 'limitParticipants') {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, newValue) }));
    }
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
    if (!validateAll()) return;
    setLoading(true);
    try {
      const normalizedFormData = {
        ...formData,
        maxUsers: formData.limitParticipants ? (parseInt(formData.maxUsers, 10) || 50) : null,
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

  const handleShare = async () => {
    const text = `¡Únete a mi torneo "${tournament.name}" en BIA Sports 2026! Usa el código: ${tournament.inviteCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'BIA Sports 2026', text });
      } catch { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Enlace copiado al portapapeles');
    }
  };

  return (
    <div className="max-w-5xl">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Configuración del Torneo</h2>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-stretch">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${errors.name ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
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
                <span>Multiplicador segunda ronda <span className="text-red-500">*</span></span>
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
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${errors.secondRoundMultiplier ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`}
              />
              {errors.secondRoundMultiplier && <p className="mt-1 text-sm text-red-600">{errors.secondRoundMultiplier}</p>}
            </div>
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <span>Minutos bloqueo de pronóstico <span className="text-red-500">*</span></span>
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
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${errors.predictionLockMinutes ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`}
              />
              {errors.predictionLockMinutes && <p className="mt-1 text-sm text-red-600">{errors.predictionLockMinutes}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="limitParticipants"
                checked={formData.limitParticipants}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">Limitar participantes</span>
          </div>

          {formData.limitParticipants && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Límite de participantes <span className="text-red-500">*</span></label>
              <input
                type="number"
                name="maxUsers"
                value={formData.maxUsers}
                onChange={handleChange}
                min={2}
                max={500}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${errors.maxUsers ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`}
              />
              {errors.maxUsers && <p className="mt-1 text-sm text-red-600">{errors.maxUsers}</p>}
            </div>
          )}

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
            <div className="bg-blue-50 dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-slate-700 p-5">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1.5">
                <Link2 className="w-4 h-4" /> Código de invitación
              </h3>
              <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">Comparte este código para unirse al torneo:</p>
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex w-full items-center justify-between gap-2 bg-white dark:bg-slate-700 border border-blue-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-slate-500 hover:bg-blue-50 dark:hover:bg-slate-600 rounded-lg px-4 py-3 transition group"
              >
                <code className="text-blue-900 dark:text-white font-mono font-bold text-xl tracking-widest">{tournament.inviteCode}</code>
                {copied
                  ? <Check className="w-4 h-4 text-green-500 shrink-0" />
                  : <Copy className="w-4 h-4 text-blue-400 group-hover:text-blue-600 dark:text-blue-300 dark:group-hover:text-blue-200 shrink-0" />}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="mt-2 flex w-full items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-4 py-2.5 transition text-sm"
              >
                <Share2 className="w-4 h-4" /> Compartir invitación
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
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">Segunda ronda</p>
              <p className="font-medium text-gray-800 dark:text-gray-100">{secondRoundExample.homeTeam} vs {secondRoundExample.awayTeam}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{getRoundDisplayName(secondRoundExample.round)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">El resultado se evalúa sobre los <span className="font-semibold text-gray-700 dark:text-gray-300">90 minutos reglamentarios</span>, sin tiempo extra ni penales.</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Resultado ejemplo: 2 - 1 con multiplicador x{secondRoundMultiplier}</p>
              <div className="space-y-2 text-sm">
                <div className="rounded-md bg-white dark:bg-slate-700 px-3 py-2">
                  <p className="font-medium text-gray-800 dark:text-gray-100">Pronóstico 2-1</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">{exactTotalPoints} x {secondRoundMultiplier} = {exactTotalPoints * secondRoundMultiplier} pts</p>
                </div>
                <div className="rounded-md bg-white dark:bg-slate-700 px-3 py-2">
                  <p className="font-medium text-gray-800 dark:text-gray-100">Pronóstico 1-0</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">{differenceTotalPoints} x {secondRoundMultiplier} = {differenceTotalPoints * secondRoundMultiplier} pts</p>
                </div>
                <div className="rounded-md bg-white dark:bg-slate-700 px-3 py-2">
                  <p className="font-medium text-gray-800 dark:text-gray-100">Pronóstico 3-1</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">{winnerBasePoints} x {secondRoundMultiplier} = {winnerBasePoints * secondRoundMultiplier} pts</p>
                </div>
                <div className="rounded-md bg-white dark:bg-slate-700 px-3 py-2">
                  <p className="font-medium text-gray-800 dark:text-gray-100">Pronóstico 4-1</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">{winnerBasePoints + exactBasePoints} x {secondRoundMultiplier} = {(winnerBasePoints + exactBasePoints) * secondRoundMultiplier} pts</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
