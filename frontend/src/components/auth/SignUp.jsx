import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  FIELD_MAX_LENGTHS,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
} from '../../utils/validators';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

function PasswordStrength({ password }) {
  const getStrength = () => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getStrength();
  const labels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];
  const colors = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= strength ? colors[strength] : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-1">{labels[strength]}</p>
    </div>
  );
}

export default function SignUp() {
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [checkingUsername, setCheckingUsername] = useState(false);
  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from ? location.state.from.pathname + (location.state.from.search || '') : '/dashboard';

  const getFieldError = (fieldName, value, nextFormData = formData) => {
    switch (fieldName) {
      case 'displayName':
        return validateDisplayName(value);
      case 'username':
        return validateUsername(value);
      case 'email':
        return validateEmail(value);
      case 'password':
        return validatePassword(value);
      case 'confirmPassword':
        if (!value) return 'Debes confirmar tu contraseña';
        if (value.length > FIELD_MAX_LENGTHS.password) {
          return `La confirmación no puede tener más de ${FIELD_MAX_LENGTHS.password} caracteres`;
        }
        if (value !== nextFormData.password) return 'Las contraseñas no coinciden';
        return null;
      default:
        return null;
    }
  };

  const validateForm = () => {
    const nextErrors = {
      displayName: getFieldError('displayName', formData.displayName),
      username: getFieldError('username', formData.username),
      email: getFieldError('email', formData.email),
      password: getFieldError('password', formData.password),
      confirmPassword: getFieldError('confirmPassword', formData.confirmPassword),
    };

    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextFormData = { ...formData, [name]: value };

    setFormData(nextFormData);
    setErrors((prev) => ({
      ...prev,
      [name]: getFieldError(name, value, nextFormData),
      ...(name === 'password'
        ? { confirmPassword: getFieldError('confirmPassword', nextFormData.confirmPassword, nextFormData) }
        : {}),
    }));
  };

  const checkUsernameAvailable = async (username) => {
    const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
    const snapshot = await getDocs(q);
    return snapshot.empty;
  };

  const handleUsernameBlur = async () => {
    const usernameError = getFieldError('username', formData.username);
    if (usernameError || !formData.username.trim()) {
      setErrors((prev) => ({ ...prev, username: usernameError }));
      return;
    }

    setCheckingUsername(true);
    try {
      const available = await checkUsernameAvailable(formData.username);
      setErrors((prev) => ({
        ...prev,
        username: available ? null : 'El nombre de usuario ya está en uso',
      }));
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isFormValid = validateForm();
    if (!isFormValid) {
      return;
    }

    setLoading(true);
    try {
      const available = await checkUsernameAvailable(formData.username);
      if (!available) {
        setErrors((prev) => ({ ...prev, username: 'El nombre de usuario ya está en uso' }));
        setLoading(false);
        return;
      }

      await signup(
        formData.email,
        formData.password,
        formData.displayName,
        formData.username.toLowerCase()
      );
      toast.success('¡Cuenta creada exitosamente!');
      navigate(from, { replace: true });
    } catch (error) {
      const messages = {
        'auth/email-already-in-use': 'Este email ya está registrado',
        'auth/invalid-email': 'Email inválido',
        'auth/weak-password': 'La contraseña es muy débil',
      };
      const backendMessage = messages[error.code] || 'Error al crear la cuenta';
      if (error.code === 'auth/email-already-in-use' || error.code === 'auth/invalid-email') {
        setErrors((prev) => ({ ...prev, email: backendMessage }));
      } else if (error.code === 'auth/weak-password') {
        setErrors((prev) => ({ ...prev, password: backendMessage }));
      } else {
        toast.error(backendMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      toast.success('Cuenta creada con Google');
      navigate(from, { replace: true });
    } catch (error) {
      const messages = {
        'auth/popup-closed-by-user': 'Se cerró la ventana antes de completar el acceso con Google',
        'auth/cancelled-popup-request': 'Ya hay un intento de acceso con Google en curso',
        'auth/popup-blocked': 'El navegador bloqueó la ventana emergente de Google',
      };
      toast.error(messages[error.code] || 'No fue posible continuar con Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/icons/logoBIA.png"
            alt="Logo BIA Sports 2026"
            className="w-32 h-32 object-contain mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-800">BIA Sports 2026</h1>
          <p className="text-gray-500 mt-1">Únete a la competencia de pronósticos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-bold text-[#4285F4] shadow-sm border border-gray-200">
              G
            </span>
            {loading ? 'Conectando con Google...' : 'Registrarme con Google'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] text-gray-400">
              <span className="bg-white px-3">o completa tus datos</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
            <input
              type="text"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              maxLength={FIELD_MAX_LENGTHS.displayName}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                errors.displayName ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
              }`}
              placeholder="Juan García"
              required
            />
            {errors.displayName && <p className="mt-1 text-sm text-red-600">{errors.displayName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de usuario</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              onBlur={handleUsernameBlur}
              maxLength={FIELD_MAX_LENGTHS.username}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                errors.username ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
              }`}
              placeholder="juangarcia"
              required
            />
            {checkingUsername && !errors.username && (
              <p className="mt-1 text-sm text-gray-500">Verificando disponibilidad...</p>
            )}
            {errors.username && <p className="mt-1 text-sm text-red-600">{errors.username}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              maxLength={FIELD_MAX_LENGTHS.email}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                errors.email ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
              }`}
              placeholder="tu@email.com"
              required
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                maxLength={FIELD_MAX_LENGTHS.password}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition pr-12 ${
                  errors.password ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
                }`}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
            <PasswordStrength password={formData.password} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              maxLength={FIELD_MAX_LENGTHS.password}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
                errors.confirmPassword ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
              }`}
              placeholder="••••••••"
              required
            />
            {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>

        <p className="text-center text-gray-500 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link to="/auth/login" className="text-blue-600 hover:text-blue-800 font-medium">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
