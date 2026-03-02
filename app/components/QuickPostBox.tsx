'use client';

import { useState, useEffect, useRef } from 'react';

interface QuickPostBoxProps {
  /** Placeholder shown in compact pill mode */
  placeholder: string;
  /** Placeholder shown inside the expanded textarea */
  expandedPlaceholder: string;
  /** Whether the box is in expanded (textarea) state — controlled by parent */
  isExpanded: boolean;
  /** Called when compact pill is clicked — parent should expand the section */
  onExpand: () => void;
  /** Called when Cancel button is clicked — parent should collapse the section */
  onCancel: () => void;
  /** Called with the typed text when Post is clicked */
  onPost: (text: string) => void;
  /** Visual accent for toggle + button */
  accentColor?: 'blue' | 'amber';
}

export function QuickPostBox({
  placeholder,
  expandedPlaceholder,
  isExpanded,
  onExpand,
  onCancel,
  onPost,
  accentColor = 'blue',
}: QuickPostBoxProps) {
  const [text, setText] = useState('');
  const [aiConsent, setAiConsent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  // Reset internal state when collapsed
  useEffect(() => {
    if (!isExpanded) {
      setText('');
      setAiConsent(false);
    }
  }, [isExpanded]);

  // ── Compact pill button ────────────────────────────────────────────────────
  if (!isExpanded) {
    return (
      <div className="w-full max-w-full">
        <button
          type="button"
          onClick={onExpand}
          className="w-full h-14 px-4 text-left text-sm text-gray-900 bg-white/80 backdrop-blur-sm border-0 rounded-xl shadow-lg hover:bg-white/90 transition-colors flex items-center gap-3 cursor-pointer"
        >
          <svg
            className="w-5 h-5 text-gray-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          <span className="text-gray-500 truncate">{placeholder}</span>
        </button>
      </div>
    );
  }

  // ── Expanded textarea card ─────────────────────────────────────────────────
  const buttonActiveCls =
    accentColor === 'blue'
      ? 'bg-blue-600 hover:bg-blue-700'
      : 'bg-amber-600 hover:bg-amber-700';
  const toggleActiveCls =
    accentColor === 'blue' ? 'bg-blue-500' : 'bg-amber-500';
  const focusRingCls =
    accentColor === 'blue'
      ? 'focus-within:ring-2 focus-within:ring-blue-400/50'
      : 'focus-within:ring-2 focus-within:ring-amber-400/50';

  return (
    <div className="w-full space-y-2">
      {/* Box — textarea left, Post button right (full height) */}
      <div
        className={`w-full bg-white/90 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden ring-1 ring-white/40 flex items-stretch ${focusRingCls}`}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={expandedPlaceholder}
          rows={3}
          className="flex-1 px-4 py-4 text-sm text-gray-900 bg-transparent resize-none focus:outline-none placeholder:text-gray-400 leading-relaxed"
        />

        {/* Post button — right edge, full height of box */}
        <button
          type="button"
          onClick={() => { if (text.trim() && aiConsent) onPost(text.trim()); }}
          disabled={!text.trim() || !aiConsent}
          className={`flex-shrink-0 px-6 text-sm font-medium text-white border-l border-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex flex-col items-center justify-center gap-1.5 ${buttonActiveCls}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Post</span>
        </button>
      </div>

      {/* AI consent — below the box, on the dark hero background */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white leading-tight">Allow AI processing</p>
          <p className="text-xs text-white/60 mt-0.5 leading-snug">
            Your input will be processed by AI to personalise your experience
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAiConsent((v) => !v)}
          aria-label={aiConsent ? 'Disable AI processing' : 'Enable AI processing'}
          className={`relative flex-shrink-0 w-10 h-[22px] rounded-full overflow-hidden transition-colors duration-200 ${
            aiConsent ? toggleActiveCls : 'bg-white/25'
          }`}
        >
          <span
            className={`absolute top-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
              aiConsent ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
