import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { currentUser, userProfile, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
          <Link to="/" className="flex items-center gap-2 font-bold text-xl hover:text-blue-200 transition">
            <span className="text-2xl">⚽</span>
            <span>Mundial 2026</span>
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
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 hover:text-blue-200 transition"
                  >
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold">
                      {(userProfile?.displayName || currentUser.email)?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm">{userProfile?.displayName || currentUser.email}</span>
                    <span>▾</span>
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl py-1 z-50">
                      <Link
                        to="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
                      >
                        Mi Perfil
                      </Link>
                      <hr className="my-1" />
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition"
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
                className="bg-white text-blue-900 hover:bg-blue-50 px-4 py-2 rounded-lg font-medium transition"
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
