'use client';

import React from 'react';
import { Button } from '@shared/ui/Button/Button';

export interface OnboardingStickyBarProps {
  title: string;
  children: React.ReactNode;
  onStartFresh: () => void;
  isLoading?: boolean;
  /** For crew: show View All Journeys when eligible */
  showViewJourneys?: boolean;
  onViewJourneys?: () => void;
  isNavigatingToJourneys?: boolean;
  /** For crew: show Exit Assistant button when in profile completion mode */
  showExitAssistant?: boolean;
  onExitAssistant?: () => void;
}

export function OnboardingStickyBar({
  title,
  children,
  onStartFresh,
  isLoading = false,
  showViewJourneys = false,
  onViewJourneys,
  isNavigatingToJourneys = false,
  showExitAssistant = false,
  onExitAssistant,
}: OnboardingStickyBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm shadow-sm overflow-visible">
      <div className="flex flex-col gap-1.5 px-3 py-2 overflow-visible">
        {/* Title and buttons in same row */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            {showViewJourneys && onViewJourneys && (
              <Button
                onClick={onViewJourneys}
                disabled={isNavigatingToJourneys}
                variant="primary"
                size="sm"
                className="!px-2 !py-1 !text-xs flex-shrink-0"
                leftIcon={
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                }
              >
                View Journeys
              </Button>
            )}
            {showExitAssistant && onExitAssistant && (
              <Button
                onClick={onExitAssistant}
                variant="primary"
                size="sm"
                className="!px-2 !py-1 !text-xs flex-shrink-0"
                title="Skip the AI assistant and fill in your profile manually"
                leftIcon={
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                }
              >
                Exit Assistant
              </Button>
            )}
            <Button
              onClick={onStartFresh}
              disabled={isLoading}
              variant="ghost"
              size="sm"
              className="!px-2 !py-1 !text-xs flex-shrink-0"
              leftIcon={
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              Start Fresh
            </Button>
          </div>
        </div>
        {/* Steps below */}
        <div className="overflow-visible">{children}</div>
      </div>
    </div>
  );
}
