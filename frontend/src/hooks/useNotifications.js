import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
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

    const notificationsRef = collection(db, 'notifications');
    const adminQuery = query(
      notificationsRef,
      where('adminId', '==', currentUser.uid)
    );
    const userQuery = query(
      notificationsRef,
      where('userId', '==', currentUser.uid)
    );

    let adminNotifications = [];
    let userNotifications = [];

    const mergeNotifications = () => {
      const merged = [...adminNotifications, ...userNotifications]
        .filter((notification) => {
          if (notification.adminId === currentUser.uid) {
            return true;
          }

          if (notification.userId === currentUser.uid) {
            return notification.type !== 'pending_approval';
          }

          return false;
        })
        .filter((notification, index, array) => array.findIndex((item) => item.id === notification.id) === index)
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

      setNotifications(merged);
      setLoading(false);
    };

    const handleError = (err) => {
      console.error('Error loading notifications:', err);
      setLoading(false);
    };

    const unsubscribeAdmin = onSnapshot(
      adminQuery,
      (snapshot) => {
        adminNotifications = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        mergeNotifications();
      },
      handleError
    );

    const unsubscribeUser = onSnapshot(
      userQuery,
      (snapshot) => {
        userNotifications = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        mergeNotifications();
      },
      handleError
    );

    return () => {
      unsubscribeAdmin();
      unsubscribeUser();
    };
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