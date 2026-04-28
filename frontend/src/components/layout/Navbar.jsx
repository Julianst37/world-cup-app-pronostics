import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { SUPER_ADMIN_EMAIL } from '../../utils/constants';
import toast from 'react-hot-toast';
import { useNotifications } from '../../hooks/useNotifications';
import { Bell, Moon, ShieldCheck, Sun } from 'lucide-react';
import TeamAvatar from '../common/TeamAvatar';
import wcLogo from '../../images/wc-logo.png';

export default function Navbar() {
  const { currentUser, userProfile, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useNotifications();
  const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Sesión cerrada');
      navigate('/');
    } catch {
      toast.error('Error al cerrar sesión');
    }
  };

  return (
    <nav className="bg-blue-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to={currentUser ? "/dashboard" : "/"} className="flex items-center gap-2 font-bold text-xl hover:text-blue-200 transition">
            <img src={wcLogo} alt="BIA Sports 2026" className="w-8 h-8 object-contain" />
            <span>BIA Sports 2026</span>
          </Link>

          {currentUser && (
            <>
              {/* Desktop nav */}
              <div className="hidden md:flex items-center gap-6">
                <Link
                  to="/dashboard"
                  className={`hover:text-blue-200 transition font-medium ${
                    location.pathname === '/dashboard' ? 'text-blue-200' : ''
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/tournaments/create"
                  className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-lg transition font-medium"
                >
                  + Crear Torneo
                </Link>
                {isSuperAdmin && (
                  <Link
                    to="/admin/matches"
                    className={`flex items-center gap-2 hover:text-blue-200 transition font-medium ${
                      location.pathname === '/admin/matches' ? 'text-blue-200' : ''
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Admin Partidos
                  </Link>
                )}
                {/* Toggle dark mode */}
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-lg hover:bg-blue-800 transition"
                  title={darkMode ? 'Modo claro' : 'Modo oscuro'}
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                {currentUser && (
                  <div className="relative">
                    <Link
                      to="/notifications"
                      className="relative hover:text-blue-200 transition"
                    >
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </Link>
                  </div>
                )}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 hover:text-blue-200 transition"
                  >
                    <TeamAvatar
                      teamCode={userProfile?.favoriteTeam}
                      name={userProfile?.displayName || currentUser.email}
                      size={36}
                    />
                    <span className="text-sm">{userProfile?.displayName || currentUser.email}</span>
                    <span>▾</span>
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 shadow-xl z-50">
                      <Link
                        to="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="block rounded-lg px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      >
                        Mi Perfil
                      </Link>
                      <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                      <button
                        onClick={handleLogout}
                        className="block w-full rounded-lg px-4 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      >
                        Cerrar Sesión
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile menu button */}
              <button
                className="md:hidden p-2"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <div className="w-6 h-0.5 bg-white mb-1.5"></div>
                <div className="w-6 h-0.5 bg-white mb-1.5"></div>
                <div className="w-6 h-0.5 bg-white"></div>
              </button>
            </>
          )}

          {!currentUser && (
            <div className="flex items-center gap-3">
              <Link
                to="/auth/login"
                className="text-white hover:text-blue-200 font-medium transition"
              >
                Iniciar Sesión
              </Link>
              <Link
                to="/auth/signup"
                className="bg-white dark:bg-white text-blue-900 dark:text-blue-900 hover:bg-blue-50 dark:hover:bg-blue-50 px-4 py-2 rounded-lg font-medium transition"
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu */}
        {menuOpen && currentUser && (
          <div className="md:hidden pb-4 space-y-2">
            <Link
              to="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="block py-2 hover:text-blue-200 transition"
            >
              Dashboard
            </Link>
            <Link
              to="/tournaments/create"
              onClick={() => setMenuOpen(false)}
              className="block py-2 hover:text-blue-200 transition"
            >
              + Crear Torneo
            </Link>
            <Link
              to="/notifications"
              onClick={() => setMenuOpen(false)}
              className="block py-2 hover:text-blue-200 transition relative"
            >
              <Bell className="w-4 h-4 inline mr-1" /> Notificaciones {unreadCount > 0 && `(${unreadCount})`}
            </Link>
            {isSuperAdmin && (
              <Link
                to="/admin/matches"
                onClick={() => setMenuOpen(false)}
                className="block py-2 hover:text-blue-200 transition"
              >
                <ShieldCheck className="w-4 h-4 inline mr-1" /> Admin Partidos
              </Link>
            )}
            <button
              onClick={toggleDarkMode}
              className="flex items-center gap-2 py-2 hover:text-blue-200 transition"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {darkMode ? 'Modo claro' : 'Modo oscuro'}
            </button>
            <Link
              to="/profile"
              onClick={() => setMenuOpen(false)}
              className="block py-2 hover:text-blue-200 transition"
            >
              Mi Perfil
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full text-left py-2 text-red-300 hover:text-red-200 transition"
            >
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
