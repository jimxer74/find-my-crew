'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { useAuth } from '@/app/contexts/AuthContext';
import { logger } from '@shared/logging';
import type { Notification } from '@/app/lib/notifications';
import type { RealtimeChannel } from '@supabase/supabase-js';

const NOTIFICATIONS_PER_PAGE = 5;
const POLL_INTERVAL = 60000; // 10 seconds fallback polling

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  refresh: () => Promise<void>;
  // Action confirmation state
  activeInputModal: string | null;
  setActiveInputModal: (actionId: string | null) => void;
  // Action confirmation handlers
  approveAction: (actionId: string) => Promise<void>;
  rejectAction: (actionId: string) => Promise<void>;
  submitActionInput: (actionId: string, value: string | string[]) => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [activeInputModal, setActiveInputModal] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (reset = false) => {
    if (!user) return;

    const currentOffset = reset ? 0 : offset;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/notifications?limit=${NOTIFICATIONS_PER_PAGE}&offset=${currentOffset}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('[useNotifications] API error', { status: response.status, errorData });
        throw new Error(errorData.error || `Failed to fetch notifications (${response.status})`);
      }

      const data = await response.json();

      if (!isMountedRef.current) return;

      if (reset) {
        setNotifications(data.notifications);
        setOffset(NOTIFICATIONS_PER_PAGE);
      } else {
        setNotifications((prev) => [...prev, ...data.notifications]);
        setOffset((prev) => prev + NOTIFICATIONS_PER_PAGE);
      }

      setUnreadCount(data.unread_count);
      setHasMore(data.notifications.length === NOTIFICATIONS_PER_PAGE);
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message);
        logger.error('[useNotifications] Error fetching', { error: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user, offset]);

  // Fetch unread count only
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/notifications/unread-count');
      if (response.ok) {
        const data = await response.json();
        if (isMountedRef.current) {
          setUnreadCount(data.count);
        }
      }
    } catch (err) {
      logger.error('[useNotifications] Error fetching unread count', { error: err instanceof Error ? err.message : String(err) });
    }
  }, [user]);

  // Initial fetch and realtime subscription
  useEffect(() => {
    isMountedRef.current = true;

    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      hasLoadedRef.current = false;
      lastUserIdRef.current = null;
      return;
    }

    // Only fetch if user changed or if we haven't loaded yet
    const shouldFetch = !hasLoadedRef.current || lastUserIdRef.current !== user.id;

    if (shouldFetch) {
      // Initial fetch - call directly instead of using callback to avoid dependency issues
      const doInitialFetch = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(`/api/notifications?limit=${NOTIFICATIONS_PER_PAGE}&offset=0`);
          if (response.ok) {
            const data = await response.json();
            if (isMountedRef.current) {
              setNotifications(data.notifications);
              setUnreadCount(data.unread_count);
              setOffset(NOTIFICATIONS_PER_PAGE);
              setHasMore(data.notifications.length === NOTIFICATIONS_PER_PAGE);
              hasLoadedRef.current = true;
              lastUserIdRef.current = user.id;
            }
          }
        } catch (err) {
          logger.error('[useNotifications] Initial fetch error', { error: err instanceof Error ? err.message : String(err) });
        } finally {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        }
      };

      doInitialFetch();
    }

    // Set up Supabase Realtime subscription
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          logger.debug('[useNotifications] New notification via realtime', { payload });
          if (isMountedRef.current) {
            const newNotification = payload.new as Notification;
            setNotifications((prev) => [newNotification, ...prev]);
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          logger.debug('[useNotifications] Notification updated via realtime', { payload });
          if (isMountedRef.current) {
            const updatedNotification = payload.new as Notification;
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === updatedNotification.id ? updatedNotification : n
              )
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          logger.debug('[useNotifications] Notification deleted via realtime', { payload });
          if (isMountedRef.current) {
            const deletedId = (payload.old as { id: string }).id;
            setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
          }
        }
      )
      .subscribe((status) => {
        logger.debug('[useNotifications] Realtime subscription status', { status });
      });

    channelRef.current = channel;

    // Fallback polling (in case realtime doesn't work)
    const pollInterval = setInterval(async () => {
      if (!isMountedRef.current) return;
      try {
        //const response = await fetch('/api/notifications/unread-count');
        const response = await fetch(`/api/notifications?limit=${NOTIFICATIONS_PER_PAGE}&offset=0`);
        if (response.ok) {
          const data = await response.json();
          if (isMountedRef.current) {
            setUnreadCount(data.unread_count);
            setNotifications(data.notifications);
          }
        }
      } catch (err) {
        // Silently ignore polling errors
      }
    }, POLL_INTERVAL);

    return () => {
      isMountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      clearInterval(pollInterval);
    };
  }, [user]); // Only depend on user - not callbacks

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      logger.error('[useNotifications] Error marking as read', { error: err instanceof Error ? err.message : String(err) });
      setError(err.message);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err: any) {
      logger.error('[useNotifications] Error marking all as read', { error: err instanceof Error ? err.message : String(err) });
      setError(err.message);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      // Optimistic update
      const notification = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err: any) {
      logger.error('[useNotifications] Error deleting', { error: err instanceof Error ? err.message : String(err) });
      setError(err.message);
    }
  }, [notifications]);

  // Load more notifications
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await fetchNotifications(false);
  }, [hasMore, isLoading, fetchNotifications]);

  // Manual refresh - resets cache and fetches fresh data
  const refresh = useCallback(async () => {
    hasLoadedRef.current = false; // Reset cache flag to force fresh fetch
    setOffset(0); // Reset offset
    await fetchNotifications(true);
    hasLoadedRef.current = true; // Mark as loaded after refresh
  }, [fetchNotifications]);

  // Action confirmation handlers
  const approveAction = useCallback(async (actionId: string) => {
    /*
    try {
      const response = await fetch(`/api/ai/assistant/actions/${actionId}/approve`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to approve action');
      }

      // Remove the notification since action is completed
      setNotifications((prev) => prev.filter((n) => n.id !== actionId));
      if (unreadCount > 0) {
        setUnreadCount((prev) => prev - 1);
      }
    } catch (err: any) {
      logger.error('[useNotifications] Error approving action:', { error: err instanceof Error ? err.message : String(err) });
      setError(err.message);
    }*/
  }, [unreadCount]);

  const rejectAction = useCallback(async (actionId: string) => {
    try {
      const response = await fetch(`/api/ai/assistant/actions/${actionId}/approve`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reject action');
      }

      // Remove the notification since action is completed
      setNotifications((prev) => prev.filter((n) => n.id !== actionId));
      if (unreadCount > 0) {
        setUnreadCount((prev) => prev - 1);
      }
    } catch (err: any) {
      logger.error('[useNotifications] Error rejecting action', { error: err instanceof Error ? err.message : String(err) });
      setError(err.message);
    }
  }, [unreadCount]);

  const submitActionInput = useCallback(async (actionId: string, value: string | string[]) => {
    // Do nothing, we don't need to submit action input anymore
  }, [refresh]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    hasMore,
    refresh,
    // Action confirmation state
    activeInputModal,
    setActiveInputModal,
    // Action confirmation handlers
    approveAction,
    rejectAction,
    submitActionInput,
  };
}
