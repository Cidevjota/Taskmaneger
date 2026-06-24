import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppNotification } from '../types';
import { useAuth } from './AuthContext';
import { fetchNotifications, saveNotification, deleteArchivedNotifications } from '../lib/api';

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'status'>) => void;
  markAsRead: (id: string) => void;
  markAsViewed: (id: string) => void;
  unarchive: (id: string) => void;
  postpone: (id: string) => void;
  markAsImportant: (id: string) => void;
  clearAll: () => void;
  clearArchived: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (currentUser) {
      loadNotifications(currentUser.id);
    } else {
      setNotifications([]);
    }
  }, [currentUser]);

  const loadNotifications = async (userId: string) => {
    try {
      const data = await fetchNotifications(userId);
      setNotifications(data);
    } catch (e) {
      console.error("Erro ao buscar notificações", e);
    }
  };

  const syncUpdate = async (notif: AppNotification) => {
    // Optimistic UI update
    setNotifications(prev => prev.map(n => n.id === notif.id ? notif : n));
    try {
      await saveNotification(notif);
    } catch (e) {
      console.error("Erro ao salvar notificação", e);
    }
  };

  const addNotification = async (notif: Omit<AppNotification, 'id' | 'createdAt' | 'status'>) => {
    if (!notif.userId) return;
    
    // We only perform duplicate check against currently loaded notifications (if target is me)
    // If target is someone else, it's harder to check duplicates efficiently without fetching,
    // but we can just insert it. Let's insert directly.
    const isDuplicate = notifications.some(n => {
      if (n.userId !== notif.userId) return false;
      if (n.taskId !== notif.taskId || n.type !== notif.type) return false;
      
      if (notif.type === 'deadline') {
        return n.message === notif.message && (new Date().getTime() - new Date(n.createdAt).getTime() < 1000 * 60 * 60 * 24);
      }
      
      if (notif.type === 'reminder') {
        return n.message === notif.message && (new Date().getTime() - new Date(n.createdAt).getTime() < 1000 * 60 * 60);
      }

      return n.actorId === notif.actorId && 
             n.message === notif.message &&
             (new Date().getTime() - new Date(n.createdAt).getTime() < 5000);
    });
    
    if (isDuplicate) return;

    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'unread',
      createdAt: new Date().toISOString()
    };
    
    if (currentUser?.id === notif.userId) {
      setNotifications(prev => [newNotif, ...prev]);
    }

    try {
      await saveNotification(newNotif);
    } catch (e) {
      console.error("Erro ao adicionar notificação", e);
    }
  };

  const markAsRead = (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (notif && notif.status === 'unread') {
      syncUpdate({ ...notif, status: 'read' });
    }
  };

  const markAsViewed = (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (notif) {
      syncUpdate({ ...notif, status: 'viewed', viewedAt: new Date().toISOString() });
    }
  };

  const unarchive = (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (notif && notif.status === 'viewed') {
      const { viewedAt, ...rest } = notif;
      syncUpdate({ ...rest, status: 'read' });
    }
  };

  const postpone = (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (notif) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const postponedTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      syncUpdate({ ...notif, status: 'postponed', postponedUntil: postponedTime, createdAt: postponedTime });
    }
  };

  const markAsImportant = (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (notif) {
      syncUpdate({ ...notif, status: notif.status === 'important' ? 'unread' : 'important' });
    }
  };

  const clearAll = () => {
    // We won't implement a DB wipe for clearAll to be safe, only clearArchived
    setNotifications([]);
  };
  
  const clearArchived = async () => {
    if (!currentUser) return;
    setNotifications(prev => prev.filter(n => n.status !== 'viewed'));
    try {
      await deleteArchivedNotifications(currentUser.id);
    } catch (e) {
      console.error("Erro ao deletar arquivadas", e);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, markAsRead, markAsViewed, unarchive, postpone, markAsImportant, clearAll, clearArchived }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
