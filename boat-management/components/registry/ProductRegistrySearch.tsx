'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ProductRegistryEntry } from '@boat-management/lib/types';

interface ProductRegistrySearchProps {
  category?: string;
  onSelect: (product: ProductRegistryEntry) => void;
  placeholder?: string;
}

export function ProductRegistrySearch({
  category,
  onSelect,
  placeholder = 'Search by manufacturer or model (e.g. Yanmar 3YM30)...',
}: ProductRegistrySearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductRegistryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ q });
      if (category) params.set('category', category);
      const res = await fetch(`/api/product-registry?${params}`);
      if (res.ok) {
        const json = await res.json();
        setResults(json.products ?? []);
        setIsOpen(true);
        setActiveIndex(-1);
      }
    } finally {
      setIsLoading(false);
    }
  }, [category]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (product: ProductRegistryEntry) => {
    setQuery(`${product.manufacturer} ${product.model}`);
    setIsOpen(false);
    onSelect(product);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full rounded border border-border bg-background text-foreground px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((product, i) => (
            <li
              key={product.id}
              onMouseDown={() => handleSelect(product)}
              className={`px-3 py-2 cursor-pointer text-sm hover:bg-muted ${
                i === activeIndex ? 'bg-muted' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {product.manufacturer} {product.model}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {product.is_verified && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      verified
                    </span>
                  )}
                  {product.specs?.hp && (
                    <span className="text-xs text-muted-foreground">{product.specs.hp} hp</span>
                  )}
                </div>
              </div>
              {product.description && (
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {product.description}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOpen && !isLoading && results.length === 0 && query.trim() && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg px-3 py-2 text-sm text-muted-foreground">
          No results found
        </div>
      )}
    </div>
  );
}
