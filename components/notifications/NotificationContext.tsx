'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';

export type AppNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  related_id: string | null;
  related_type: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

type State = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
};

type Ctx = State & {
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
};

const NotificationContext = createContext<Ctx | null>(null);

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_NOTIFICATIONS'; payload: AppNotification[] }
  | { type: 'ADD'; payload: AppNotification }
  | { type: 'MARK_READ'; payload: string }
  | { type: 'MARK_ALL' }
  | { type: 'DELETE'; payload: string }
  | { type: 'CLEAR' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_NOTIFICATIONS': {
      const unreadCount = action.payload.filter(n => !n.is_read).length;
      return {
        ...state,
        notifications: action.payload,
        unreadCount,
        loading: false,
        error: null,
      };
    }
    case 'ADD': {
      const notifications = [action.payload, ...state.notifications];
      return {
        ...state,
        notifications,
        unreadCount: notifications.filter(n => !n.is_read).length,
      };
    }
    case 'MARK_READ': {
      const notifications = state.notifications.map(n =>
        n.id === action.payload
          ? { ...n, is_read: true, read_at: new Date().toISOString() }
          : n,
      );
      return {
        ...state,
        notifications,
        unreadCount: notifications.filter(n => !n.is_read).length,
      };
    }
    case 'MARK_ALL':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.is_read ? n : { ...n, is_read: true, read_at: new Date().toISOString() },
        ),
        unreadCount: 0,
      };
    case 'DELETE': {
      const notifications = state.notifications.filter(n => n.id !== action.payload);
      return {
        ...state,
        notifications,
        unreadCount: notifications.filter(n => !n.is_read).length,
      };
    }
    case 'CLEAR':
      return { notifications: [], unreadCount: 0, loading: false, error: null };
    default:
      return state;
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    notifications: [],
    unreadCount: 0,
    loading: true,
    error: null,
  });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      if (!session?.user) dispatch({ type: 'CLEAR' });
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchNotifications = useCallback(async (uid: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      dispatch({ type: 'SET_NOTIFICATIONS', payload: (data as AppNotification[]) || [] });
    } catch (e) {
      dispatch({
        type: 'SET_ERROR',
        payload: e instanceof Error ? e.message : 'Error al cargar notificaciones',
      });
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      dispatch({ type: 'CLEAR' });
      return;
    }
    void fetchNotifications(userId);
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          const n = payload.new as AppNotification;
          dispatch({ type: 'ADD', payload: n });
          try {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(n.title, { body: n.message, tag: `notification-${n.id}` });
            }
          } catch {
            /* ignore */
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          const n = payload.new as AppNotification;
          if (n.is_read) dispatch({ type: 'MARK_READ', payload: n.id });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          dispatch({ type: 'DELETE', payload: (payload.old as AppNotification).id });
        },
      )
      .subscribe();

    try {
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'default'
      ) {
        void Notification.requestPermission();
      }
    } catch {
      /* ignore */
    }

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      const supabase = createClient();
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);
      dispatch({ type: 'MARK_READ', payload: id });
    },
    [userId],
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);
    dispatch({ type: 'MARK_ALL' });
  }, [userId]);

  const deleteNotification = useCallback(
    async (id: string) => {
      if (!userId) return;
      const supabase = createClient();
      await supabase.from('notifications').delete().eq('id', id).eq('user_id', userId);
      dispatch({ type: 'DELETE', payload: id });
    },
    [userId],
  );

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      refreshNotifications: () => (userId ? fetchNotifications(userId) : Promise.resolve()),
    }),
    [state, markAsRead, markAllAsRead, deleteNotification, fetchNotifications, userId],
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications debe usarse dentro de NotificationProvider');
  }
  return ctx;
}
