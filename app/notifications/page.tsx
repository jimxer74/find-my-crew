'use client';

import { useRouter } from 'next/navigation';
import { NotificationPageContent } from '@/app/components/notifications/NotificationCenter';
import { useNotificationContext } from '@/app/contexts/NotificationContext';

export default function NotificationsPage() {
  const router = useRouter();
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile header */}
      <div className="md:hidden flex items-center px-4 py-3 border-b border-border bg-card">
        <h1 className="text-lg font-semibold text-foreground">Notifications</h1>
      </div>
      <main className="flex-1 overflow-y-auto">
        <NotificationPageContent
          onClose={() => router.back()}
          notifications={notifications}
          unreadCount={unreadCount}
          isLoading={isLoading}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDelete={deleteNotification}
          onLoadMore={loadMore}
          hasMore={hasMore}
        />
      </main>
    </div>
  );
}
