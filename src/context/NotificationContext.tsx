import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppNotification } from '../types';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'status'>) => void;
  markAsRead: (id: string) => void;
  markAsViewed: (id: string) => void;
  unarchive: (id: string) => void;
  postpone: (id: string) => void;
  markAsImportant: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (currentUser) {
      const saved = localStorage.getItem(`@taskmanager:notifications:${currentUser.id}`);
      if (saved) {
        try {
          setNotifications(JSON.parse(saved));
        } catch(e) {}
      } else {
        setNotifications([]);
      }
    }
  }, [currentUser]);

  const save = (newNotifs: AppNotification[]) => {
    setNotifications(newNotifs);
    if (currentUser) {
      localStorage.setItem(`@taskmanager:notifications:${currentUser.id}`, JSON.stringify(newNotifs));
    }
  };

  const addNotification = (notif: Omit<AppNotification, 'id' | 'createdAt' | 'status'>) => {
    if (!notif.userId) return;
    
    const targetUserId = notif.userId;
    const targetKey = `@taskmanager:notifications:${targetUserId}`;

    // Load target user's notifications
    let targetNotifs: AppNotification[] = [];
    const saved = localStorage.getItem(targetKey);
    if (saved) {
      try { targetNotifs = JSON.parse(saved); } catch(e) {}
    }
    
    // Evita duplicatas exatas recentes
    const isDuplicate = targetNotifs.some(n => {
      if (n.taskId !== notif.taskId || n.type !== notif.type) return false;
      
      if (notif.type === 'deadline') {
        // Evita mesma notificação de prazo no período de 24 horas
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
    
    targetNotifs = [newNotif, ...targetNotifs];
    localStorage.setItem(targetKey, JSON.stringify(targetNotifs));

    // Se o usuário alvo for o usuário atual logado, atualiza o state da UI
    if (currentUser?.id === targetUserId) {
      setNotifications(targetNotifs);
    }
  };

  const markAsRead = (id: string) => {
    save(notifications.map(n => n.id === id && n.status === 'unread' ? { ...n, status: 'read' } : n));
  };

  const markAsViewed = (id: string) => {
    save(notifications.map(n => n.id === id ? { ...n, status: 'viewed', viewedAt: new Date().toISOString() } : n));
  };

  const unarchive = (id: string) => {
    save(notifications.map(n => {
      if (n.id === id && n.status === 'viewed') {
        const { viewedAt, ...rest } = n;
        return { ...rest, status: 'read' };
      }
      return n;
    }));
  };

  const postpone = (id: string) => {
    save(notifications.map(n => {
      if (n.id === id) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const postponedTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        return { ...n, status: 'postponed', postponedUntil: postponedTime, createdAt: postponedTime };
      }
      return n;
    }));
  };

  const markAsImportant = (id: string) => {
    save(notifications.map(n => {
      if (n.id === id) {
        return { ...n, status: n.status === 'important' ? 'unread' : 'important' };
      }
      return n;
    }));
  };

  const clearAll = () => save([]);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, markAsRead, markAsViewed, unarchive, postpone, markAsImportant, clearAll }}>
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
