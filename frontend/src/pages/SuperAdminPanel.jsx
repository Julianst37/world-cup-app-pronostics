import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { SUPER_ADMIN_EMAIL } from '../utils/constants';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { Trophy, Users, Search, LayoutDashboard, KeyRound } from 'lucide-react';

export default function SuperAdminPanel() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('tournaments');

  // Redirect non-superadmins
  useEffect(() => {
    if (currentUser && currentUser.email !== SUPER_ADMIN_EMAIL) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  // ── Tournaments ──────────────────────────────────────────────────
  const [tournaments, setTournaments] = useState([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [tournamentsLoaded, setTournamentsLoaded] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingStatus, setUpdatingStatus] = useState(null);

  // ── Users ─────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userTournaments, setUserTournaments] = useState([]);
  const [loadingUserTournaments, setLoadingUserTournaments] = useState(false);
  const [sendingSupport, setSendingSupport] = useState(null);
  const [updatingUserStatus, setUpdatingUserStatus] = useState(null);

  // Load tournaments on first visit to that tab
  useEffect(() => {
    if (activeTab !== 'tournaments' || tournamentsLoaded) return;
    setTournamentsLoading(true);

    const fetchTournaments = async () => {
      try {
        const snap = await getDocs(collection(db, 'tournaments'));
        const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Fetch admin profiles (batch by unique adminIds)
        const adminIds = [...new Set(raw.map((t) => t.adminId).filter(Boolean))];
        const adminDocs = await Promise.all(adminIds.map((id) => getDoc(doc(db, 'users', id))));
        const adminMap = {};
        adminDocs.forEach((d) => {
          if (d.exists()) adminMap[d.id] = d.data();
        });

        // Fetch active participant counts
        const countSnaps = await Promise.all(
          raw.map((t) =>
            getDocs(
              query(
                collection(db, 'participants'),
                where('tournamentId', '==', t.id),
                where('status', '==', 'active')
              )
            ).then((s) => s.size)
          )
        );

        const enriched = raw.map((t, i) => ({
          ...t,
          participantCount: countSnaps[i],
          adminName:
            adminMap[t.adminId]?.displayName ||
            adminMap[t.adminId]?.email ||
            'Desconocido',
          status: t.status || 'active',
        }));

        setTournaments(enriched);
        setTournamentsLoaded(true);
      } catch {
        toast.error('Error al cargar torneos');
      } finally {
        setTournamentsLoading(false);
      }
    };

    fetchTournaments();
  }, [activeTab, tournamentsLoaded]);

  // Load users on first visit to that tab
  useEffect(() => {
    if (activeTab !== 'users' || usersLoaded) return;
    setUsersLoading(true);

    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Count active tournaments per user
        const countSnaps = await Promise.all(
          raw.map((u) =>
            getDocs(
              query(
                collection(db, 'participants'),
                where('userId', '==', u.uid || u.id),
                where('status', '==', 'active')
              )
            ).then((s) => s.size)
          )
        );

        const enriched = raw.map((u, i) => ({
          ...u,
          tournamentCount: countSnaps[i],
        }));

        setUsers(enriched);
        setUsersLoaded(true);
      } catch {
        toast.error('Error al cargar usuarios');
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, [activeTab, usersLoaded]);

  const handleToggleStatus = async (tournament) => {
    const newStatus = tournament.status === 'active' ? 'inactive' : 'active';
    setUpdatingStatus(tournament.id);
    try {
      await updateDoc(doc(db, 'tournaments', tournament.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      setTournaments((prev) =>
        prev.map((t) => (t.id === tournament.id ? { ...t, status: newStatus } : t))
      );
      toast.success(`Torneo ${newStatus === 'active' ? 'activado' : 'desactivado'}`);
    } catch {
      toast.error('Error al cambiar estado');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleToggleUserStatus = async (user) => {
    const uid = user.uid || user.id;
    const newIsActive = user.isActive === false ? true : false;
    setUpdatingUserStatus(uid);
    try {
      await updateDoc(doc(db, 'users', uid), {
        isActive: newIsActive,
        updatedAt: serverTimestamp(),
      });
      setUsers((prev) =>
        prev.map((u) => ((u.uid || u.id) === uid ? { ...u, isActive: newIsActive } : u))
      );
      toast.success(`Usuario ${newIsActive ? 'activado' : 'desactivado'}`);
    } catch {
      toast.error('Error al cambiar estado del usuario');
    } finally {
      setUpdatingUserStatus(null);
    }
  };

  const handleSupportPassword = async (user) => {
    const uid = user.uid || user.id;
    setSendingSupport(uid);
    try {
      const idToken = await currentUser.getIdToken();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const res = await fetch(`${API_BASE_URL}/api/admin/support-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, targetEmail: user.email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Error');
      toast.success(`Clave temporal enviada a ${user.email}`);
    } catch (err) {
      toast.error(err.message || 'No fue posible enviar la clave temporal');
    } finally {
      setSendingSupport(null);
    }
  };

  const handleOpenUserTournaments = async (user) => {
    setSelectedUser(user);
    setLoadingUserTournaments(true);
    setUserTournaments([]);

    try {
      const uid = user.uid || user.id;

      const participantsSnap = await getDocs(
        query(
          collection(db, 'participants'),
          where('userId', '==', uid),
          where('status', '==', 'active')
        )
      );

      const items = await Promise.all(
        participantsSnap.docs.map(async (partDoc) => {
          const partData = partDoc.data();
          const tDoc = await getDoc(doc(db, 'tournaments', partData.tournamentId));
          if (!tDoc.exists()) return null;

          // Rank: fetch all active participants, sort in JS to avoid composite index requirement
          const allPartSnap = await getDocs(
            query(
              collection(db, 'participants'),
              where('tournamentId', '==', partData.tournamentId),
              where('status', '==', 'active')
            )
          );
          const sorted = allPartSnap.docs
            .map((d) => d.data())
            .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
          const rank = sorted.findIndex((d) => d.userId === uid) + 1;
          const total = sorted.length;

          return {
            tournamentId: partData.tournamentId,
            tournamentName: tDoc.data().name,
            points: partData.points ?? 0,
            rank: rank > 0 ? rank : total,
            total,
          };
        })
      );

      setUserTournaments(items.filter(Boolean));
    } catch {
      toast.error('Error al cargar torneos del usuario');
    } finally {
      setLoadingUserTournaments(false);
    }
  };

  // Filtered lists
  const filteredTournaments = tournaments.filter((t) => {
    const matchesName =
      !nameFilter || t.name?.toLowerCase().includes(nameFilter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesName && matchesStatus;
  });

  const filteredUsers = users.filter((u) => {
    if (!userSearch) return true;
    const s = userSearch.toLowerCase();
    return (
      (u.displayName || '').toLowerCase().includes(s) ||
      (u.username || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
          <LayoutDashboard className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Panel de Control</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Administración general de la plataforma</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('tournaments')}
          className={`flex items-center gap-2 px-5 py-3 font-medium text-sm transition border-b-2 ${
            activeTab === 'tournaments'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Torneos
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-5 py-3 font-medium text-sm transition border-b-2 ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Usuarios
        </button>
      </div>

      {/* ── Tournaments Tab ────────────────────────────────────────── */}
      {activeTab === 'tournaments' && (
        <div>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Buscar por nombre del torneo..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 text-sm"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>

          {tournamentsLoading ? (
            <div className="py-16 flex justify-center"><Loading /></div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              {filteredTournaments.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-14">
                  No se encontraron torneos
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-600">
                        <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-gray-300">
                          Nombre del torneo
                        </th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                          Participantes
                        </th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                          Estado
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                          Administrador
                        </th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {filteredTournaments.map((t) => (
                        <tr
                          key={t.id}
                          className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition"
                        >
                          <td className="px-5 py-3.5 font-medium text-gray-800 dark:text-gray-100">
                            {t.name}
                          </td>
                          <td className="px-4 py-3.5 text-center text-gray-600 dark:text-gray-300">
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-gray-400" />
                              {t.participantCount}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                t.status === 'active'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                              }`}
                            >
                              {t.status === 'active' ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">
                            {t.adminName}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => handleToggleStatus(t)}
                              disabled={updatingStatus === t.id}
                              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 ${
                                t.status === 'active'
                                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                              }`}
                            >
                              {updatingStatus === t.id
                                ? '...'
                                : t.status === 'active'
                                ? 'Desactivar'
                                : 'Activar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {!tournamentsLoading && (
            <p className="mt-2.5 text-xs text-gray-400 dark:text-gray-500">
              {filteredTournaments.length} torneo
              {filteredTournaments.length !== 1 ? 's' : ''} encontrado
              {filteredTournaments.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* ── Users Tab ─────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Buscar por nombre completo o nombre de usuario..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 text-sm"
            />
          </div>

          {usersLoading ? (
            <div className="py-16 flex justify-center"><Loading /></div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-14">
                  No se encontraron usuarios
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-600">
                        <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-gray-300">
                          Nombres y Apellidos
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                          Usuario
                        </th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                          Torneos participando
                        </th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                          Estado
                        </th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">
                          Soporte contraseña
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {filteredUsers.map((u) => (
                        <tr
                          key={u.id}
                          className={`transition ${
                            u.isActive === false
                              ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100/70 dark:hover:bg-red-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'
                          }`}
                        >
                          <td className="px-5 py-3.5 font-medium text-gray-800 dark:text-gray-100">
                            {u.displayName || '—'}
                          </td>
                          <td className="px-4 py-3.5 text-gray-500 dark:text-gray-400">
                            <span className="font-mono text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                              @{u.username || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => handleOpenUserTournaments(u)}
                              title="Ver torneos"
                              className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-semibold text-sm px-3 py-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                            >
                              <Trophy className="w-3.5 h-3.5" />
                              {u.tournamentCount}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              disabled={updatingUserStatus === (u.uid || u.id)}
                              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 ${
                                u.isActive === false
                                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                              }`}
                            >
                              {updatingUserStatus === (u.uid || u.id)
                                ? '...'
                                : u.isActive === false
                                ? 'Activar'
                                : 'Desactivar'}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => handleSupportPassword(u)}
                              disabled={sendingSupport === (u.uid || u.id)}
                              title="Generar y enviar clave temporal"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {sendingSupport === (u.uid || u.id) ? (
                                <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <KeyRound className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {!usersLoading && (
            <p className="mt-2.5 text-xs text-gray-400 dark:text-gray-500">
              {filteredUsers.length} usuario
              {filteredUsers.length !== 1 ? 's' : ''} encontrado
              {filteredUsers.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* ── Modal: User tournaments & positions ───────────────────── */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => {
          setSelectedUser(null);
          setUserTournaments([]);
        }}
        title={`Torneos de ${selectedUser?.displayName || selectedUser?.username || ''}`}
        size="md"
      >
        {loadingUserTournaments ? (
          <div className="py-8 flex justify-center">
            <Loading />
          </div>
        ) : userTournaments.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No participa en ningún torneo activo
          </p>
        ) : (
          <div className="space-y-2 text-left">
            {userTournaments.map((t) => (
              <div
                key={t.tournamentId}
                className="flex items-center justify-between bg-gray-50 dark:bg-slate-700 rounded-lg px-4 py-3 gap-3"
              >
                <span className="font-medium text-gray-800 dark:text-gray-100 text-sm flex-1 min-w-0 truncate">
                  {t.tournamentName}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {t.points} pts
                  </span>
                  <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                    #{t.rank} / {t.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
