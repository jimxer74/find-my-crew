'use client';

import { useState } from 'react';
import { Button, Input, Modal } from '@shared/ui';
import { ProductLinks } from './ProductLinks';
import type { ProductRegistryEntry } from '@boat-management/lib/types';

interface ProductAISearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: ProductRegistryEntry) => void;
  initialManufacturer?: string;
  initialModel?: string;
}

export function ProductAISearchDialog({
  isOpen,
  onClose,
  onSelect,
  initialManufacturer = '',
  initialModel = '',
}: ProductAISearchDialogProps) {
  const [manufacturer, setManufacturer] = useState(initialManufacturer);
  const [model, setModel] = useState(initialModel);
  const [additionalText, setAdditionalText] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ProductRegistryEntry[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!manufacturer.trim() && !model.trim() && !additionalText.trim()) {
      setError('Please enter at least one search term');
      return;
    }
    setSearching(true);
    setError('');
    setResults([]);
    setSearched(false);

    try {
      const res = await fetch('/api/product-registry/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer, model, additionalText }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Search failed');
        return;
      }
      setResults(json.products ?? []);
      setSearched(true);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (product: ProductRegistryEntry) => {
    onSelect(product);
    onClose();
  };

  const handleClose = () => {
    setManufacturer(initialManufacturer);
    setModel(initialModel);
    setAdditionalText('');
    setResults([]);
    setSearched(false);
    setError('');
    setExpandedId(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Search for Equipment"
      size="lg"
      showCloseButton
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Describe the equipment you're looking for. Our AI will search for matching products and save the best results for future use.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Manufacturer"
            value={manufacturer}
            onChange={e => setManufacturer(e.target.value)}
            placeholder="e.g., Yanmar"
          />
          <Input
            label="Model"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="e.g., 3YM30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Additional search text
          </label>
          <textarea
            value={additionalText}
            onChange={e => setAdditionalText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSearch();
              }
            }}
            rows={2}
            className="w-full rounded border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="e.g., saildrive engine 25-30hp, diesel marine engine, chartplotter with AIS..."
          />
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={handleSearch}
            isLoading={searching}
          >
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {/* Results */}
        {searched && (
          <div className="border-t border-border pt-4 space-y-3">
            {results.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="font-medium">No products found</p>
                <p className="text-sm mt-1">
                  Try different search terms, or add the equipment manually using the form fields.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  {results.length} product{results.length !== 1 ? 's' : ''} found
                </p>
                <ul className="space-y-3">
                  {results.map(product => (
                    <li
                      key={product.id}
                      className="border border-border rounded-md overflow-hidden"
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">
                              {product.manufacturer} {product.model}
                            </span>
                            {product.is_verified && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                verified
                              </span>
                            )}
                            {product.specs?.hp && (
                              <span className="text-xs text-muted-foreground">
                                {product.specs.hp} hp
                              </span>
                            )}
                          </div>
                          {product.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {product.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setExpandedId(prev => prev === product.id ? null : product.id)}
                            className="text-xs text-primary hover:underline"
                          >
                            {expandedId === product.id ? 'Hide details' : 'Details'}
                          </button>
                          <Button
                            variant="primary"
                            size="sm"
                            type="button"
                            onClick={() => handleSelect(product)}
                          >
                            Select
                          </Button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {expandedId === product.id && (
                        <div className="border-t border-border px-3 pb-3 pt-2 bg-muted/20 space-y-2">
                          {product.variants && product.variants.length > 0 && (
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Variants:
                              </span>{' '}
                              <span className="text-sm">{product.variants.join(', ')}</span>
                            </div>
                          )}
                          {product.specs && Object.keys(product.specs).length > 0 && (
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                                Specs:
                              </span>
                              <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
                                {Object.entries(product.specs).map(([k, v]) => (
                                  <div key={k} className="flex gap-1">
                                    <dt className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}:</dt>
                                    <dd className="font-medium">{String(v)}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          )}
                          <ProductLinks product={product} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
