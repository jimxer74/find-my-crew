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
}: NotificationCenterProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside (desktop only)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only handle click-outside on desktop (md breakpoint = 768px)
      if (window.innerWidth < 768) return;

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

  // Don't render at all if not open - this prevents blocking
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="hidden md:block fixed inset-0 top-[4rem] bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel - desktop only (mobile uses /notifications page) */}
      <div
        ref={panelRef}
        className="fixed left-0 right-0 md:left-auto md:right-4 top-[4rem] md:top-[5rem] w-full md:w-[400px] h-[calc(100vh-4rem)] md:h-auto md:max-h-[calc(100vh-6rem)] bg-background md:bg-card md:border md:border-border md:rounded-lg md:shadow-lg z-[105] overflow-hidden flex flex-col pointer-events-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
          <button
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-accent rounded-md transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-foreground"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Notification list */}
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
    </>
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
    <div className="flex-1 overflow-y-auto">
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
              <p className="text-foreground font-medium">No notifications yet</p>
              <p className="text-sm text-muted-foreground mt-1">
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
  );
}
