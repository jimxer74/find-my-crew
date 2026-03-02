'use client';

import { useState, useEffect, useRef } from 'react';

interface QuickPostBoxProps {
  /** Placeholder shown in compact pill mode — matches existing ComboSearchBox look */
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
  /** Label for the submit button */
  submitLabel?: string;
}

export function QuickPostBox({
  placeholder,
  expandedPlaceholder,
  isExpanded,
  onExpand,
  onCancel,
  onPost,
  accentColor = 'blue',
  submitLabel = 'Post',
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
  const toggleActiveCls =
    accentColor === 'blue' ? 'bg-blue-500' : 'bg-amber-500';
  const buttonActiveCls =
    accentColor === 'blue'
      ? 'bg-blue-600 hover:bg-blue-700'
      : 'bg-amber-600 hover:bg-amber-700';
  const focusRingCls =
    accentColor === 'blue'
      ? 'focus-within:ring-2 focus-within:ring-blue-400/50'
      : 'focus-within:ring-2 focus-within:ring-amber-400/50';

  return (
    <div
      className={`w-full bg-white/90 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden ring-1 ring-white/40 ${focusRingCls}`}
    >
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={expandedPlaceholder}
        rows={5}
        className="w-full px-4 pt-4 pb-2 text-sm text-gray-900 bg-transparent resize-none focus:outline-none placeholder:text-gray-400 leading-relaxed"
      />

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-100/80 space-y-3">
        {/* AI consent row */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-700 leading-tight">Allow AI processing</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">
              Your input will be processed by AI to personalise your experience
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAiConsent((v) => !v)}
            aria-label={aiConsent ? 'Disable AI processing' : 'Enable AI processing'}
            className={`relative flex-shrink-0 w-10 h-[22px] rounded-full transition-colors duration-200 mt-0.5 ${
              aiConsent ? toggleActiveCls : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                aiConsent ? 'translate-x-[18px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-medium text-gray-500 hover:text-gray-800 px-2 py-1.5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { if (text.trim() && aiConsent) onPost(text.trim()); }}
            disabled={!text.trim() || !aiConsent}
            className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-lg transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${buttonActiveCls}`}
          >
            {submitLabel}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
