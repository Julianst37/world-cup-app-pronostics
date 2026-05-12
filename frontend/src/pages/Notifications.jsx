import { useNotifications } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatColombiaTime } from '../utils/helpers';
import Loading from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';
import { Clock, CheckCircle2, XCircle, Ban, Bell, Inbox, BellOff } from 'lucide-react';
import { registerFCMToken } from '../hooks/usePushNotifications';
import { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const NOTIFICATION_TYPES = {
  pending_approval: {
    title: 'Solicitud de aprobación',
    Icon: Clock,
    iconClass: 'text-yellow-600',
    message: (n) => `${n.userName} solicita unirse a "${n.tournamentName}"`,
    color: 'bg-yellow-50 border-yellow-300',
    titleColor: 'text-yellow-900',
    textColor: 'text-yellow-900',
  },
  approved: {
    title: 'Aprobado',
    Icon: CheckCircle2,
    iconClass: 'text-green-500',
    message: (n) => `Fuiste aprobado en "${n.tournamentName}"`,
    color: 'bg-green-50 border-green-200',
    textColor: 'text-gray-600',
  },
  rejected: {
    title: 'Rechazado',
    Icon: XCircle,
    iconClass: 'text-red-500',
    message: (n) => `Tu solicitud en "${n.tournamentName}" fue rechazada`,
    color: 'bg-red-50 border-red-200',
    textColor: 'text-gray-600',
  },
  disabled: {
    title: 'Deshabilitado',
    Icon: Ban,
    iconClass: 'text-gray-500',
    message: (n) => `Fuiste deshabilitado en "${n.tournamentName}"`,
    color: 'bg-gray-50 border-gray-200',
    textColor: 'text-gray-600',
  },
};

export default function Notifications() {
  const { notifications, loading, markAsRead } = useNotifications();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [pushPermission, setPushPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'granted'
  );

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPushPermission(Notification.permission);
    }
  }, []);

  const handleEnablePush = async () => {
    await registerFCMToken(currentUser);
    if (typeof Notification !== 'undefined') {
      setPushPermission(Notification.permission);
    }
    if (Notification.permission === 'granted') {
      toast.success('Notificaciones push activadas');
    }
  };

  if (loading) return <Loading />;

  const handleNotificationClick = async (notification) => {
    await markAsRead(notification.id);

    if (!notification.tournamentId) return;

    // Determine redirect based on type
    if (notification.type === 'pending_approval') {
      // Admin receiving a join request → go to participants list
      navigate(`/tournaments/${notification.tournamentId}/participants`);
      return;
    }

    // For approved/rejected/disabled — participant needs active access check
    if (
      currentUser &&
      notification.userId === currentUser.uid
    ) {
      if (notification.type === 'rejected') {
        // Rejected — no access, nothing to navigate to
        return;
      }
      if (notification.type === 'approved') {
        const idToken = await currentUser.getIdToken();
        const res = await fetch(`${API_BASE_URL}/api/tournaments/${notification.tournamentId}/participants`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const participants = res.ok ? await res.json() : [];
        const participant = participants.find((p) => p.userId === currentUser.uid);
        if (!participant || participant.status !== 'active') {
          toast.error('Ya no tienes acceso activo a esa polla');
          navigate('/dashboard');
          return;
        }
      }
      navigate(`/tournaments/${notification.tournamentId}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2"><Bell className="w-7 h-7" /> Notificaciones</h1>

      {pushPermission === 'denied' && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          <BellOff className="w-5 h-5 shrink-0" />
          <span>Las notificaciones push están bloqueadas en este navegador. Para activarlas, haz clic en el ícono de candado junto a la URL y permite las notificaciones.</span>
        </div>
      )}

      {pushPermission === 'default' && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 shrink-0" />
            <span>Activa las notificaciones push para recibir alertas de pollas en tiempo real.</span>
          </div>
          <button
            onClick={handleEnablePush}
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Activar
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No tienes notificaciones</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const type = NOTIFICATION_TYPES[notification.type] || NOTIFICATION_TYPES.pending_approval;
            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`border rounded-xl p-4 cursor-pointer transition hover:shadow-md ${type.color} ${
                  !notification.read ? 'border-l-4' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                  <h3 className={`font-bold flex items-center gap-1.5 ${type.titleColor || 'text-gray-800'}`}><type.Icon className={`w-4 h-4 ${type.iconClass}`} /> {type.title}</h3>
                    <p className={`text-sm mt-1 ${type.textColor}`}>{type.message(notification)}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatColombiaTime(new Date(notification.createdAt))}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-3 h-3 bg-blue-600 rounded-full mt-1 ml-3"></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}