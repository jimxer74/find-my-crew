'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NotificationItem } from './NotificationItem';
import { type Notification } from '@/app/lib/notifications';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}

interface NotificationPageContentProps {
  onClose: () => void;
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function NotificationCenter({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onLoadMore,
  hasMore,
  buttonRef,
}: NotificationCenterProps) {
  const t = useTranslations('notifications');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside (desktop only)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only handle click-outside on desktop (md breakpoint = 768px)
      if (window.innerWidth < 768) return;

      const target = event.target as Node;
      // Don't close if clicking on the button or the panel
      if (buttonRef?.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, buttonRef]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Don't render at all if not open - this prevents blocking
  if (!isOpen) return null;

  // Use portal to render outside Header DOM
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed top-16 bottom-0 right-0 w-full md:w-80 lg:w-96 bg-card border-l border-border shadow-xl z-[120] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center px-4 py-3 border-b border-border bg-card">
        {/* Close button - mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-2 -ml-2 mr-2 hover:bg-accent rounded-md transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-foreground">{t('title')}</h2>
      </div>

      {/* Notification list - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <NotificationPageContent
          onClose={onClose}
          notifications={notifications}
          unreadCount={unreadCount}
          isLoading={isLoading}
          onMarkAsRead={onMarkAsRead}
          onMarkAllAsRead={onMarkAllAsRead}
          onDelete={onDelete}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
        />
      </div>
    </div>,
    document.body
  );
}

// Content component that can be used in both modal and page modes
export function NotificationPageContent({
  onClose,
  notifications,
  unreadCount,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onLoadMore,
  hasMore,
}: NotificationPageContentProps) {
  const t = useTranslations('notifications');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const handleNotificationClick = (notification: Notification) => {
    if (notification.link) {
      // Close first, then navigate
      onClose();
      // Dispatch event to close all dialogs
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('closeAllDialogs'));
      }
      // Use setTimeout to ensure close happens before navigation
      setTimeout(() => {
        router.push(notification.link!);
      }, 100);
    }
  };

  return (
    <div>
      {isLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <svg
                className="w-16 h-16 text-muted-foreground/30 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <p className="text-foreground font-medium">{t('noNotificationsYet')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('notifyWhenHappens')}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={onMarkAsRead}
                    onDelete={onDelete}
                    onClick={handleNotificationClick}
                  />
                ))}
              </div>

              {/* Load more button */}
              {hasMore && onLoadMore && (
                <div className="p-3 border-t border-border">
                  <button
                    onClick={onLoadMore}
                    disabled={isLoading}
                    className="w-full py-2 text-sm text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? tCommon('loading') : t('loadMore')}
                  </button>
                </div>
              )}
            </>
          )}
    </div>
  );
}
