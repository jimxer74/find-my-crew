'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '../contexts/AuthContext';

export function Footer() {
  const t = useTranslations('footer');
  const currentYear = new Date().getFullYear();
  const { user, loading: authLoading } = useAuth();
  
  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            {t('copyright', { year: currentYear })}
          </p>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm">
            {user && (
            <Link
              href="/feedback"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('feedback')}
            </Link>
            )}
            <Link
              href="/privacy-policy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('legal.privacyPolicy')}
            </Link>
            <Link
              href="/terms-of-service"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('legal.termsOfService')}
            </Link>
            {user && (
            <Link
              href="/settings/privacy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('privacySettings')}
            </Link>
            )}
          </nav>
        </div>
      </div>
    </footer>
  );
}
