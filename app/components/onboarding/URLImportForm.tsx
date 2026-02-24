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
  onSkip: () => void;
}

export function URLImportForm({ onSuccess, onSkip }: URLImportFormProps) {
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
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900">Content Found</h3>
              <p className="text-sm text-green-800 mt-1">
                Source: {preview.source} ({preview.type})
              </p>
              {preview.author && <p className="text-sm text-green-800">Author: {preview.author}</p>}
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
            className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Use This Content
          </button>
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
          >
            Try Another URL
          </button>
        </div>

        {/* Skip Option */}
        <button
          onClick={onSkip}
          className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-700 underline"
        >
          Skip and enter manually
        </button>
      </div>
    );
  }

  // Input state
  return (
    <div className="space-y-4 w-full max-w-lg">
      {/* Input Section */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Paste your profile or post URL
        </label>
        <p className="text-sm text-gray-600 mb-3">
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
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
          disabled={loading}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex gap-2 p-3 bg-red-50 rounded-lg border border-red-200 text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleImport}
          disabled={!url.trim() || loading}
          className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Fetching...
            </>
          ) : (
            'Import Profile/Post'
          )}
        </button>
        <button
          onClick={onSkip}
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
        >
          Skip
        </button>
      </div>

      {/* Help Section */}
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-800">
        <p className="font-medium mb-2">💡 How to find your URL:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Facebook: Go to your post → Click share → Copy link</li>
          <li>Twitter: Go to your tweet → Click share → Copy link</li>
          <li>Blog/Website: Copy the page URL from your browser address bar</li>
        </ul>
      </div>

      {/* Alternative Option */}
      <button
        onClick={onSkip}
        className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-700 underline"
      >
        I don't have a link, let me enter details manually
      </button>
    </div>
  );
}
