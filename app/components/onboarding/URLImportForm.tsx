'use client';

/**
 * URL Import Form Component
 *
 * User-facing component for importing profile content from a URL.
 * States: URL input → Loading → Preview → Success/Error
 */

import { useState } from 'react';
import { AlertCircle, Loader, CheckCircle } from 'lucide-react';

interface PreviewData {
  content: string;
  source: string;
  type: string;
  title?: string;
  author?: string;
  metadata: Record<string, any>;
}

interface URLImportFormProps {
  onSuccess: (content: string, metadata: any) => void;
  onCancel?: () => void;
}

export function URLImportForm({ onSuccess, onCancel }: URLImportFormProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  const handleImport = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/url-import/fetch-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import content');
      }

      const result = await response.json();

      setPreview({
        content: result.preview,
        source: result.source,
        type: result.resourceType,
        title: result.title,
        author: result.author,
        metadata: result.metadata,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import content';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (preview) {
      onSuccess(preview.content, preview.metadata);
    }
  };

  const handleReset = () => {
    setPreview(null);
    setUrl('');
    setError(null);
  };

  // Preview state
  if (preview) {
    return (
      <div className="space-y-4 w-full max-w-lg">
        {/* Success Banner */}
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">Content Found</h3>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                Source: {preview.source} ({preview.type})
              </p>
              {preview.author && <p className="text-sm text-amber-800 dark:text-amber-300">Author: {preview.author}</p>}
            </div>
          </div>
        </div>

        {/* Content Preview */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
          <p className="text-sm text-gray-600 mb-2 font-medium">Preview:</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
            {preview.content}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 bg-amber-600 dark:bg-amber-700 text-white rounded-lg hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors font-medium"
          >
            Save
          </button>
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium text-gray-700 dark:text-gray-300"
          >
            Try Another URL
          </button>
        </div>
      </div>
    );
  }

  // Input state
  return (
    <div className="space-y-4 w-full max-w-lg">
      {/* Input Section */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Paste your profile or post URL
        </label>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Have content on Facebook, Twitter, or a personal blog? Paste the link below and we'll extract it to help
          you get started.
        </p>
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !loading && url.trim()) {
              handleImport();
            }
          }}
          placeholder="https://facebook.com/john/posts/12345"
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-500"
          disabled={loading}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleImport}
          disabled={!url.trim() || loading}
          className="flex-1 px-4 py-2.5 bg-amber-600 dark:bg-amber-700 text-white rounded-lg hover:bg-amber-700 dark:hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Fetching...
            </>
          ) : (
            'Fetch & Import'
          )}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Help Section */}
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100">
        <p className="font-medium mb-2">💡 How to find your URL:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Facebook: Go to your post → Click share → Copy link</li>
          <li>Twitter/X: Go to your post → Click share → Copy link</li>
          <li>Blog/Website: Copy the page URL from your browser address bar</li>
        </ul>
      </div>
    </div>
  );
}
