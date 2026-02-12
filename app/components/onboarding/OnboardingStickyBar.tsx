'use client';

import React from 'react';

export interface OnboardingStickyBarProps {
  title: string;
  children: React.ReactNode;
  onStartFresh: () => void;
  isLoading?: boolean;
  /** For crew: show View All Journeys when eligible */
  showViewJourneys?: boolean;
  onViewJourneys?: () => void;
  isNavigatingToJourneys?: boolean;
}

export function OnboardingStickyBar({
  title,
  children,
  onStartFresh,
  isLoading = false,
  showViewJourneys = false,
  onViewJourneys,
  isNavigatingToJourneys = false,
}: OnboardingStickyBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm shadow-sm overflow-visible">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 overflow-visible">
        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-visible">
          <div className="min-w-0 flex-1 overflow-visible">
            <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
            <div className="mt-1 overflow-visible">{children}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
          {showViewJourneys && onViewJourneys && (
            <button
              onClick={onViewJourneys}
              disabled={isNavigatingToJourneys}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-md transition-opacity disabled:opacity-50"
            >
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
              View Journeys
            </button>
          )}
          <button
            onClick={onStartFresh}
            disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
          >
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
            Start Fresh
          </button>
        </div>
      </div>
    </div>
  );
}
