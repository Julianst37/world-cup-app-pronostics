import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  or,
  onSnapshot,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './useAuth';

export function useNotifications() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    // Single query with OR filter instead of two separate listeners
    const q = query(
      collection(db, 'notifications'),
      or(
        where('adminId', '==', currentUser.uid),
        where('userId', '==', currentUser.uid)
      )
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const uid = currentUser.uid;
        const merged = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((n) => {
            if (n.adminId === uid) return true;
            if (n.userId === uid) return n.type !== 'pending_approval';
            return false;
          })
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          });

        setNotifications(merged);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading notifications:', err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  const markAsRead = async (notificationId) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
      });
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, loading, unreadCount, markAsRead };
}

export default useNotifications;