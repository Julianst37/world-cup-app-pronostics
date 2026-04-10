import { NavLink, useParams } from 'react-router-dom';

export default function Sidebar({ tournamentId }) {
  const params = useParams();
  const tid = tournamentId || params.tournamentId;

  if (!tid) return null;

  const links = [
    { to: `/tournaments/${tid}/home`, label: 'Home', icon: '🏠' },
    { to: `/tournaments/${tid}/predictions`, label: 'Pronósticos', icon: '⚽' },
    { to: `/tournaments/${tid}/standings`, label: 'Posiciones', icon: '🏆' },
    { to: `/tournaments/${tid}/participants`, label: 'Participantes', icon: '👥' },
    { to: `/tournaments/${tid}/settings`, label: 'Configuración', icon: '⚙️' },
  ];

  return (
    <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 min-h-full py-6 px-3">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition font-medium text-sm ${
              isActive
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <span className="text-lg">{link.icon}</span>
          {link.label}
        </NavLink>
      ))}
    </aside>
  );
}
