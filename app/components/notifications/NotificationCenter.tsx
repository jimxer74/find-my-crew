'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
}: NotificationCenterProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

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

  if (!isOpen) return null;

  const handleNotificationClick = (notification: Notification) => {
    if (notification.link) {
      router.push(notification.link);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/20 z-40 sm:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute right-0 top-full mt-2 w-screen sm:w-96 max-w-[calc(100vw-1rem)] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground">Notifications</h2>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-sm text-primary hover:text-primary/80 transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <svg
                className="w-12 h-12 text-muted-foreground/50 mb-3"
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
              <p className="text-muted-foreground">No notifications yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                We&apos;ll notify you when something happens
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
                    {isLoading ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
