'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Input, Select, Modal } from '@shared/ui';
import type {
  BoatEquipment,
  EquipmentCategory,
  EquipmentStatus,
  ProductRegistryEntry,
} from '@boat-management/lib/types';
import { EQUIPMENT_CATEGORIES as CATEGORIES } from '@boat-management/lib/types';
import { ProductAISearchDialog } from '../registry/ProductAISearchDialog';

interface EquipmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EquipmentFormData) => Promise<void>;
  equipment?: BoatEquipment | null;
  parentOptions?: { value: string; label: string }[];
}

export interface EquipmentFormData {
  name: string;
  category: EquipmentCategory;
  subcategory: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  year_installed: number | null;
  notes: string;
  status: EquipmentStatus;
  parent_id: string | null;
  product_registry_id: string | null;
  quantity: number;
}

export function EquipmentForm({ isOpen, onClose, onSubmit, equipment, parentOptions = [] }: EquipmentFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAISearch, setShowAISearch] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<EquipmentCategory>('engine');
  const [subcategory, setSubcategory] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [yearInstalled, setYearInstalled] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<EquipmentStatus>('active');
  const [parentId, setParentId] = useState<string>('');
  const [productRegistryId, setProductRegistryId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Manufacturer autocomplete state
  const [manufacturerSuggestions, setManufacturerSuggestions] = useState<string[]>([]);
  const [showManufacturerSuggestions, setShowManufacturerSuggestions] = useState(false);
  const [activeManufacturerSuggestion, setActiveManufacturerSuggestion] = useState(-1);
  const [isSearchingManufacturer, setIsSearchingManufacturer] = useState(false);

  // Model autocomplete state
  const [modelSuggestions, setModelSuggestions] = useState<ProductRegistryEntry[]>([]);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);
  const [activeModelSuggestion, setActiveModelSuggestion] = useState(-1);
  const [isSearchingModel, setIsSearchingModel] = useState(false);

  const manufacturerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manufacturerWrapperRef = useRef<HTMLDivElement>(null);
  const modelWrapperRef = useRef<HTMLDivElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  // Reset form when equipment changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (equipment) {
        setName(equipment.name);
        setCategory(equipment.category);
        setSubcategory(equipment.subcategory ?? '');
        setManufacturer(equipment.manufacturer ?? '');
        setModel(equipment.model ?? '');
        setSerialNumber(equipment.serial_number ?? '');
        setYearInstalled(equipment.year_installed?.toString() ?? '');
        setNotes(equipment.notes ?? '');
        setStatus(equipment.status);
        setParentId(equipment.parent_id ?? '');
        setProductRegistryId(equipment.product_registry_id ?? null);
        setQuantity(equipment.quantity ?? 1);
      } else {
        setName('');
        setCategory('engine');
        setSubcategory('');
        setManufacturer('');
        setModel('');
        setSerialNumber('');
        setYearInstalled('');
        setNotes('');
        setStatus('active');
        setParentId('');
        setProductRegistryId(null);
        setQuantity(1);
      }
      setError('');
      setManufacturerSuggestions([]);
      setShowManufacturerSuggestions(false);
      setModelSuggestions([]);
      setShowModelSuggestions(false);
    }
  }, [isOpen, equipment]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (manufacturerWrapperRef.current && !manufacturerWrapperRef.current.contains(e.target as Node)) {
        setShowManufacturerSuggestions(false);
      }
      if (modelWrapperRef.current && !modelWrapperRef.current.contains(e.target as Node)) {
        setShowModelSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // -------------------------------------------------------------------------
  // Registry search helpers
  // -------------------------------------------------------------------------

  const searchManufacturers = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setManufacturerSuggestions([]);
      setShowManufacturerSuggestions(false);
      return;
    }
    setIsSearchingManufacturer(true);
    try {
      const res = await fetch(`/api/product-registry?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const json = await res.json();
        const products: ProductRegistryEntry[] = json.products ?? [];
        // Deduplicate manufacturer names, preserve order
        const seen = new Set<string>();
        const unique: string[] = [];
        for (const p of products) {
          if (p.manufacturer && !seen.has(p.manufacturer)) {
            seen.add(p.manufacturer);
            unique.push(p.manufacturer);
          }
        }
        setManufacturerSuggestions(unique);
        setShowManufacturerSuggestions(unique.length > 0);
        setActiveManufacturerSuggestion(-1);
      }
    } finally {
      setIsSearchingManufacturer(false);
    }
  }, []);

  const searchModels = useCallback(async (manufacturerVal: string, modelQuery: string) => {
    if (!modelQuery.trim() || modelQuery.length < 1) {
      setModelSuggestions([]);
      setShowModelSuggestions(false);
      return;
    }
    setIsSearchingModel(true);
    try {
      // Combine manufacturer + model for a tighter search when manufacturer is known
      const q = manufacturerVal.trim() ? `${manufacturerVal} ${modelQuery}` : modelQuery;
      const res = await fetch(`/api/product-registry?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        const products: ProductRegistryEntry[] = json.products ?? [];
        setModelSuggestions(products);
        setShowModelSuggestions(products.length > 0);
        setActiveModelSuggestion(-1);
      }
    } finally {
      setIsSearchingModel(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Change handlers
  // -------------------------------------------------------------------------

  const handleManufacturerChange = (value: string) => {
    setManufacturer(value);
    setProductRegistryId(null);
    // Changing manufacturer invalidates any existing model suggestions
    setModelSuggestions([]);
    setShowModelSuggestions(false);
    if (manufacturerDebounceRef.current) clearTimeout(manufacturerDebounceRef.current);
    manufacturerDebounceRef.current = setTimeout(() => searchManufacturers(value), 300);
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    setProductRegistryId(null);
    if (modelDebounceRef.current) clearTimeout(modelDebounceRef.current);
    modelDebounceRef.current = setTimeout(() => searchModels(manufacturer, value), 300);
  };

  // -------------------------------------------------------------------------
  // Selection handlers
  // -------------------------------------------------------------------------

  const selectManufacturer = (mfr: string) => {
    setManufacturer(mfr);
    setShowManufacturerSuggestions(false);
    setManufacturerSuggestions([]);
    setProductRegistryId(null);
    // Move focus to model field so the user can continue
    modelInputRef.current?.focus();
  };

  /** Called when user picks a full product entry from the model dropdown */
  const applyProduct = (product: ProductRegistryEntry) => {
    setProductRegistryId(product.id);
    setManufacturer(product.manufacturer);
    setModel(product.model);
    if (product.category) setCategory(product.category as EquipmentCategory);
    if (product.subcategory) setSubcategory(product.subcategory);
    setShowModelSuggestions(false);
    setModelSuggestions([]);
    setShowManufacturerSuggestions(false);
    setManufacturerSuggestions([]);
  };

  // -------------------------------------------------------------------------
  // Keyboard navigation
  // -------------------------------------------------------------------------

  const handleManufacturerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showManufacturerSuggestions || manufacturerSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveManufacturerSuggestion(i => Math.min(i + 1, manufacturerSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveManufacturerSuggestion(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeManufacturerSuggestion >= 0) {
      e.preventDefault();
      selectManufacturer(manufacturerSuggestions[activeManufacturerSuggestion]);
    } else if (e.key === 'Escape') {
      setShowManufacturerSuggestions(false);
    }
  };

  const handleModelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showModelSuggestions || modelSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveModelSuggestion(i => Math.min(i + 1, modelSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveModelSuggestion(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeModelSuggestion >= 0) {
      e.preventDefault();
      applyProduct(modelSuggestions[activeModelSuggestion]);
    } else if (e.key === 'Escape') {
      setShowModelSuggestions(false);
    }
  };

  // -------------------------------------------------------------------------
  // Form submit
  // -------------------------------------------------------------------------

  const currentCategoryInfo = CATEGORIES.find(c => c.value === category);
  const subcategoryOptions = currentCategoryInfo?.subcategories.map(s => ({
    value: s.value,
    label: s.label,
  })) ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        name: name.trim(),
        category,
        subcategory: subcategory || '',
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        serial_number: serialNumber.trim(),
        year_installed: yearInstalled ? parseInt(yearInstalled, 10) : null,
        notes: notes.trim(),
        status,
        parent_id: parentId || null,
        product_registry_id: productRegistryId,
        quantity,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save equipment');
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions = CATEGORIES.map(c => ({ value: c.value, label: c.label }));

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'decommissioned', label: 'Decommissioned' },
    { value: 'needs_replacement', label: 'Needs Replacement' },
  ];

  // Shared input class (matches the existing inline input styling)
  const inputCls =
    'w-full rounded border border-border bg-background text-foreground px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={equipment ? 'Edit Equipment' : 'Add Equipment'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Name — plain input, no autocomplete */}
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Main Engine, Genoa, VHF Radio"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as EquipmentCategory);
                setSubcategory('');
              }}
              options={categoryOptions}
              required
            />

            <Select
              label="Subcategory"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              options={subcategoryOptions}
              placeholder="Select subcategory..."
            />
          </div>

          {/* Manufacturer + Model — both with registry autocomplete */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Manufacturer */}
            <div ref={manufacturerWrapperRef} className="relative">
              <label className="block text-sm font-medium text-foreground mb-1">
                Manufacturer
              </label>
              <div className="relative">
                <input
                  value={manufacturer}
                  onChange={e => handleManufacturerChange(e.target.value)}
                  onKeyDown={handleManufacturerKeyDown}
                  onFocus={() => manufacturerSuggestions.length > 0 && setShowManufacturerSuggestions(true)}
                  placeholder="e.g., Yanmar"
                  autoComplete="off"
                  className={inputCls}
                />
                {isSearchingManufacturer && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {showManufacturerSuggestions && manufacturerSuggestions.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {manufacturerSuggestions.map((mfr, i) => (
                    <li
                      key={mfr}
                      onMouseDown={() => selectManufacturer(mfr)}
                      className={`px-3 py-2 cursor-pointer text-sm text-foreground hover:bg-muted ${
                        i === activeManufacturerSuggestion ? 'bg-muted' : ''
                      }`}
                    >
                      {mfr}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Model */}
            <div ref={modelWrapperRef} className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-foreground">
                  Model
                </label>
                {!equipment && (
                  <button
                    type="button"
                    onClick={() => setShowAISearch(true)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                    Not found? Search it
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  ref={modelInputRef}
                  value={model}
                  onChange={e => handleModelChange(e.target.value)}
                  onKeyDown={handleModelKeyDown}
                  onFocus={() => modelSuggestions.length > 0 && setShowModelSuggestions(true)}
                  placeholder="e.g., 3YM30"
                  autoComplete="off"
                  className={inputCls}
                />
                {isSearchingModel && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {productRegistryId && (
                <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">✓ Linked to product registry</p>
              )}

              {showModelSuggestions && modelSuggestions.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
                  {modelSuggestions.map((product, i) => (
                    <li
                      key={product.id}
                      onMouseDown={() => applyProduct(product)}
                      className={`px-3 py-2 cursor-pointer text-sm hover:bg-muted ${
                        i === activeModelSuggestion ? 'bg-muted' : ''
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
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Serial Number"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Optional"
            />
            <Input
              label="Year Installed"
              type="number"
              value={yearInstalled}
              onChange={(e) => setYearInstalled(e.target.value)}
              placeholder="e.g., 2020"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as EquipmentStatus)}
              options={statusOptions}
            />
            <Input
              label="Quantity"
              type="number"
              value={quantity.toString()}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setQuantity(v >= 1 ? v : 1);
              }}
              placeholder="1"
            />
          </div>

          {parentOptions.length > 0 && (
            <Select
              label="Parent Equipment"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              options={parentOptions}
              placeholder="None (top-level)"
            />
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Additional details, condition notes, etc."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={saving}>
              {equipment ? 'Update' : 'Add Equipment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* AI Search dialog — renders outside the form to avoid nested form issues */}
      {!equipment && (
        <ProductAISearchDialog
          isOpen={showAISearch}
          onClose={() => setShowAISearch(false)}
          onSelect={applyProduct}
          initialManufacturer={manufacturer}
          initialModel={model}
        />
      )}
    </>
  );
}
