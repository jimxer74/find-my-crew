'use client';

/**
 * URL Import Wizard Page - Mobile
 *
 * First page of mobile wizard for importing profile via URL.
 * Provides option to import from URL or continue manually.
 */

import { URLImportForm } from './URLImportForm';
import { ChevronRight } from 'lucide-react';

interface URLImportWizardPageProps {
  onImportSuccess: (content: string, metadata: any) => void;
  onContinueManually: () => void;
}

export function URLImportWizardPage({ onImportSuccess, onContinueManually }: URLImportWizardPageProps) {
  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Quick Start</h2>
        <p className="text-sm text-gray-600">
          Have an existing profile? Import it to auto-fill your information.
        </p>
      </div>

      {/* URL Import Form */}
      <div>
        <URLImportForm
          onSuccess={onImportSuccess}
          onSkip={onContinueManually}
        />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm text-gray-500 px-2">OR</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Manual Entry Option */}
      <button
        onClick={onContinueManually}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group"
      >
        <span className="font-medium text-gray-700">Enter Details Manually</span>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
      </button>

      {/* Info Section */}
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-xs font-medium text-blue-900 mb-2">
          💡 What you can import:
        </p>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Facebook posts or profiles</li>
          <li>• Twitter/X posts or profiles</li>
          <li>• Personal blogs or websites</li>
          <li>• Sailing forum profiles</li>
        </ul>
      </div>
    </div>
  );
}
