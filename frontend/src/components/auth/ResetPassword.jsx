import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import toast from 'react-hot-toast';

import Loading from '../common/Loading';
import { validatePassword } from '../../utils/validators';

const WORLD_CUP_LOGO = 'https://i.pinimg.com/736x/4a/7e/44/4a7e44a4a840b860c88ee3fb3776f9b0.jpg';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [linkIsValid, setLinkIsValid] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
  const [remainingChanges, setRemainingChanges] = useState(null);

  const oobCode = useMemo(() => searchParams.get('oobCode') || '', [searchParams]);

  useEffect(() => {
    let isMounted = true;

    const validateCode = async () => {
      if (!oobCode) {
        if (isMounted) {
          setLinkIsValid(false);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/reset-password/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ oobCode }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.message || 'No fue posible validar el enlace');
        }

        if (isMounted) {
          setEmail(payload.email || '');
          setRemainingChanges(typeof payload.remainingChanges === 'number' ? payload.remainingChanges : null);
          setLimitMessage('');
          setLinkIsValid(true);
        }
      } catch (error) {
        if (isMounted) {
          setLimitMessage(error.message || 'Este enlace ya no es válido');
          setLinkIsValid(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    validateCode();

    return () => {
      isMounted = false;
    };
  }, [oobCode]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!password || !confirmPassword) {
      toast.error('Completa ambos campos');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ oobCode, newPassword: password }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'No fue posible restablecer la contraseña');
      }

      toast.success('Contraseña actualizada correctamente');
      navigate('/auth/login', { replace: true });
    } catch (error) {
      toast.error(error.message || 'No fue posible restablecer la contraseña');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loading message="Validando enlace de recuperación..." />;
  }

  if (!linkIsValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <LockKeyhole className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Enlace no válido</h1>
          <p className="text-gray-500 mb-6">{limitMessage || 'Este enlace de recuperación ha expirado o ya fue utilizado. Solicita uno nuevo desde el inicio de sesión.'}</p>
          <Link
            to="/auth/login"
            className="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
          >
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={WORLD_CUP_LOGO}
            alt="Logo Mundial 2026"
            className="w-16 h-16 rounded-full object-cover mx-auto mb-3 shadow-md ring-4 ring-blue-100"
          />
          <h1 className="text-3xl font-bold text-gray-800">Nueva contraseña</h1>
          <p className="text-gray-500 mt-1">Actualiza el acceso de la cuenta {email}</p>
          {remainingChanges !== null && (
            <p className="text-xs font-medium text-amber-600 mt-2">
              Te quedan {remainingChanges} cambios disponibles de un máximo de 3.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition pr-12"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition pr-12"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Actualizando contraseña...' : 'Guardar nueva contraseña'}
          </button>
        </form>

        <p className="text-center text-gray-500 mt-6 text-sm">
          <Link to="/auth/login" className="text-blue-600 hover:text-blue-800 font-medium">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}