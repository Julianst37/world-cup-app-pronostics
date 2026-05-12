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
  const [scoringTab, setScoringTab] = useState('primera');
  const [showPrizesModal, setShowPrizesModal] = useState(false);
  const [prizeData, setPrizeData] = useState({ totalAmount: '', winnersCount: 1, distribution: [{ position: 1, type: 'fixed', value: '' }] });
  const [prizeError, setPrizeError] = useState('');
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
      exact: 2,
      difference: 1,
      winner: 5,
    },
    hasPrizes: false,
    prizeConfig: null,
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

    if (name === 'hasPrizes') {
      setFormData((prev) => ({ ...prev, hasPrizes: checked, prizeConfig: checked ? prev.prizeConfig : null }));
      if (checked) {
        setPrizeData(formData.prizeConfig ? { ...formData.prizeConfig } : { totalAmount: '', winnersCount: 1, distribution: [{ position: 1, type: 'fixed', value: '' }] });
        setPrizeError('');
        setShowPrizesModal(true);
      }
      return;
    }
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

  const ORDINALS = ['Primer','Segundo','Tercer','Cuarto','Quinto','Sexto','S\u00e9ptimo','Octavo','Noveno','D\u00e9cimo','Und\u00e9cimo','Duod\u00e9cimo','D\u00e9cimo tercero','D\u00e9cimo cuarto','D\u00e9cimo quinto','D\u00e9cimo sexto','D\u00e9cimo s\u00e9ptimo','D\u00e9cimo octavo','D\u00e9cimo noveno','Vig\u00e9simo'];
  const fmtCOP = (v) => { const n = Number(v); return isNaN(n) ? '0' : n.toLocaleString('es-CO'); };

  const handleWinnersCountChange = (val) => {
    const count = Math.max(1, Math.min(20, parseInt(val) || 1));
    setPrizeData((prev) => {
      const existing = prev.distribution || [];
      const newDist = Array.from({ length: count }, (_, i) =>
        existing[i] ? { ...existing[i], position: i + 1 } : { position: i + 1, type: 'fixed', value: '' }
      );
      return { ...prev, winnersCount: count, distribution: newDist };
    });
  };

  const handleDistributionChange = (idx, field, val) => {
    setPrizeData((prev) => {
      const dist = [...prev.distribution];
      dist[idx] = { ...dist[idx], [field]: val };
      return { ...prev, distribution: dist };
    });
  };

  const handleSavePrizes = () => {
    const total = parseFloat(prizeData.totalAmount);
    if (!total || total <= 0) { setPrizeError('El monto total debe ser mayor a 0'); return; }
    let totalAssigned = 0;
    for (const item of prizeData.distribution) {
      const val = parseFloat(item.value);
      if (!val || val <= 0) { setPrizeError(`El valor del ${ORDINALS[item.position - 1]} puesto no es v\u00e1lido`); return; }
      if (item.type === 'fixed') {
        if (val > total) { setPrizeError(`El valor del ${ORDINALS[item.position - 1]} puesto ($${fmtCOP(val)}) supera el monto total`); return; }
        totalAssigned += val;
      } else {
        if (val > 100) { setPrizeError(`El porcentaje del ${ORDINALS[item.position - 1]} puesto no puede superar 100%`); return; }
        totalAssigned += (val * total) / 100;
      }
    }
    if (totalAssigned > total + 0.01) {
      setPrizeError(`La suma de los premios ($${fmtCOP(Math.round(totalAssigned))}) supera el monto total ($${fmtCOP(total)})`);
      return;
    }
    setFormData((prev) => ({ ...prev, prizeConfig: { totalAmount: total, winnersCount: prizeData.winnersCount, distribution: prizeData.distribution } }));
    setShowPrizesModal(false);
    setPrizeError('');
    toast.success('Premios configurados');
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
      prizeConfig: formData.hasPrizes ? formData.prizeConfig : null,
    });
    toast.success('¡Polla creada exitosamente!');
    navigate(`/tournaments/${tournamentId}/home`);
  } catch (error) {
    toast.error('Error al crear la polla: ' + error.message);
    setLoading(false);
  }
};

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Crear Polla</h1>
        <p className="text-gray-500 mt-1">Configura tu polla de pronósticos de BIA Sports 2026</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Basic Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Información básica</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la polla <span className="text-red-500">*</span>
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
                placeholder="Ej: Polla Oficina 2026"
              />
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className={`text-xs ${errors.name ? 'text-red-500' : 'text-gray-400'}`}>
                  {errors.name || 'Ingresa un nombre claro para identificar la polla'}
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
                placeholder="Describe tu polla..."
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
            <span
              onClick={() => setShowScoringExample(true)}
              className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-2 py-0.5 rounded transition select-none"
            >
              Ver ejemplo
            </span>
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

        <div className="flex items-start gap-3">
          <label className="relative inline-flex items-center cursor-pointer mt-0.5">
            <input
              type="checkbox"
              name="hasPrizes"
              checked={formData.hasPrizes}
              onChange={handleChange}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-700">Definir premios</span>
            <p className="text-xs text-gray-500 mt-0.5">Configura el premio y la distribución entre los ganadores de la polla.</p>
            {formData.hasPrizes && (
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setPrizeData(formData.prizeConfig ? { ...formData.prizeConfig } : { totalAmount: '', winnersCount: 1, distribution: [{ position: 1, type: 'fixed', value: '' }] });
                    setPrizeError('');
                    setShowPrizesModal(true);
                  }}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg transition"
                >
                  {formData.prizeConfig ? 'Editar premios' : 'Configurar premios'}
                </button>
                {formData.prizeConfig && (
                  <span className="text-xs text-gray-500">
                    Total: <span className="font-semibold text-gray-700">${fmtCOP(formData.prizeConfig.totalAmount)}</span> · {formData.prizeConfig.winnersCount} ganador{formData.prizeConfig.winnersCount !== 1 ? 'es' : ''}
                  </span>
                )}
              </div>
            )}
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
            {loading ? 'Creando...' : 'Crear Polla'}
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

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setScoringTab('primera')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${scoringTab === 'primera' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Primera ronda
            </button>
            {secondRoundMultiplier > 1 && (
              <button
                onClick={() => setScoringTab('segunda')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${scoringTab === 'segunda' ? 'border-amber-600 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Segunda ronda (×{secondRoundMultiplier})
              </button>
            )}
          </div>

          {scoringTab === 'primera' && <>
            <div className="rounded-lg bg-gray-50 px-4 py-4 border border-gray-200 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resultado real: 2-1 (local gana)</p>
            {[
              { pred: '2-1', pts: exactTotalPoints, items: [
                { pts: winnerBasePoints, label: 'Acertaste el ganador (local)', ok: true },
                { pts: differenceBasePoints, label: 'Acertaste la diferencia de goles (1)', ok: true },
                { pts: exactBasePoints * 2, label: 'Acertaste los goles del local (2) y del visitante (1)', ok: true },
              ]},
              { pred: '1-0', pts: differenceTotalPoints, items: [
                { pts: winnerBasePoints, label: 'Acertaste el ganador (local)', ok: true },
                { pts: differenceBasePoints, label: 'Acertaste la diferencia de goles (1)', ok: true },
                { pts: 0, label: 'Goles exactos no coinciden (1≠2, 0≠1)', ok: false },
              ]},
              { pred: '3-1', pts: winnerBasePoints + exactBasePoints, items: [
                { pts: winnerBasePoints, label: 'Acertaste el ganador (local)', ok: true },
                { pts: 0, label: 'Diferencia de goles incorrecta (2≠1)', ok: false },
                { pts: exactBasePoints, label: 'Acertaste los goles del visitante (1)', ok: true },
              ]},
              { pred: '4-2', pts: winnerBasePoints, items: [
                { pts: winnerBasePoints, label: 'Acertaste el ganador (local)', ok: true },
                { pts: 0, label: 'Diferencia de goles incorrecta (2≠1)', ok: false },
                { pts: 0, label: 'Goles exactos no coinciden', ok: false },
              ]},
            ].map(({ pred, pts, items }) => (
              <div key={pred} className="rounded-md bg-white px-3 py-2.5 border border-gray-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm text-gray-800">Pronóstico {pred}</span>
                  <span className={`font-bold text-sm ${pts > 0 ? 'text-blue-700' : 'text-gray-400'}`}>{pts} pts</span>
                </div>
                <div className="space-y-0.5">
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className={`font-semibold w-6 shrink-0 ${item.ok ? 'text-green-600' : 'text-gray-400'}`}>+{item.pts}</span>
                      <span className={item.ok ? 'text-gray-600' : 'text-gray-400'}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-gray-50 px-4 py-4 border border-gray-200 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resultado real: 1-1 (empate)</p>
            {[
              { pred: '1-1', pts: exactTotalPoints, items: [
                { pts: winnerBasePoints, label: 'Acertaste el empate', ok: true },
                { pts: differenceBasePoints, label: 'Acertaste la diferencia de goles (0)', ok: true },
                { pts: exactBasePoints * 2, label: 'Acertaste los goles del local (1) y del visitante (1)', ok: true },
              ]},
              { pred: '0-0', pts: differenceTotalPoints, items: [
                { pts: winnerBasePoints, label: 'Acertaste el empate', ok: true },
                { pts: differenceBasePoints, label: 'Acertaste la diferencia de goles (0)', ok: true },
                { pts: 0, label: 'Goles exactos no coinciden (0≠1)', ok: false },
              ]},
              { pred: '2-1', pts: exactBasePoints, items: [
                { pts: 0, label: 'No acertaste el resultado (fue empate, no hubo ganador)', ok: false },
                { pts: 0, label: 'Diferencia de goles incorrecta (1≠0)', ok: false },
                { pts: 0, label: 'Goles del local no coinciden (2≠1)', ok: false },
                { pts: exactBasePoints, label: 'Acertaste los goles del visitante (1)', ok: true },
              ]},
            ].map(({ pred, pts, items }) => (
              <div key={pred} className="rounded-md bg-white px-3 py-2.5 border border-gray-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm text-gray-800">Pronóstico {pred}</span>
                  <span className={`font-bold text-sm ${pts > 0 ? 'text-blue-700' : 'text-gray-400'}`}>{pts} pts</span>
                </div>
                <div className="space-y-0.5">
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className={`font-semibold w-6 shrink-0 ${item.ok ? 'text-green-600' : 'text-gray-400'}`}>+{item.pts}</span>
                      <span className={item.ok ? 'text-gray-600' : 'text-gray-400'}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          </>}

          {scoringTab === 'segunda' && secondRoundMultiplier > 1 && <div className="space-y-3">
            <p className="text-xs text-gray-500">A partir de Octavos, Cuartos, Semis, 3er puesto y Final los puntos se multiplican por <span className="font-bold text-amber-700">×{secondRoundMultiplier}</span>. El resultado se evalúa sobre los <span className="font-semibold">90 min reglamentarios</span>, sin tiempo extra ni penales.</p>

            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-4 border border-amber-200 dark:border-amber-800 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Resultado real: 2-1 (local gana)</p>
              {[
                { pred: '2-1', pts: exactTotalPoints * secondRoundMultiplier, items: [
                  { pts: winnerBasePoints * secondRoundMultiplier, label: `Acertaste el ganador (local) ×${secondRoundMultiplier}`, ok: true },
                  { pts: differenceBasePoints * secondRoundMultiplier, label: `Acertaste la diferencia de goles (1) ×${secondRoundMultiplier}`, ok: true },
                  { pts: exactBasePoints * 2 * secondRoundMultiplier, label: `Acertaste los goles del local (2) y del visitante (1) ×${secondRoundMultiplier}`, ok: true },
                ]},
                { pred: '1-0', pts: differenceTotalPoints * secondRoundMultiplier, items: [
                  { pts: winnerBasePoints * secondRoundMultiplier, label: `Acertaste el ganador (local) ×${secondRoundMultiplier}`, ok: true },
                  { pts: differenceBasePoints * secondRoundMultiplier, label: `Acertaste la diferencia de goles (1) ×${secondRoundMultiplier}`, ok: true },
                  { pts: 0, label: 'Goles exactos no coinciden (1≠2, 0≠1)', ok: false },
                ]},
                { pred: '3-1', pts: (winnerBasePoints + exactBasePoints) * secondRoundMultiplier, items: [
                  { pts: winnerBasePoints * secondRoundMultiplier, label: `Acertaste el ganador (local) ×${secondRoundMultiplier}`, ok: true },
                  { pts: 0, label: 'Diferencia de goles incorrecta (2≠1)', ok: false },
                  { pts: exactBasePoints * secondRoundMultiplier, label: `Acertaste los goles del visitante (1) ×${secondRoundMultiplier}`, ok: true },
                ]},
                { pred: '4-2', pts: winnerBasePoints * secondRoundMultiplier, items: [
                  { pts: winnerBasePoints * secondRoundMultiplier, label: `Acertaste el ganador (local) ×${secondRoundMultiplier}`, ok: true },
                  { pts: 0, label: 'Diferencia de goles incorrecta (2≠1)', ok: false },
                  { pts: 0, label: 'Goles exactos no coinciden', ok: false },
                ]},
              ].map(({ pred, pts, items }) => (
                <div key={pred} className="rounded-md bg-white dark:bg-slate-700 px-3 py-2.5 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Pronóstico {pred}</span>
                    <span className={`font-bold text-sm ${pts > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400'}`}>{pts} pts</span>
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <span className={`font-semibold w-6 shrink-0 ${item.ok ? 'text-green-600' : 'text-gray-400'}`}>+{item.pts}</span>
                        <span className={item.ok ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-4 border border-amber-200 dark:border-amber-800 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Resultado real: 1-1 (empate)</p>
              {[
                { pred: '1-1', pts: exactTotalPoints * secondRoundMultiplier, items: [
                  { pts: winnerBasePoints * secondRoundMultiplier, label: `Acertaste el empate ×${secondRoundMultiplier}`, ok: true },
                  { pts: differenceBasePoints * secondRoundMultiplier, label: `Acertaste la diferencia de goles (0) ×${secondRoundMultiplier}`, ok: true },
                  { pts: exactBasePoints * 2 * secondRoundMultiplier, label: `Acertaste los goles del local (1) y del visitante (1) ×${secondRoundMultiplier}`, ok: true },
                ]},
                { pred: '0-0', pts: differenceTotalPoints * secondRoundMultiplier, items: [
                  { pts: winnerBasePoints * secondRoundMultiplier, label: `Acertaste el empate ×${secondRoundMultiplier}`, ok: true },
                  { pts: differenceBasePoints * secondRoundMultiplier, label: `Acertaste la diferencia de goles (0) ×${secondRoundMultiplier}`, ok: true },
                  { pts: 0, label: 'Goles exactos no coinciden (0≠1)', ok: false },
                ]},
                { pred: '2-1', pts: exactBasePoints * secondRoundMultiplier, items: [
                  { pts: 0, label: 'No acertaste el resultado (fue empate, no hubo ganador)', ok: false },
                  { pts: 0, label: 'Diferencia de goles incorrecta (1≠0)', ok: false },
                  { pts: 0, label: 'Goles del local no coinciden (2≠1)', ok: false },
                  { pts: exactBasePoints * secondRoundMultiplier, label: `Acertaste los goles del visitante (1) ×${secondRoundMultiplier}`, ok: true },
                ]},
              ].map(({ pred, pts, items }) => (
                <div key={pred} className="rounded-md bg-white dark:bg-slate-700 px-3 py-2.5 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Pronóstico {pred}</span>
                    <span className={`font-bold text-sm ${pts > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400'}`}>{pts} pts</span>
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <span className={`font-semibold w-6 shrink-0 ${item.ok ? 'text-green-600' : 'text-gray-400'}`}>+{item.pts}</span>
                        <span className={item.ok ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>}
        </div>
      </Modal>

      {/* Prize Modal */}
      <Modal
        isOpen={showPrizesModal}
        onClose={() => setShowPrizesModal(false)}
        title="Configurar premios"
        size="md"
      >
        {(() => {
          const prizeTotal = parseFloat(prizeData.totalAmount) || 0;
          const prizeAssigned = (prizeData.distribution || []).reduce((sum, item) => {
            const val = parseFloat(item.value) || 0;
            return sum + (item.type === 'fixed' ? val : (val * prizeTotal) / 100);
          }, 0);
          const prizeRemaining = prizeTotal - prizeAssigned;

          return (
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto total del premio <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold select-none">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={prizeData.totalAmount !== '' ? fmtCOP(prizeData.totalAmount) : ''}
                    onChange={(e) => { const raw = e.target.value.replace(/\D/g, ''); setPrizeData((prev) => ({ ...prev, totalAmount: raw })); }}
                    className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad de ganadores <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={prizeData.winnersCount}
                  onChange={(e) => handleWinnersCountChange(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {prizeData.winnersCount > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Distribución de premios</p>
                  <div className="space-y-2">
                    {(prizeData.distribution || []).map((item, i) => {
                      const calcAmount = item.type === 'percentage' && prizeTotal > 0
                        ? Math.round((parseFloat(item.value) || 0) * prizeTotal / 100)
                        : null;
                      return (
                        <div key={i} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          <span className="text-xs font-medium text-gray-600 w-28 shrink-0">{ORDINALS[i] || `Puesto ${i + 1}`} puesto</span>
                          <select
                            value={item.type}
                            onChange={(e) => handleDistributionChange(i, 'type', e.target.value)}
                            className="text-xs border border-gray-300 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white shrink-0"
                          >
                            <option value="fixed">Valor fijo</option>
                            <option value="percentage">Porcentaje</option>
                          </select>
                          <div className="relative flex-1 min-w-[80px]">
                            {item.type === 'fixed' && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs select-none">$</span>}
                            <input
                              type={item.type === 'fixed' ? 'text' : 'number'}
                              inputMode={item.type === 'fixed' ? 'numeric' : undefined}
                              min={0}
                              max={item.type === 'percentage' ? 100 : undefined}
                              value={item.type === 'fixed' ? (item.value !== '' ? fmtCOP(item.value) : '') : item.value}
                              onChange={(e) => {
                                if (item.type === 'fixed') {
                                  handleDistributionChange(i, 'value', e.target.value.replace(/\D/g, ''));
                                } else {
                                  handleDistributionChange(i, 'value', e.target.value);
                                }
                              }}
                              className={`w-full py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm ${item.type === 'fixed' ? 'pl-6 pr-3' : 'pl-3 pr-7'}`}
                              placeholder="0"
                            />
                            {item.type === 'percentage' && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs select-none">%</span>}
                          </div>
                          {calcAmount !== null && (
                            <span className="text-xs text-gray-500 shrink-0">= ${fmtCOP(calcAmount)}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {prizeTotal > 0 && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-1">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Total del premio:</span>
                    <span className="font-semibold">${fmtCOP(prizeTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Total asignado:</span>
                    <span className="font-semibold">${fmtCOP(Math.round(prizeAssigned))}</span>
                  </div>
                  <div className={`flex justify-between text-xs font-semibold ${prizeRemaining < -0.01 ? 'text-red-600' : prizeRemaining < prizeTotal * 0.01 ? 'text-green-600' : 'text-amber-600'}`}>
                    <span>Restante:</span>
                    <span>${fmtCOP(Math.round(prizeRemaining))}</span>
                  </div>
                </div>
              )}

              {prizeError && <p className="text-sm text-red-600">{prizeError}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowPrizesModal(false); setPrizeError(''); }}
                  className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSavePrizes}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition"
                >
                  Guardar premios
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
