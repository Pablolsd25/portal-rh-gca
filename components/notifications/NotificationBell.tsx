'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useNotifications, type AppNotification } from './NotificationContext';

function hrefFor(n: AppNotification): string | null {
  if (!n.related_id) return null;
  switch (n.related_type) {
    case 'quote':
      return `/dashboard/cotizaciones`;
    case 'credit':
      return `/dashboard/creditos/${n.related_id}`;
    case 'payment':
      return `/dashboard/aprobacion-pagos`;
    default:
      return null;
  }
}

function relativeTime(dateString: string) {
  const date = new Date(dateString);
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return 'Ahora';
  if (diff < 60) return `Hace ${diff} min`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Hace ${d}d`;
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export default function NotificationBell() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const bellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const openRelated = async (n: AppNotification) => {
    if (!n.is_read) await markAsRead(n.id);
    const href = hrefFor(n);
    setOpen(false);
    if (href) router.push(href);
  };

  return (
    <div className="relative">
      <button
        ref={bellRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`relative p-2 rounded-lg transition-colors ${
          open ? 'bg-emerald-700 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
        }`}
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {mounted &&
        open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[80] bg-black/40" onClick={() => setOpen(false)} />
            <div className="fixed z-[90] top-3 left-3 right-3 md:left-64 md:right-auto md:w-[400px] max-h-[calc(100vh-1.5rem)] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <div>
                  <p className="text-sm font-semibold text-white">Notificaciones</p>
                  <p className="text-[11px] text-slate-400">
                    {loading ? 'Cargando…' : `${unreadCount} sin leer`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllAsRead()}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300"
                    >
                      Marcar todas
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-slate-400 hover:text-white text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-400">Sin notificaciones</p>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`border-b border-slate-800 px-4 py-3 ${
                        n.is_read ? 'opacity-70' : 'bg-slate-800/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void openRelated(n)}
                        className="w-full text-left"
                      >
                        <p className="text-sm text-white font-medium">{n.title}</p>
                        <p className="text-xs text-slate-300 mt-1 line-clamp-2">{n.message}</p>
                        <p className="text-[11px] text-slate-500 mt-1">{relativeTime(n.created_at)}</p>
                      </button>
                      <div className="mt-2 flex gap-3 text-[11px]">
                        {!n.is_read && (
                          <button
                            type="button"
                            className="text-emerald-400"
                            onClick={() => void markAsRead(n.id)}
                          >
                            Marcar leída
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-red-400"
                          onClick={() => void deleteNotification(n.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
