'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { Button } from '@/app/components/ui/Button/Button';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { CookiePreferences } from '@/app/types/consents';

const COOKIE_CONSENT_KEY = 'cookie_consent';

const defaultPreferences: CookiePreferences = {
  essential: true,
  analytics: false,
  marketing: false,
};

export function CookieConsentBanner() {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);
  const [isSaving, setIsSaving] = useState(false);

  // Check if consent has been given
  useEffect(() => {
    const checkConsent = async () => {
      // First check localStorage
      const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setPreferences({ ...defaultPreferences, ...parsed });
          return; // Consent already given
        } catch {
          // Invalid JSON, continue to show banner
        }
      }

      // If user is logged in, check database
      if (user) {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase
          .from('user_consents')
          .select('cookie_preferences')
          .eq('user_id', user.id)
          .single();

        if (data?.cookie_preferences) {
          const prefs = data.cookie_preferences as CookiePreferences;
          setPreferences(prefs);
          // Also store in localStorage for faster access
          localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));
          return;
        }
      }

      // No consent found, show banner
      setIsVisible(true);
    };

    checkConsent();
  }, [user]);

  const savePreferences = async (prefs: CookiePreferences) => {
    setIsSaving(true);

    // Always save to localStorage
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));

    // If user is logged in, also save to database
    if (user) {
      const supabase = getSupabaseBrowserClient();
      const now = new Date().toISOString();

      // Upsert user consents
      await supabase
        .from('user_consents')
        .upsert({
          user_id: user.id,
          cookie_preferences: prefs,
          cookie_preferences_at: now,
        }, {
          onConflict: 'user_id',
        });

      // Log to audit trail
      await supabase
        .from('consent_audit_log')
        .insert({
          user_id: user.id,
          consent_type: 'cookies',
          action: 'updated',
          new_value: prefs,
        });
    }

    setIsSaving(false);
    setIsVisible(false);
  };

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true,
    };
    setPreferences(allAccepted);
    savePreferences(allAccepted);
  };

  const handleRejectAll = () => {
    const onlyEssential: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
    };
    setPreferences(onlyEssential);
    savePreferences(onlyEssential);
  };

  const handleSavePreferences = () => {
    savePreferences(preferences);
  };

  const handleToggle = (category: 'analytics' | 'marketing') => {
    setPreferences(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  if (!isVisible) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" />

      {/* Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto bg-card border border-border rounded-lg shadow-xl">
          <div className="p-6">
            <div className="flex items-start gap-4">
              {/* Cookie Icon */}
              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <circle cx="8" cy="10" r="1.5" fill="currentColor" />
                  <circle cx="15" cy="8" r="1.5" fill="currentColor" />
                  <circle cx="10" cy="15" r="1.5" fill="currentColor" />
                  <circle cx="16" cy="14" r="1.5" fill="currentColor" />
                </svg>
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Cookie Preferences
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We use cookies to enhance your browsing experience, analyze site traffic, and personalize content.
                  You can choose which cookies you&apos;re happy to accept.{' '}
                  <Link href="/privacy-policy" className="text-primary hover:underline">
                    Learn more
                  </Link>
                </p>

                {/* Detailed options */}
                {showDetails && (
                  <div className="space-y-4 mb-4 p-4 bg-accent/50 rounded-lg">
                    {/* Essential - Always on */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Essential Cookies</p>
                        <p className="text-xs text-muted-foreground">
                          Required for the website to function. Cannot be disabled.
                        </p>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={true}
                          disabled
                          className="sr-only"
                        />
                        <div className="w-11 h-6 bg-primary rounded-full cursor-not-allowed opacity-60">
                          <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                        </div>
                      </div>
                    </div>

                    {/* Analytics */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Analytics Cookies</p>
                        <p className="text-xs text-muted-foreground">
                          Help us understand how visitors interact with our website.
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggle('analytics')}
                        className="relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        style={{ backgroundColor: preferences.analytics ? 'var(--primary)' : 'var(--muted)' }}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            preferences.analytics ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Marketing */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Marketing Cookies</p>
                        <p className="text-xs text-muted-foreground">
                          Used to deliver personalized advertisements.
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggle('marketing')}
                        className="relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        style={{ backgroundColor: preferences.marketing ? 'var(--primary)' : 'var(--muted)' }}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            preferences.marketing ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {!showDetails ? (
                    <>
                      <Button
                        onClick={handleAcceptAll}
                        disabled={isSaving}
                        variant="primary"
                        size="sm"
                        className="!text-sm"
                      >
                        Accept All
                      </Button>
                      <Button
                        onClick={handleRejectAll}
                        disabled={isSaving}
                        variant="outline"
                        size="sm"
                        className="!text-sm"
                      >
                        Reject All
                      </Button>
                      <Button
                        onClick={() => setShowDetails(true)}
                        variant="ghost"
                        size="sm"
                        className="!text-sm"
                      >
                        Customize
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={handleSavePreferences}
                        disabled={isSaving}
                        variant="primary"
                        size="sm"
                        className="!text-sm"
                      >
                        {isSaving ? 'Saving...' : 'Save Preferences'}
                      </Button>
                      <Button
                        onClick={handleAcceptAll}
                        disabled={isSaving}
                        variant="outline"
                        size="sm"
                        className="!text-sm"
                      >
                        Accept All
                      </Button>
                      <Button
                        onClick={() => setShowDetails(false)}
                        variant="ghost"
                        size="sm"
                        className="!text-sm"
                      >
                        Back
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
