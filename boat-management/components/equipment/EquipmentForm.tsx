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

  // Name autocomplete state
  const [nameSuggestions, setNameSuggestions] = useState<ProductRegistryEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [isSearchingRegistry, setIsSearchingRegistry] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameWrapperRef = useRef<HTMLDivElement>(null);

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
      setNameSuggestions([]);
      setShowSuggestions(false);
    }
  }, [isOpen, equipment]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (nameWrapperRef.current && !nameWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced registry search for name autocomplete
  const searchRegistry = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setNameSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsSearchingRegistry(true);
    try {
      const res = await fetch(`/api/product-registry?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const json = await res.json();
        setNameSuggestions(json.products ?? []);
        setShowSuggestions(true);
        setActiveSuggestion(-1);
      }
    } finally {
      setIsSearchingRegistry(false);
    }
  }, []);

  const handleNameChange = (value: string) => {
    setName(value);
    setProductRegistryId(null); // Clear registry link when name is manually edited
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchRegistry(value), 300);
  };

  const applyProduct = (product: ProductRegistryEntry) => {
    setProductRegistryId(product.id);
    setManufacturer(product.manufacturer);
    setModel(product.model);
    if (product.category) setCategory(product.category as EquipmentCategory);
    if (product.subcategory) setSubcategory(product.subcategory);
    // Set name to manufacturer + model if the current name is empty or matches old registry value
    setName(`${product.manufacturer} ${product.model}`);
    setShowSuggestions(false);
    setNameSuggestions([]);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || nameSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(i => Math.min(i + 1, nameSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeSuggestion >= 0) {
      e.preventDefault();
      applyProduct(nameSuggestions[activeSuggestion]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

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

          {/* Name field with inline registry autocomplete (add mode only) */}
          <div ref={nameWrapperRef} className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-foreground">
                Name <span className="text-destructive">*</span>
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
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onFocus={() => nameSuggestions.length > 0 && setShowSuggestions(true)}
                placeholder="e.g., Yanmar 3YM30 or Main Engine"
                required
                autoComplete="off"
                className="w-full rounded border border-border bg-background text-foreground px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {isSearchingRegistry && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {productRegistryId && (
              <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">✓ Linked to product registry</p>
            )}

            {/* Autocomplete dropdown */}
            {showSuggestions && nameSuggestions.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
                {nameSuggestions.map((product, i) => (
                  <li
                    key={product.id}
                    onMouseDown={() => applyProduct(product)}
                    className={`px-3 py-2 cursor-pointer text-sm hover:bg-muted ${
                      i === activeSuggestion ? 'bg-muted' : ''
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Manufacturer"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="e.g., Yanmar"
            />
            <Input
              label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g., 3YM30"
            />
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
