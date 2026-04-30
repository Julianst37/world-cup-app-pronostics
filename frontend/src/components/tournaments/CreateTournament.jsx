import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournaments } from '../../hooks/useTournaments';
import Modal from '../common/Modal';
import {
  FIELD_MAX_LENGTHS,
  validateTournamentDescription,
  validateTournamentName,
} from '../../utils/validators';
import toast from 'react-hot-toast';
import { CircleHelp } from 'lucide-react';

export default function CreateTournament() {
  const { createTournament } = useTournaments();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showScoringExample, setShowScoringExample] = useState(false);
  const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    limitParticipants: false,
    maxUsers: 50,
    requiresApproval: false,
    secondRoundMultiplier: 2,
    predictionLockMinutes: 10,
    pointConfig: {
      exact: 3,
      difference: 2,
      winner: 1,
    },
  });
  const predictionLockTooltip = `El usuario podrá ingresar su pronóstico hasta ${formData.predictionLockMinutes || 10} minutos antes del partido`;
  const exactBasePoints = formData.pointConfig.exact;
  const differenceBasePoints = formData.pointConfig.difference;
  const winnerBasePoints = formData.pointConfig.winner;
  const secondRoundMultiplier = formData.secondRoundMultiplier || 1;
  const exactTotalPoints = exactBasePoints * 2 + differenceBasePoints + winnerBasePoints;
  const differenceTotalPoints = differenceBasePoints + winnerBasePoints;

  const validateField = (name, value) => {
    switch (name) {
      case 'name':
        return validateTournamentName(value);
      case 'description':
        return validateTournamentDescription(value);
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

    if (type === 'number' || name === 'predictionLockMinutes' || name === 'secondRoundMultiplier' || name === 'maxUsers') {
      if (value === '' || /^\d+$/.test(value)) {
        setFormData((prev) => ({ ...prev, [name]: value }));
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
      pointConfig: {
        ...prev.pointConfig,
        [key]: parseInt(value) || 0,
      },
    }));
  };

 const handleSubmit = async (e) => {
  e.preventDefault();

  if (!validateAll()) {
    toast.error('Corrige los campos marcados para continuar');
    return;
  }

  setLoading(true);

  try {
    const tournamentId = await createTournament({
      ...formData,
      maxUsers: formData.limitParticipants ? (parseInt(formData.maxUsers, 10) || 50) : null,
      predictionLockMinutes: clampValue(parseInt(formData.predictionLockMinutes, 10) || 10, 10, 60),
    });
    toast.success('¡Torneo creado exitosamente!');
    navigate(`/tournaments/${tournamentId}/home`);
  } catch (error) {
    toast.error('Error al crear el torneo: ' + error.message);
    setLoading(false);
  }
};

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Crear Torneo</h1>
        <p className="text-gray-500 mt-1">Configura tu torneo de pronósticos de BIA Sports 2026</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Basic Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Información básica</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del torneo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                maxLength={FIELD_MAX_LENGTHS.tournamentName}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                  errors.name ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
                }`}
                placeholder="Ej: Torneo Oficina 2026"
              />
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className={`text-xs ${errors.name ? 'text-red-500' : 'text-gray-400'}`}>
                  {errors.name || 'Ingresa un nombre claro para identificar el torneo'}
                </p>
                <span className="text-xs text-gray-400">{formData.name.length}/{FIELD_MAX_LENGTHS.tournamentName}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                maxLength={FIELD_MAX_LENGTHS.tournamentDescription}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none ${
                  errors.description ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
                }`}
                placeholder="Describe tu torneo..."
              />
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className={`text-xs ${errors.description ? 'text-red-500' : 'text-gray-400'}`}>
                  {errors.description || 'Puedes agregar una descripción breve para los participantes'}
                </p>
                <span className="text-xs text-gray-400">{formData.description.length}/{FIELD_MAX_LENGTHS.tournamentDescription}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Point Config */}
        <div>
          <div className="mb-3 flex items-center gap-2">
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

        {/* Toggles */}
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
          <div>
            <span className="text-sm font-medium text-gray-700">Requiere aprobación de admin</span>
            <p className="text-xs text-gray-500">Los participantes deben ser aprobados por el admin</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-3 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Creando...' : <><span className="mr-1.5">⚽</span> Crear Torneo</>}
          </button>
        </div>
      </form>

      <Modal
        isOpen={showScoringExample}
        onClose={() => setShowScoringExample(false)}
        title="Ejemplo de puntuación"
        size="lg"
      >
        <div className="space-y-4 text-left">
          <p className="text-sm text-gray-500">Vista previa usando la configuración actual.</p>

          <div className="rounded-lg bg-gray-50 px-4 py-4 border border-gray-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Fase de grupos</p>
            <p className="text-sm text-gray-500 mb-3">Resultado ejemplo: 2 - 1</p>
            <div className="space-y-2 text-sm">
              <div className="rounded-md bg-white px-3 py-2 border border-gray-200">
                <p className="font-medium text-gray-800">Pronóstico 2-1</p>
                <p className="text-xs text-blue-700">{winnerBasePoints} + {differenceBasePoints} + ({exactBasePoints} x 2) = {exactTotalPoints} pts</p>
              </div>
              <div className="rounded-md bg-white px-3 py-2 border border-gray-200">
                <p className="font-medium text-gray-800">Pronóstico 1-0</p>
                <p className="text-xs text-blue-700">{winnerBasePoints} + {differenceBasePoints} = {differenceTotalPoints} pts</p>
              </div>
              <div className="rounded-md bg-white px-3 py-2 border border-gray-200">
                <p className="font-medium text-gray-800">Pronóstico 4-1</p>
                <p className="text-xs text-blue-700">{winnerBasePoints} + {exactBasePoints} = {winnerBasePoints + exactBasePoints} pts</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-4 border border-amber-200 dark:border-amber-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">Segunda ronda</p>
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
                <p className="font-medium text-gray-800 dark:text-gray-100">Pronóstico 4-1</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">{(winnerBasePoints + exactBasePoints)} x {secondRoundMultiplier} = {(winnerBasePoints + exactBasePoints) * secondRoundMultiplier} pts</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
