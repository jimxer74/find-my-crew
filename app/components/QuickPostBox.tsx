'use client';

import { useState, useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@shared/database/client';
import {
  isValidUrl,
  isFacebookUrl,
  fetchUrlContent,
  savePendingUrlImport,
} from '@shared/lib/url-import/urlImportClient';

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
  /**
   * Which flow this box belongs to — used when Facebook OAuth is needed so the
   * pending import can be resumed after the OAuth redirect.
   */
  context?: 'crew' | 'owner';
}

type ImportPhase = 'idle' | 'fetching' | 'facebook-auth' | 'error';

export function QuickPostBox({
  placeholder,
  expandedPlaceholder,
  isExpanded,
  onExpand,
  onCancel,
  onPost,
  accentColor = 'blue',
  context,
}: QuickPostBoxProps) {
  const [text, setText] = useState('');
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [importError, setImportError] = useState('');
  const [pendingUrl, setPendingUrl] = useState('');
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
      setImportPhase('idle');
      setImportError('');
      setPendingUrl('');
    }
  }, [isExpanded]);

  const handlePost = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Plain text — pass straight through
    if (!isValidUrl(trimmed)) {
      onPost(trimmed);
      return;
    }

    // ── URL detected: start import flow ──────────────────────────────────────
    setPendingUrl(trimmed);
    setImportPhase('fetching');
    setImportError('');

    try {
      const result = await fetchUrlContent(trimmed);
      // Success — pass fetched content to parent
      onPost(result.content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg === 'AUTH_REQUIRED') {
        if (isFacebookUrl(trimmed) && context) {
          // Facebook URL + not authenticated → prompt Facebook OAuth
          setImportPhase('facebook-auth');
        } else {
          setImportPhase('error');
          setImportError('You need to be signed in to import content from URLs.');
        }
      } else {
        setImportPhase('error');
        setImportError(msg);
      }
    }
  };

  const handleFacebookConnect = async () => {
    if (!context) return;
    // Persist URL + context so the homepage can resume after OAuth redirect
    savePendingUrlImport(pendingUrl, context);

    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?from=${context === 'crew' ? 'prospect' : 'owner'}`,
        scopes: 'public_profile',
      },
    });
  };

  const handlePostAsText = () => {
    onPost(pendingUrl);
  };

  const handleRetry = () => {
    setImportPhase('idle');
    setImportError('');
    // Keep the URL in the textarea so the user can try again
  };

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
  const focusRingCls =
    accentColor === 'blue'
      ? 'focus-within:ring-2 focus-within:ring-blue-400/50'
      : 'focus-within:ring-2 focus-within:ring-amber-400/50';
  const accentTextCls = accentColor === 'blue' ? 'text-blue-400' : 'text-amber-400';

  // ── Facebook auth overlay ──────────────────────────────────────────────────
  if (importPhase === 'facebook-auth') {
    return (
      <div className="w-full space-y-2">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setImportPhase('idle'); }}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center bg-white/10 text-white border border-white/20 rounded-full hover:bg-white/25 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="w-full bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-5 space-y-3 ring-1 ring-white/40">
          <div className="flex items-start gap-3">
            {/* Facebook icon */}
            <svg className="w-8 h-8 text-blue-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-gray-900">Connect Facebook to import this profile</p>
              <p className="text-xs text-gray-500 mt-1 break-all leading-snug">{pendingUrl}</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 leading-snug">
            Sign in with Facebook to let us fetch your public profile and pre-fill your onboarding.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleFacebookConnect}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Continue with Facebook
            </button>
            <button
              type="button"
              onClick={handlePostAsText}
              className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Post as text
            </button>
          </div>
        </div>
        <p className="text-xs text-white/55 px-1 leading-snug">
          By posting, you confirm that AI may process your input to personalise your experience.
        </p>
      </div>
    );
  }

  // ── Fetching overlay ───────────────────────────────────────────────────────
  if (importPhase === 'fetching') {
    const domain = (() => { try { return new URL(pendingUrl).hostname.replace('www.', ''); } catch { return pendingUrl; } })();
    return (
      <div className="w-full space-y-2">
        <div className="h-7" /> {/* spacer matching close button row */}
        <div className="w-full bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-5 py-6 ring-1 ring-white/40 flex items-center gap-4">
          <svg className="w-5 h-5 flex-shrink-0 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-900">Importing content…</p>
            <p className="text-xs text-gray-500 truncate max-w-[240px]">{domain}</p>
          </div>
        </div>
        <p className="text-xs text-white/55 px-1 leading-snug">
          By posting, you confirm that AI may process your input to personalise your experience.
        </p>
      </div>
    );
  }

  // ── Error overlay ──────────────────────────────────────────────────────────
  if (importPhase === 'error') {
    return (
      <div className="w-full space-y-2">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleRetry}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center bg-white/10 text-white border border-white/20 rounded-full hover:bg-white/25 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="w-full bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-5 space-y-3 ring-1 ring-white/40">
          <div className="flex items-start gap-2.5">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-gray-900">Could not import URL</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">{importError}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePostAsText}
              className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${buttonActiveCls}`}
            >
              Post URL as text
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
        <p className="text-xs text-white/55 px-1 leading-snug">
          By posting, you confirm that AI may process your input to personalise your experience.
        </p>
      </div>
    );
  }

  // ── Normal expanded textarea card ──────────────────────────────────────────
  const urlDetected = isValidUrl(text.trim());

  return (
    <div className="w-full space-y-2">
      {/* Close button — top right above the box */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="w-7 h-7 flex items-center justify-center bg-white/10 text-white border border-white/20 rounded-full hover:bg-white/25 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

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
          rows={6}
          className="flex-1 px-4 py-4 text-sm text-gray-900 bg-transparent resize-none focus:outline-none placeholder:text-gray-400 leading-relaxed"
        />

        {/* Post button — right edge, full height of box */}
        <button
          type="button"
          onClick={handlePost}
          disabled={!text.trim()}
          className={`flex-shrink-0 px-6 text-sm font-medium text-white border-l border-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex flex-col items-center justify-center gap-1.5 ${buttonActiveCls}`}
        >
          {urlDetected ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span>Import</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Post</span>
            </>
          )}
        </button>
      </div>{/* end box */}

      {/* URL hint */}
      {urlDetected && (
        <p className={`text-xs ${accentTextCls} px-1 leading-snug`}>
          URL detected — clicking Import will fetch the content automatically.
        </p>
      )}

      {/* AI disclaimer */}
      <p className="text-xs text-white/55 px-1 leading-snug">
        By posting, you confirm that AI may process your input to personalise your experience.
      </p>
    </div>
  );
}
