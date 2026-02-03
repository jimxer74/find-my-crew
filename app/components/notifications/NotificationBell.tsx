'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NotificationCenter } from './NotificationCenter';
import { useNotificationContext } from '@/app/contexts/NotificationContext';

export function NotificationBell() {
  const t = useTranslations('navigation');
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close notifications when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Listen for close all dialogs event
  useEffect(() => {
    const handleCloseAll = () => {
      setIsOpen(false);
    };
    window.addEventListener('closeAllDialogs', handleCloseAll);
    return () => {
      window.removeEventListener('closeAllDialogs', handleCloseAll);
    };
  }, []);
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    hasMore,
  } = useNotificationContext();

  const handleToggle = useCallback(() => {
    // Toggle panel on both mobile and desktop
    setIsOpen((prev) => !prev);
    // Don't refresh automatically - use cached notifications from state
    // Notifications are already loaded and kept in sync via realtime updates
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <div>
      {/* Bell button - shows X icon when open */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative flex items-center justify-center p-2 min-h-[44px] min-w-[44px] rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        aria-label={`${t('notifications')}${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg
          className="w-5 h-5 text-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        >
          {isOpen ? (
            <path d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          )}
        </svg>

        {/* Unread badge - only show when closed */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification center - rendered as sibling to escape stacking context */}
      <NotificationCenter
        isOpen={isOpen}
        onClose={handleClose}
        notifications={notifications}
        unreadCount={unreadCount}
        isLoading={isLoading}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={deleteNotification}
        onLoadMore={loadMore}
        hasMore={hasMore}
        buttonRef={buttonRef}
      />
    </div>
  );
}
