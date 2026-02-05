"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { NotificationItem } from "./NotificationItem";
import { type Notification } from "@/app/lib/notifications";
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
  onRedirectToProfile: (action: any) => void;
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
      console.log("[NotificationCenter] 📊 Approve action called:", actionId);
      console.log("[NotificationCenter] 📊 approveAction function:", assistantContext.approveAction);
      console.log("[NotificationCenter] 📊 approveAction type:", typeof assistantContext.approveAction);

      // Get the action from pendingActions
      const action = pendingActions.find((a) => a.id === actionId);
      if (action && assistantContext.approveAction && typeof assistantContext.approveAction === 'function') {
        // Use the context's approveAction method
        try {
          assistantContext.approveAction(actionId);
        } catch (error) {
          console.error("[NotificationCenter] 📊 Error calling approveAction:", error);
        }
      } else {
        console.warn("[NotificationCenter] 📊 approveAction is not available or not a function");
        console.warn("[NotificationCenter] 📊 action:", action);
        console.warn("[NotificationCenter] 📊 approveAction:", assistantContext.approveAction);
      }
    },
    [pendingActions, assistantContext],
  );

  const handleRejectAction = useCallback(
    (actionId: string) => {
      console.log("[NotificationCenter] 📊 Reject action called:", actionId);
      console.log("[NotificationCenter] 📊 rejectAction function:", assistantContext.rejectAction);
      console.log("[NotificationCenter] 📊 rejectAction type:", typeof assistantContext.rejectAction);

      // Get the action from pendingActions
      const action = pendingActions.find((a) => a.id === actionId);
      if (action && assistantContext.rejectAction && typeof assistantContext.rejectAction === 'function') {
        // Use the context's rejectAction method
        try {
          assistantContext.rejectAction(actionId);
        } catch (error) {
          console.error("[NotificationCenter] 📊 Error calling rejectAction:", error);
        }
      } else {
        console.warn("[NotificationCenter] 📊 rejectAction is not available or not a function");
        console.warn("[NotificationCenter] 📊 action:", action);
        console.warn("[NotificationCenter] 📊 rejectAction:", assistantContext.rejectAction);
      }
    },
    [pendingActions, assistantContext],
  );

  const handleRedirectToProfile = useCallback(
    (actionId: string, section: string, field: string) => {
      console.log(
        "[NotificationCenter] 📊 Redirect to profile called:",
        actionId, section, field,
      );
      console.log("[NotificationCenter] 📊 redirectToProfile function:", assistantContext.redirectToProfile);
      console.log("[NotificationCenter] 📊 redirectToProfile type:", typeof assistantContext.redirectToProfile);

      if (assistantContext.redirectToProfile && typeof assistantContext.redirectToProfile === 'function') {
        // Use the context's redirectToProfile method with correct parameters
        try {
          assistantContext.redirectToProfile(actionId, section, field);
        } catch (error) {
          console.error("[NotificationCenter] 📊 Error calling redirectToProfile:", error);
        }
      } else {
        console.warn("[NotificationCenter] 📊 redirectToProfile is not available or not a function");
        console.warn("[NotificationCenter] 📊 redirectToProfile:", assistantContext.redirectToProfile);
      }
    },
    [assistantContext],
  );

  console.log("[NotificationCenter] 📊 Received props:");
  console.log("[NotificationCenter] 📊 notifications:", notifications);
  console.log(
    "[NotificationCenter] 📊 pendingActions from context:",
    pendingActions,
  );
  console.log(
    "[NotificationCenter] 📊 pendingActions from context length:",
    pendingActions?.length,
  );

  // Debug: Check what will be passed to NotificationPageContent
  console.log(
    "[NotificationCenter] 📊 About to pass pendingActions to NotificationPageContent:",
    pendingActions,
  );

  // Debug: Log the value being passed
  (() => {
    console.log(
      "[NotificationCenter] 📊 Passing pendingActions to NotificationPageContent:",
      pendingActions,
    );
  })();

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
        </button>
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

  console.log("[NotificationPageContent] 📊 NotificationPageContent props:");
  console.log("[NotificationPageContent] 📊 notifications:", notifications);
  console.log("[NotificationPageContent] 📊 pendingActions:", pendingActions);
  console.log(
    "[NotificationPageContent] 📊 pendingActions length:",
    pendingActions?.length,
  );
  console.log("[NotificationPageContent] 📊 unreadCount:", unreadCount);

  // Debug: Check if pending actions should be displayed
  console.log(
    "[NotificationPageContent] 📊 Should display pending actions? pendingActions && pendingActions.length > 0:",
    pendingActions && pendingActions.length > 0,
  );

  // Debug: Log the rendering condition
  (() => {
    console.log(
      "[NotificationPageContent] 📊 Rendering condition check - pendingActions:",
      pendingActions,
    );
    console.log(
      "[NotificationPageContent] 📊 Rendering condition check - pendingActions.length:",
      pendingActions?.length,
    );
    console.log(
      "[NotificationPageContent] 📊 Rendering condition check - pendingActions && pendingActions.length > 0:",
      pendingActions && pendingActions.length > 0,
    );

    // Additional debug: Check if pendingActions is an array
    console.log(
      "[NotificationPageContent] 📊 Is pendingActions an array?",
      Array.isArray(pendingActions),
    );
    console.log(
      "[NotificationPageContent] 📊 pendingActions type:",
      typeof pendingActions,
    );
    console.log(
      "[NotificationPageContent] 📊 First pending action:",
      pendingActions?.[0],
    );
  })();

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
                console.log(
                  "[NotificationCenter] 📝 Rendering pending action with ActionConfirmation:",
                  action,
                );
                const notification = convertActionToNotification(action);
                console.log("[NotificationPageContent] 📝 converted notification:", notification);
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
              <button
                onClick={onLoadMore}
                disabled={isLoading}
                className="w-full py-2 text-sm text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
              >
                {isLoading ? tCommon("loading") : t("loadMore")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
