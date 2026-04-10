import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTournaments } from '../../hooks/useTournaments';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function TournamentSettings() {
  const { tournament, setTournament } = useOutletContext();
  const { updateTournament } = useTournaments();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: tournament?.name || '',
    description: tournament?.description || '',
    maxUsers: tournament?.maxUsers || 50,
    requiresApproval: tournament?.requiresApproval || false,
    pointConfig: tournament?.pointConfig || { exact: 3, difference: 2, winner: 1 },
  });

  const isAdmin = tournament?.adminId === currentUser?.uid;

  if (!isAdmin) {
    return (
      <div className="text-center py-16 text-gray-500">
        <span className="text-4xl block mb-3">🔒</span>
        <p>Solo el administrador puede ver la configuración.</p>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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
      await updateTournament(tournament.id, formData);
      setTournament({ ...tournament, ...formData });
      toast.success('Configuración guardada');
    } catch {
      toast.error('Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Configuración del Torneo</h2>

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
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Puntos por predicción</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: 'exact', label: 'Resultado exacto' },
              { key: 'difference', label: 'Diferencia' },
              { key: 'winner', label: 'Ganador/Empate' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
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
        </div>

        {tournament?.inviteCode && (
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Código de invitación</p>
            <div className="flex items-center gap-2">
              <code className="text-blue-700 font-mono font-bold text-lg">{tournament.inviteCode}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(tournament.inviteCode);
                  toast.success('Código copiado');
                }}
                className="text-blue-600 hover:text-blue-800 text-sm transition"
              >
                📋 Copiar
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Guardando...' : '💾 Guardar Cambios'}
        </button>
      </form>
    </div>
  );
}
