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
import { Rocket, CircleHelp } from 'lucide-react';

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

  const getFieldError = (fieldName, value) => {
    switch (fieldName) {
      case 'name':
        return validateTournamentName(value);
      case 'description':
        return validateTournamentDescription(value);
      default:
        return null;
    }
  };

  const validateForm = () => {
    const nextErrors = {
      name: getFieldError('name', formData.name),
      description: getFieldError('description', formData.description),
    };

    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

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

    const normalizedTextValue = name === 'name'
      ? value.slice(0, FIELD_MAX_LENGTHS.tournamentName)
      : name === 'description'
        ? value.slice(0, FIELD_MAX_LENGTHS.tournamentDescription)
        : value;

    const nextValue = type === 'checkbox'
      ? checked
      : type === 'number'
        ? normalizedValue
        : normalizedTextValue;

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));

    if (type !== 'checkbox' && type !== 'number' && (name === 'name' || name === 'description')) {
      setErrors((prev) => ({
        ...prev,
        [name]: getFieldError(name, nextValue),
      }));
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

  if (!validateForm()) {
    toast.error('Corrige los campos marcados para continuar');
    return;
  }

  setLoading(true);

  try {
    const tournamentId = await createTournament({
      ...formData,
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
        <p className="text-gray-500 mt-1">Configura tu torneo de pronósticos del Mundial 2026</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Límite de participantes</label>
              <input
                type="number"
                name="maxUsers"
                value={formData.maxUsers}
                onChange={handleChange}
                min={2}
                max={500}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
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
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <div>
                <span className="text-sm font-medium text-gray-700">Requiere aprobación</span>
                <p className="text-xs text-gray-500">Los participantes deben ser aprobados por el admin</p>
              </div>
            </div>

          </div>
        </div>

        {/* Point Config */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-700">Configuración de puntos</h2>
            <button
              type="button"
              onClick={() => setShowScoringExample(true)}
              title="Ver ejemplo de puntaje"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-blue-300 hover:text-blue-600"
            >
              <CircleHelp className="w-4 h-4" />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3 items-stretch">
            <div className="flex flex-col">
              <label className="block min-h-[40px] text-sm font-medium text-gray-700 mb-1">
                Ganador o empate
              </label>
              <input
                type="number"
                value={formData.pointConfig.winner}
                onChange={(e) => handlePointChange('winner', e.target.value)}
                min={0}
                max={10}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center font-bold text-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="block min-h-[40px] text-sm font-medium text-gray-700 mb-1">
                Goles de cada equipo
              </label>
              <input
                type="number"
                value={formData.pointConfig.exact}
                onChange={(e) => handlePointChange('exact', e.target.value)}
                min={0}
                max={10}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center font-bold text-lg"
              />
            </div>
            <div className="flex flex-col">
              <label className="block min-h-[40px] text-sm font-medium text-gray-700 mb-1">
                Diferencia de goles
              </label>
              <input
                type="number"
                value={formData.pointConfig.difference}
                onChange={(e) => handlePointChange('difference', e.target.value)}
                min={0}
                max={10}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center font-bold text-lg"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Multiplicador segunda ronda</label>
            <input
              type="number"
              name="secondRoundMultiplier"
              value={formData.secondRoundMultiplier}
              onChange={handleChange}
              min={1}
              max={10}
              step={1}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            />
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
            {loading ? 'Creando...' : <><Rocket className="w-4 h-4 inline mr-1.5" /> Crear Torneo</>}
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

          <div className="rounded-lg bg-amber-50 px-4 py-4 border border-amber-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">Segunda ronda</p>
            <p className="text-sm text-gray-500 mb-3">Resultado ejemplo: 2 - 1 con multiplicador x{secondRoundMultiplier}</p>
            <div className="space-y-2 text-sm">
              <div className="rounded-md bg-white/80 px-3 py-2">
                <p className="font-medium text-gray-800">Pronóstico 2-1</p>
                <p className="text-xs text-amber-700">{exactTotalPoints} x {secondRoundMultiplier} = {exactTotalPoints * secondRoundMultiplier} pts</p>
              </div>
              <div className="rounded-md bg-white/80 px-3 py-2">
                <p className="font-medium text-gray-800">Pronóstico 1-0</p>
                <p className="text-xs text-amber-700">{differenceTotalPoints} x {secondRoundMultiplier} = {differenceTotalPoints * secondRoundMultiplier} pts</p>
              </div>
              <div className="rounded-md bg-white/80 px-3 py-2">
                <p className="font-medium text-gray-800">Pronóstico 4-1</p>
                <p className="text-xs text-amber-700">{(winnerBasePoints + exactBasePoints)} x {secondRoundMultiplier} = {(winnerBasePoints + exactBasePoints) * secondRoundMultiplier} pts</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
