'use client';

import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { useSwipeable } from 'react-swipeable';

export type SnapPoint = 'collapsed' | 'half' | 'expanded';

type BottomSheetProps = {
  children: ReactNode;
  isOpen?: boolean;
  defaultSnapPoint?: SnapPoint;
  onSnapPointChange?: (snapPoint: SnapPoint) => void;
  collapsedHeight?: number;    // Height when collapsed (default: 80px)
  halfHeight?: string;         // Height when half expanded (default: '50vh')
  expandedHeight?: string;     // Height when fully expanded (default: 'calc(100vh - 4rem)')
  headerContent?: ReactNode;   // Content to show in the header area (always visible)
  className?: string;
};

// Snap point thresholds (percentage of screen height for gesture detection)
const COLLAPSED_THRESHOLD = 0.25;
const HALF_THRESHOLD = 0.6;

export function BottomSheet({
  children,
  isOpen = true,
  defaultSnapPoint = 'collapsed',
  onSnapPointChange,
  collapsedHeight = 80,
  halfHeight = '50vh',
  expandedHeight = 'calc(100vh - 4rem)',
  headerContent,
  className = ''
}: BottomSheetProps) {
  const [snapPoint, setSnapPoint] = useState<SnapPoint>(defaultSnapPoint);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Get the height value based on snap point
  const getHeightValue = useCallback((point: SnapPoint): string => {
    switch (point) {
      case 'collapsed':
        return `${collapsedHeight}px`;
      case 'half':
        return halfHeight;
      case 'expanded':
        return expandedHeight;
    }
  }, [collapsedHeight, halfHeight, expandedHeight]);

  // Calculate the snap point based on current position
  const calculateSnapPoint = useCallback((currentHeight: number, direction: 'up' | 'down'): SnapPoint => {
    const viewportHeight = window.innerHeight;
    const heightRatio = currentHeight / viewportHeight;

    if (direction === 'up') {
      // Swiping up - expand
      if (heightRatio < COLLAPSED_THRESHOLD) {
        return 'half';
      } else if (heightRatio < HALF_THRESHOLD) {
        return 'expanded';
      }
      return 'expanded';
    } else {
      // Swiping down - collapse
      if (heightRatio > HALF_THRESHOLD) {
        return 'half';
      } else if (heightRatio > COLLAPSED_THRESHOLD) {
        return 'collapsed';
      }
      return 'collapsed';
    }
  }, []);

  // Update snap point and notify parent
  const updateSnapPoint = useCallback((newPoint: SnapPoint) => {
    setSnapPoint(newPoint);
    onSnapPointChange?.(newPoint);
  }, [onSnapPointChange]);

  // Swipe handlers
  const handlers = useSwipeable({
    onSwipedUp: () => {
      if (snapPoint === 'collapsed') {
        updateSnapPoint('half');
      } else if (snapPoint === 'half') {
        updateSnapPoint('expanded');
      }
      setDragOffset(0);
      setIsDragging(false);
    },
    onSwipedDown: () => {
      // Only allow swipe down to collapse if content is at top
      const content = contentRef.current;
      const canCollapse = !content || content.scrollTop <= 0;

      if (canCollapse) {
        if (snapPoint === 'expanded') {
          updateSnapPoint('half');
        } else if (snapPoint === 'half') {
          updateSnapPoint('collapsed');
        }
      }
      setDragOffset(0);
      setIsDragging(false);
    },
    onSwiping: (e) => {
      // Only track vertical dragging
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        setIsDragging(true);
        // Invert because we're dragging from bottom
        setDragOffset(-e.deltaY);
      }
    },
    onTouchEndOrOnMouseUp: () => {
      setDragOffset(0);
      setIsDragging(false);
    },
    trackMouse: false,
    trackTouch: true,
    delta: 10,
    preventScrollOnSwipe: snapPoint !== 'expanded',
  });

  // Handle drag handle double-tap to toggle between collapsed and expanded
  const handleDragHandleClick = () => {
    if (snapPoint === 'collapsed') {
      updateSnapPoint('half');
    } else if (snapPoint === 'half') {
      updateSnapPoint('expanded');
    } else {
      updateSnapPoint('collapsed');
    }
  };

  // Prevent body scroll when sheet is expanded
  useEffect(() => {
    if (snapPoint === 'expanded') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [snapPoint]);

  if (!isOpen) return null;

  // Calculate current height with drag offset
  const baseHeight = getHeightValue(snapPoint);
  const currentTransform = isDragging ? `translateY(${-dragOffset}px)` : 'translateY(0)';

  return (
    <div
      ref={sheetRef}
      className={`fixed bottom-0 left-0 right-0 z-40 bg-background rounded-t-2xl shadow-2xl border-t border-border transition-all md:hidden ${
        isDragging ? 'duration-0' : 'duration-300 ease-out'
      } ${className}`}
      style={{
        height: baseHeight,
        transform: currentTransform,
        maxHeight: expandedHeight,
      }}
    >
      {/* Drag Handle */}
      <div
        {...handlers}
        className="flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
        onClick={handleDragHandleClick}
      >
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
      </div>

      {/* Header Content (always visible) */}
      {headerContent && (
        <div className="px-4 pb-2 border-b border-border">
          {headerContent}
        </div>
      )}

      {/* Scrollable Content */}
      <div
        ref={contentRef}
        className={`flex-1 overflow-y-auto overscroll-contain px-4 pb-4 ${
          snapPoint === 'collapsed' ? 'overflow-hidden' : ''
        }`}
        style={{
          height: `calc(100% - ${headerContent ? '60px' : '24px'})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
