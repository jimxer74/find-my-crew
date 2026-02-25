"use client";

import { logger } from "@shared/logging";
import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@shared/ui/Button";
import { NotificationItem } from "./NotificationItem";
import { type Notification } from "@shared/lib/notifications";
import { useAssistant, parseProfileAction } from "@/app/contexts/AssistantContext";
import { ActionConfirmation } from "./ActionConfirmation";
import { convertActionToNotification } from "./helpers/actionUtils";

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
  pendingActions: any[];
  unreadCount: number;
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onApproveAction: (actionId: string) => void;
  onRejectAction: (actionId: string) => void;
  onRedirectToProfile: (action: any, section: string, field: string) => void;
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
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const assistantContext = useAssistant();
  const { pendingActions } = assistantContext;

  // Handler wrappers for ActionConfirmation
  const handleApproveAction = useCallback(
    (actionId: string) => {
      logger.debug("Approve action called", { actionId }, true);
      logger.debug("approveAction function present", { hasFunction: !!assistantContext.approveAction }, true);
      logger.debug("approveAction type", { type: typeof assistantContext.approveAction }, true);

      // Get the action from pendingActions
      const action = pendingActions.find((a) => a.id === actionId);
      if (action && assistantContext.approveAction && typeof assistantContext.approveAction === 'function') {
        // Use the context's approveAction method
        try {
          assistantContext.approveAction(actionId);
        } catch (error) {
          logger.error("Error calling approveAction", { error: error instanceof Error ? error.message : String(error) });
        }
      } else {
        logger.warn("approveAction is not available or not a function", { hasAction: !!action });
        logger.warn("approveAction context", { hasApproveAction: !!assistantContext.approveAction });
      }
    },
    [pendingActions, assistantContext],
  );

  const handleRejectAction = useCallback(
    (actionId: string) => {
      logger.debug("Reject action called", { actionId }, true);
      logger.debug("rejectAction function present", { hasFunction: !!assistantContext.rejectAction }, true);
      logger.debug("rejectAction type", { type: typeof assistantContext.rejectAction }, true);

      // Get the action from pendingActions
      const action = pendingActions.find((a) => a.id === actionId);
      if (action && assistantContext.rejectAction && typeof assistantContext.rejectAction === 'function') {
        // Use the context's rejectAction method
        try {
          assistantContext.rejectAction(actionId);
        } catch (error) {
          logger.error("Error calling rejectAction", { error: error instanceof Error ? error.message : String(error) });
        }
      } else {
        logger.warn("rejectAction is not available or not a function", { hasAction: !!action });
        logger.warn("rejectAction context", { hasRejectAction: !!assistantContext.rejectAction });
      }
    },
    [pendingActions, assistantContext],
  );

  const handleRedirectToProfile = useCallback(
    (actionId: string, section: string, field: string) => {
      logger.debug("Redirect to profile called", { actionId, section, field }, true);
      logger.debug("redirectToProfile function present", { hasFunction: !!assistantContext.redirectToProfile }, true);
      logger.debug("redirectToProfile type", { type: typeof assistantContext.redirectToProfile }, true);

      if (assistantContext.redirectToProfile && typeof assistantContext.redirectToProfile === 'function') {
        // Use the context's redirectToProfile method with correct parameters
        try {
          assistantContext.redirectToProfile(actionId, section, field);
        } catch (error) {
          logger.error("Error calling redirectToProfile", { error: error instanceof Error ? error.message : String(error) });
        }
      } else {
        logger.warn("redirectToProfile is not available or not a function", { hasRedirectToProfile: !!assistantContext.redirectToProfile });
      }
    },
    [assistantContext],
  );

  logger.debug("Received props", {}, true);
  logger.debug("Notifications count", { count: notifications?.length || 0 }, true);
  logger.debug("pendingActions from context", { count: pendingActions?.length || 0 }, true);
  logger.debug("pendingActions from context length", { length: pendingActions?.length || 0 }, true);

  // Debug: Check what will be passed to NotificationPageContent
  logger.debug("About to pass pendingActions to NotificationPageContent", { count: pendingActions?.length || 0 }, true);

  // Debug: Log the value being passed
  logger.debug("Passing pendingActions to NotificationPageContent", { count: pendingActions?.length || 0 }, true);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Don't close if clicking on the button or the panel
      if (
        buttonRef?.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, buttonRef]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Don't render at all if not open - this prevents blocking
  if (!isOpen) return null;

  // Use portal to render outside Header DOM
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed top-16 bottom-0 right-0 w-full md:w-96 lg:w-[28rem] bg-card border-l border-border shadow-xl z-[120] flex flex-col overflow-hidden rounded-t-lg md:rounded-t-none"
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center px-4 py-3 border-b border-border bg-card">
        {/* Close button - mobile only */}
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="md:hidden !p-2 !-ml-2 !mr-2 flex-shrink-0"
          aria-label="Close"
        >
          <svg
            className="w-5 h-5 text-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </Button>
        <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
      </div>

      {/* Notification list - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <NotificationPageContent
          onClose={onClose}
          notifications={notifications}
          pendingActions={pendingActions}
          unreadCount={unreadCount}
          isLoading={isLoading}
          onMarkAsRead={onMarkAsRead}
          onMarkAllAsRead={onMarkAllAsRead}
          onDelete={onDelete}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
          onApproveAction={handleApproveAction}
          onRejectAction={handleRejectAction}
          onRedirectToProfile={handleRedirectToProfile}
        />
      </div>
    </div>,
    document.body,
  );
}

// Content component that can be used in both modal and page modes
export function NotificationPageContent({
  onClose,
  notifications,
  pendingActions,
  unreadCount,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onLoadMore,
  hasMore,
  onApproveAction,
  onRejectAction,
  onRedirectToProfile,
}: NotificationPageContentProps) {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const router = useRouter();

  logger.debug("NotificationPageContent props", {}, true);
  logger.debug("NotificationPageContent notifications", { count: notifications?.length || 0 }, true);
  logger.debug("NotificationPageContent pendingActions", { count: pendingActions?.length || 0 }, true);
  logger.debug("NotificationPageContent pendingActions length", { length: pendingActions?.length || 0 }, true);
  logger.debug("NotificationPageContent unreadCount", { unreadCount }, true);

  // Debug: Check if pending actions should be displayed
  logger.debug("Should display pending actions", { shouldDisplay: !!(pendingActions && pendingActions.length > 0) }, true);

  // Debug: Log the rendering condition
  logger.debug("Rendering condition check", {
    pendingActionsExists: !!pendingActions,
    length: pendingActions?.length || 0,
    shouldDisplay: !!(pendingActions && pendingActions.length > 0),
    isArray: Array.isArray(pendingActions),
    type: typeof pendingActions
  }, true);

  const handleNotificationClick = (notification: Notification) => {
    if (notification.link) {
      // Close first, then navigate
      onClose();
      // Dispatch event to close all dialogs
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("closeAllDialogs"));
      }
      // Use setTimeout to ensure close happens before navigation
      setTimeout(() => {
        router.push(notification.link!);
      }, 100);
    }
  };

  return (
    <div>
      {isLoading &&
      notifications.length === 0 &&
      pendingActions.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : notifications.length === 0 && pendingActions.length === 0 ? (
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
          <p className="text-foreground font-medium">
            {t("noNotificationsYet")}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("notifyWhenHappens")}
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

          {/* Show pending actions from AssistantContext using ActionConfirmation */}
          {pendingActions && pendingActions.length > 0 && (
            <div className="divide-y divide-border">
              {pendingActions.map((action) => {
                logger.debug("Rendering pending action with ActionConfirmation", { actionId: action?.id }, true);
                const notification = convertActionToNotification(action);
                logger.debug("Converted notification", { notificationId: notification?.id }, true);
                return (
                  <ActionConfirmation
                    key={action.id}
                    notification={notification}
                    onApprove={onApproveAction}
                    onReject={onRejectAction}
                    onRedirectToProfile={onRedirectToProfile}
                    useModal={true}
                  />
       
                );
              })}
            </div>
          )}

          {/* Load more button */}
          {hasMore && onLoadMore && (
            <div className="p-3 border-t border-border">
              <Button
                onClick={onLoadMore}
                disabled={isLoading}
                variant="ghost"
                className="w-full !text-primary hover:!text-primary/80"
              >
                {isLoading ? tCommon("loading") : t("loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
