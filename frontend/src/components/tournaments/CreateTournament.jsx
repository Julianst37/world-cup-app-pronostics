import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournaments } from '../../hooks/useTournaments';
import toast from 'react-hot-toast';

export default function CreateTournament() {
  const { createTournament } = useTournaments();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    maxUsers: 50,
    requiresApproval: false,
    pointConfig: {
      exact: 3,
      difference: 2,
      winner: 1,
    },
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
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
    if (!formData.name.trim()) {
      toast.error('El nombre del torneo es obligatorio');
      return;
    }

    setLoading(true);
    try {
      const tournamentId = await createTournament(formData);
      toast.success('¡Torneo creado exitosamente!');
      navigate(`/tournaments/${tournamentId}/home`);
    } catch (error) {
      toast.error('Error al crear el torneo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Crear Torneo</h1>
        <p className="text-gray-500 mt-1">Configura tu torneo de pronósticos del Mundial 2026</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="Ej: Torneo Oficina 2026"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none"
                placeholder="Describe tu torneo..."
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
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Configuración de puntos</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resultado exacto
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ganador / Empate
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
            {loading ? 'Creando...' : '🚀 Crear Torneo'}
          </button>
        </div>
      </form>
    </div>
  );
}
