'use client';

import { useState } from 'react';

type CollapsibleSectionProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  sectionNumber?: number; // For numbered sections like "1. Personal Information"
  isOpen?: boolean; // External control for open state
  onOpenChange?: (isOpen: boolean) => void; // Callback for external state management
  highlighted?: boolean; // Highlight the section header
};

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  badge,
  sectionNumber,
  isOpen: externalIsOpen,
  onOpenChange,
  highlighted = false,
}: CollapsibleSectionProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
  const isControlled = externalIsOpen !== undefined;

  const currentIsOpen = isControlled ? externalIsOpen : internalIsOpen;

  const handleToggle = () => {
    if (isControlled && onOpenChange) {
      onOpenChange(!currentIsOpen);
    } else {
      setInternalIsOpen(!currentIsOpen);
    }
  };

  const displayTitle = sectionNumber ? `${sectionNumber}. ${title}` : title;

  return (
    <div className="bg-card rounded-lg shadow mb-6">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full p-6 flex items-center justify-between text-left hover:bg-accent/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <h2 className={`text-sm font-semibold ${
            highlighted
              ? 'text-blue-600 dark:text-blue-400 border-l-4 border-blue-500 pl-2 ai-highlighted-section'
              : 'text-muted-foreground'
          }`}>
            {displayTitle}
          </h2>
          {badge}
        </div>
        <svg
          className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${currentIsOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {currentIsOpen && <div className="px-6 pb-6 p-4">{children}</div>}
    </div>
  );
}
