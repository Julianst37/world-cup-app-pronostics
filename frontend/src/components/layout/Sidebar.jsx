import { NavLink, useParams } from 'react-router-dom';
import { Home, ClipboardList, Trophy, Users, Settings } from 'lucide-react';

export default function Sidebar({ tournamentId }) {
  const params = useParams();
  const tid = tournamentId || params.tournamentId;

  if (!tid) return null;

  const links = [
    { to: `/tournaments/${tid}/home`, label: 'Inicio', Icon: Home },
    { to: `/tournaments/${tid}/predictions`, label: 'Pronósticos', Icon: ClipboardList },
    { to: `/tournaments/${tid}/standings`, label: 'Posiciones', Icon: Trophy },
    { to: `/tournaments/${tid}/participants`, label: 'Participantes', Icon: Users },
    { to: `/tournaments/${tid}/settings`, label: 'Configuración', Icon: Settings },
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
          <link.Icon className="w-5 h-5" />
          {link.label}
        </NavLink>
      ))}
    </aside>
  );
}
