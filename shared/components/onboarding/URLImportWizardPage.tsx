'use client';

/**
 * URL Import Wizard Page - Mobile
 *
 * First page of mobile wizard for importing profile via URL.
 * After import, user proceeds to next page (Journey Details).
 */

import { URLImportForm } from './URLImportForm';

interface URLImportWizardPageProps {
  onImportSuccess: (content: string, metadata: any) => void;
}

export function URLImportWizardPage({ onImportSuccess }: URLImportWizardPageProps) {
  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Import Your Profile</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Have an existing profile? Import it to auto-fill your information.
        </p>
      </div>

      {/* URL Import Form */}
      <div>
        <URLImportForm
          onSuccess={(content, metadata) => {
            onImportSuccess(content, metadata);
          }}
        />
      </div>

      {/* Info Section */}
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <p className="text-xs font-medium text-amber-900 dark:text-amber-100 mb-2">
          💡 What you can import:
        </p>
        <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <li>• Facebook posts or profiles</li>
          <li>• Twitter/X posts or profiles</li>
          <li>• Personal blogs or websites</li>
          <li>• Sailing forum profiles</li>
        </ul>
      </div>
    </div>
  );
}
