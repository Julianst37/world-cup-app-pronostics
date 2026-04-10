import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Landing() {
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 text-white">
      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="text-7xl mb-6">⚽🌍🏆</div>
        <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
          Mundial 2026
          <br />
          <span className="text-blue-300">Pronósticos</span>
        </h1>
        <p className="text-xl text-blue-200 mb-10 max-w-2xl mx-auto">
          Compite con tus amigos pronosticando los resultados de la Copa Mundial FIFA 2026.
          Crea torneos privados, gana puntos y lleva el control de la tabla de posiciones.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {currentUser ? (
            <Link
              to="/dashboard"
              className="bg-white text-blue-900 hover:bg-blue-50 font-bold px-8 py-4 rounded-xl text-lg transition shadow-lg"
            >
              Ir al Dashboard →
            </Link>
          ) : (
            <>
              <Link
                to="/auth/signup"
                className="bg-white text-blue-900 hover:bg-blue-50 font-bold px-8 py-4 rounded-xl text-lg transition shadow-lg"
              >
                Comenzar gratis
              </Link>
              <Link
                to="/auth/login"
                className="border-2 border-white text-white hover:bg-white/10 font-bold px-8 py-4 rounded-xl text-lg transition"
              >
                Iniciar sesión
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-4 pb-20">
        <h2 className="text-3xl font-bold text-center mb-12 text-blue-100">¿Cómo funciona?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: '🏟️',
              title: 'Crea tu torneo',
              desc: 'Crea un torneo privado con código de invitación único para jugar con tus amigos o compañeros.',
            },
            {
              icon: '⚽',
              title: 'Haz tus pronósticos',
              desc: 'Pronostica el resultado de los 104 partidos del Mundial 2026 antes de que empiecen.',
            },
            {
              icon: '🏆',
              title: 'Gana puntos',
              desc: 'Obtén 3 pts por resultado exacto, 2 pts por diferencia correcta, 1 pt por acertar el ganador.',
            },
          ].map((feature) => (
            <div key={feature.title} className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
              <div className="text-5xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-blue-200">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Countries */}
      <div className="bg-black/20 py-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-blue-300 text-lg">
            🌎 <strong>48 selecciones</strong> · <strong>104 partidos</strong> · <strong>3 sedes</strong>: USA, México y Canadá
          </p>
          <p className="text-blue-400 text-sm mt-2">11 de junio – 19 de julio de 2026</p>
        </div>
      </div>
    </div>
  );
}
