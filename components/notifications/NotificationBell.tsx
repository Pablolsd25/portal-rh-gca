'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  BanknotesIcon,
  BellIcon,
  CheckCircleIcon,
  CreditCardIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useNotifications, type AppNotification } from './NotificationContext';

function TypeIcon({ n }: { n: AppNotification }) {
  const cls = 'w-5 h-5 shrink-0 mt-0.5';
  switch (n.type) {
    case 'approval_request':
      switch (n.related_type) {
        case 'credit':
          return <CreditCardIcon className={`${cls} text-purple-400`} />;
        case 'payment':
          return <BanknotesIcon className={`${cls} text-orange-400`} />;
        default:
          return <ExclamationCircleIcon className={`${cls} text-amber-400`} />;
      }
    case 'approval_response':
      return /aprobad/i.test(n.title) ? (
        <CheckCircleIcon className={`${cls} text-green-400`} />
      ) : (
        <XMarkIcon className={`${cls} text-red-400`} />
      );
    case 'credit_approval':
      return <CreditCardIcon className={`${cls} text-blue-400`} />;
    default:
      return <InformationCircleIcon className={`${cls} text-rose-300`} />;
  }
}

function accentFor(n: AppNotification): string {
  if (n.is_read) return 'border-l-4 border-transparent opacity-70';
  switch (n.type) {
    case 'approval_request':
      switch (n.related_type) {
        case 'credit':
          return 'bg-purple-500/10 border-l-4 border-purple-500';
        case 'payment':
          return 'bg-orange-500/10 border-l-4 border-orange-500';
        default:
          return 'bg-amber-500/10 border-l-4 border-amber-500';
      }
    case 'approval_response':
      return /aprobad/i.test(n.title)
        ? 'bg-green-500/10 border-l-4 border-green-500'
        : 'bg-red-500/10 border-l-4 border-red-500';
    case 'credit_approval':
      return 'bg-blue-500/10 border-l-4 border-blue-500';
    default:
      return 'bg-rose-900/20 border-l-4 border-rose-700';
  }
}

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
          open ? 'bg-rose-800 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
        }`}
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
      >
        <BellIcon className="w-5 h-5" />
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
            <div className="fixed z-[90] top-3 left-3 right-3 md:left-64 md:right-auto md:w-[400px] max-h-[calc(100vh-1.5rem)] overflow-hidden rounded-xl border border-rose-800/50 bg-gradient-to-b from-rose-950 via-rose-900 to-rose-950 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-rose-800/50">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">Notificaciones</p>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-medium text-amber-300 bg-amber-500/20 rounded-full border border-amber-500/30">
                      {unreadCount} nuevas
                    </span>
                  )}
                  {loading && <span className="text-[11px] text-rose-300">Cargando…</span>}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllAsRead()}
                      className="text-[11px] text-amber-300 hover:text-amber-200"
                    >
                      Marcar todas
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="p-1 text-rose-300 hover:text-white rounded-full hover:bg-rose-800/50 transition-colors"
                    aria-label="Cerrar panel"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1 divide-y divide-rose-800/30">
                {notifications.length === 0 ? (
                  <p className="p-6 text-center text-sm text-rose-300">Sin notificaciones</p>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 transition-colors hover:bg-rose-800/20 ${accentFor(n)}`}
                    >
                      <button
                        type="button"
                        onClick={() => void openRelated(n)}
                        className="w-full text-left flex items-start gap-3"
                      >
                        <TypeIcon n={n} />
                        <div className="min-w-0">
                          <p
                            className={`text-sm text-white ${!n.is_read ? 'font-semibold' : 'font-medium'}`}
                          >
                            {n.title}
                          </p>
                          <p className="text-xs text-rose-200 mt-1 line-clamp-2">{n.message}</p>
                          <p className="text-[11px] text-rose-400 mt-1">{relativeTime(n.created_at)}</p>
                        </div>
                      </button>
                      <div className="mt-2 flex gap-3 text-[11px] pl-8">
                        {!n.is_read && (
                          <button
                            type="button"
                            className="text-amber-300 hover:text-amber-200"
                            onClick={() => void markAsRead(n.id)}
                          >
                            Marcar leída
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-red-400 hover:text-red-300"
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
