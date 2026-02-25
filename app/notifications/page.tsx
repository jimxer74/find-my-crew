'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NotificationPageContent } from '@shared/components/notifications/NotificationCenter';
import { useNotificationContext } from '@/app/contexts/NotificationContext';
import { useAssistant } from '@/app/contexts/AssistantContext';

export default function NotificationsPage() {
  const t = useTranslations('notifications');
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
  const { pendingActions, approveAction, rejectAction, redirectToProfile } = useAssistant();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile header */}
      <div className="md:hidden flex items-center px-4 py-3 border-b border-border bg-card">
        <h1 className="text-lg font-semibold text-foreground">{t('title')}</h1>
      </div>
      <main className="flex-1 overflow-y-auto">
        <NotificationPageContent
          onClose={() => router.back()}
          notifications={notifications}
          pendingActions={pendingActions}
          unreadCount={unreadCount}
          isLoading={isLoading}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDelete={deleteNotification}
          onLoadMore={loadMore}
          hasMore={hasMore}
          onApproveAction={approveAction}
          onRejectAction={rejectAction}
          onRedirectToProfile={redirectToProfile}
        />
      </main>
    </div>
  );
}
