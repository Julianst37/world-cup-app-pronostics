import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { invalidateTournamentsCache } from './useTournaments';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

export function useNotifications() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);
  const prevApprovalRef = useRef(false);

  const fetchNotifications = useCallback(async (user) => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) return;
      const uid = user.uid;
      const all = await res.json();
      const merged = all
        .filter((n) => {
          if (n.adminId === uid) return true;
          if (n.userId === uid) return n.type !== 'pending_approval';
          return false;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const hasApproval = merged.some((n) => n.userId === uid && n.type === 'approved');
      if (hasApproval && !prevApprovalRef.current) {
        invalidateTournamentsCache(uid);
      }
      prevApprovalRef.current = hasApproval;

      setNotifications(merged);
      setLoading(false);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    fetchNotifications(currentUser);

    intervalRef.current = setInterval(() => {
      fetchNotifications(currentUser);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalRef.current);
  }, [currentUser, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId) => {
    if (!currentUser) return;
    try {
      const idToken = await currentUser.getIdToken();
      await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, [currentUser]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, loading, unreadCount, markAsRead };
}

export default useNotifications;
