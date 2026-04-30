import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { validateEmail, validatePassword, validateDisplayName, validateUsername, FIELD_MAX_LENGTHS } from '../../utils/validators';
import { User, Mail, Key } from 'lucide-react';
import TeamAvatar from '../common/TeamAvatar';
import { SORTED_WORLD_CUP_2026_TEAMS, getWorldCupTeam } from '../../utils/worldCupTeams';

export default function ProfileComponent() {
  const { currentUser, userProfile, updateUserProfile, updateUserEmail, updateUserPassword } = useAuth();
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);

  const [infoForm, setInfoForm] = useState({
    displayName: userProfile?.displayName || '',
    username: userProfile?.username || '',
    favoriteTeam: userProfile?.favoriteTeam || '',
  });
  const [infoErrors, setInfoErrors] = useState({});

  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' });
  const [emailErrors, setEmailErrors] = useState({});

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState({});

  useEffect(() => {
    setInfoForm({
      displayName: userProfile?.displayName || '',
      username: userProfile?.username || '',
      favoriteTeam: userProfile?.favoriteTeam || '',
    });
  }, [userProfile]);

  // --- Info validation ---
  const validateInfoField = (name, value) => {
    if (name === 'displayName') return validateDisplayName(value);
    if (name === 'username') return validateUsername(value);
    return null;
  };

  const handleInfoChange = (e) => {
    const { name, value } = e.target;
    setInfoForm((prev) => ({ ...prev, [name]: value }));
    setInfoErrors((prev) => ({ ...prev, [name]: validateInfoField(name, value) }));
  };

  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    const next = {
      displayName: validateInfoField('displayName', infoForm.displayName),
      username: validateInfoField('username', infoForm.username),
    };
    setInfoErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setLoading(true);
    try {
      await updateUserProfile(infoForm);
      toast.success('Perfil actualizado');
    } catch {
      toast.error('Error al actualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  // --- Email validation ---
  const validateEmailField = (name, value) => {
    if (name === 'newEmail') return validateEmail(value);
    if (name === 'currentPassword') {
      if (!value) return 'La contraseña actual es requerida';
      return null;
    }
    return null;
  };

  const handleEmailChange = (e) => {
    const { name, value } = e.target;
    setEmailForm((prev) => ({ ...prev, [name]: value }));
    setEmailErrors((prev) => ({ ...prev, [name]: validateEmailField(name, value) }));
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const next = {
      newEmail: validateEmailField('newEmail', emailForm.newEmail),
      currentPassword: validateEmailField('currentPassword', emailForm.currentPassword),
    };
    setEmailErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setLoading(true);
    try {
      await updateUserEmail(emailForm.newEmail, emailForm.currentPassword);
      toast.success('Email actualizado');
      setEmailForm({ newEmail: '', currentPassword: '' });
      setEmailErrors({});
    } catch (err) {
      if (err.code === 'auth/wrong-password') {
        setEmailErrors((prev) => ({ ...prev, currentPassword: 'Contraseña incorrecta' }));
      } else {
        toast.error('Error al actualizar email');
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Password validation ---
  const validatePasswordField = (name, value, form = passwordForm) => {
    if (name === 'currentPassword') {
      if (!value) return 'La contraseña actual es requerida';
      return null;
    }
    if (name === 'newPassword') return validatePassword(value);
    if (name === 'confirmPassword') {
      if (!value) return 'Debes confirmar la contraseña';
      if (value !== form.newPassword) return 'Las contraseñas no coinciden';
      return null;
    }
    return null;
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    const nextForm = { ...passwordForm, [name]: value };
    setPasswordForm(nextForm);
    setPasswordErrors((prev) => ({
      ...prev,
      [name]: validatePasswordField(name, value, nextForm),
      ...(name === 'newPassword'
        ? { confirmPassword: validatePasswordField('confirmPassword', nextForm.confirmPassword, nextForm) }
        : {}),
    }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const next = {
      currentPassword: validatePasswordField('currentPassword', passwordForm.currentPassword),
      newPassword: validatePasswordField('newPassword', passwordForm.newPassword),
      confirmPassword: validatePasswordField('confirmPassword', passwordForm.confirmPassword),
    };
    setPasswordErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setLoading(true);
    try {
      await updateUserPassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast.success('Contraseña actualizada');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordErrors({});
    } catch (err) {
      if (err.code === 'auth/wrong-password') {
        setPasswordErrors((prev) => ({ ...prev, currentPassword: 'Contraseña actual incorrecta' }));
      } else {
        toast.error(err.message || 'Error al cambiar contraseña');
      }
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'info', label: 'Información', Icon: User },
    { id: 'email', label: 'Email', Icon: Mail },
    { id: 'password', label: 'Contraseña', Icon: Key },
  ];

  const selectedTeam = getWorldCupTeam(infoForm.favoriteTeam);
  const setFavoriteTeam = (favoriteTeam) => setInfoForm({ ...infoForm, favoriteTeam });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <TeamAvatar
          teamCode={userProfile?.favoriteTeam}
          name={userProfile?.displayName || currentUser?.email}
          size={72}
        />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{userProfile?.displayName || 'Mi Perfil'}</h1>
          <p className="text-gray-500 text-sm">{currentUser?.email}</p>
          {selectedTeam && <p className="text-sm text-blue-700 font-medium">Selección: {selectedTeam.name}</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.Icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'info' && (
            <form onSubmit={handleInfoSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input
                  type="text"
                  name="displayName"
                  value={infoForm.displayName}
                  onChange={handleInfoChange}
                  maxLength={FIELD_MAX_LENGTHS.displayName}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${infoErrors.displayName ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`}
                />
                {infoErrors.displayName && <p className="mt-1 text-sm text-red-600">{infoErrors.displayName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de usuario</label>
                <input
                  type="text"
                  name="username"
                  value={infoForm.username}
                  onChange={handleInfoChange}
                  maxLength={FIELD_MAX_LENGTHS.username}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${infoErrors.username ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`}
                />
                {infoErrors.username && <p className="mt-1 text-sm text-red-600">{infoErrors.username}</p>}
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-50 to-blue-50 p-5 space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">Configura tu avatar</h3>
                    <p className="text-sm text-gray-600">Elige la selección que quieres mostrar en tu camiseta.</p>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 border border-gray-200 shadow-sm">
                    <TeamAvatar
                      teamCode={infoForm.favoriteTeam}
                      name={infoForm.displayName || currentUser?.email}
                      size={72}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Vista previa</p>
                      <p className="text-sm text-gray-600">{selectedTeam ? selectedTeam.name : 'Sin selección'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selecciona tu país favorito</label>
                  <select
                    value={infoForm.favoriteTeam}
                    onChange={(e) => setFavoriteTeam(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
                  >
                    <option value="">Selecciona un país</option>
                    {SORTED_WORLD_CUP_2026_TEAMS.map((team) => (
                      <option key={team.code} value={team.code}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">O elígelo visualmente</p>
                  <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {SORTED_WORLD_CUP_2026_TEAMS.map((team) => {
                        const isSelected = infoForm.favoriteTeam === team.code;

                        return (
                          <button
                            key={team.code}
                            type="button"
                            onClick={() => setFavoriteTeam(team.code)}
                            className={`rounded-xl border p-2 text-left transition ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-200'
                                : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <TeamAvatar
                                teamCode={team.code}
                                name={team.name}
                                size={36}
                              />
                              <div className="min-w-0 overflow-hidden">
                                <p className="text-xs font-medium text-gray-800 leading-tight line-clamp-2">{team.name}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          )}

          {activeTab === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email actual</label>
                <input
                  type="email"
                  value={currentUser?.email || ''}
                  disabled
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo email</label>
                <input
                  type="text"
                  name="newEmail"
                  value={emailForm.newEmail}
                  onChange={handleEmailChange}
                  maxLength={FIELD_MAX_LENGTHS.email}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${emailErrors.newEmail ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`}
                />
                {emailErrors.newEmail && <p className="mt-1 text-sm text-red-600">{emailErrors.newEmail}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={emailForm.currentPassword}
                  onChange={handleEmailChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${emailErrors.currentPassword ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`}
                />
                {emailErrors.currentPassword && <p className="mt-1 text-sm text-red-600">{emailErrors.currentPassword}</p>}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Actualizando...' : 'Actualizar email'}
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${passwordErrors.currentPassword ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`}
                />
                {passwordErrors.currentPassword && <p className="mt-1 text-sm text-red-600">{passwordErrors.currentPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${passwordErrors.newPassword ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`}
                />
                {passwordErrors.newPassword && <p className="mt-1 text-sm text-red-600">{passwordErrors.newPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${passwordErrors.confirmPassword ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`}
                />
                {passwordErrors.confirmPassword && <p className="mt-1 text-sm text-red-600">{passwordErrors.confirmPassword}</p>}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Actualizando...' : 'Cambiar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
