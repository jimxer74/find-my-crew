'use client';

import { useState } from 'react';
import { Button, Input, Select } from '@shared/ui';
import { EQUIPMENT_CATEGORIES } from '@boat-management/lib/types';
import type { ProductRegistryEntry, EquipmentCategory } from '@boat-management/lib/types';

interface ProductRegistryFormProps {
  initialManufacturer?: string;
  initialModel?: string;
  initialCategory?: EquipmentCategory;
  onCreated: (product: ProductRegistryEntry) => void;
  onCancel: () => void;
}

export function ProductRegistryForm({
  initialManufacturer = '',
  initialModel = '',
  initialCategory = 'engine',
  onCreated,
  onCancel,
}: ProductRegistryFormProps) {
  const [manufacturer, setManufacturer] = useState(initialManufacturer);
  const [model, setModel] = useState(initialModel);
  const [category, setCategory] = useState<EquipmentCategory>(initialCategory);
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categoryOptions = EQUIPMENT_CATEGORIES.map(c => ({ value: c.value, label: c.label }));
  const currentCategoryInfo = EQUIPMENT_CATEGORIES.find(c => c.value === category);
  const subcategoryOptions = currentCategoryInfo?.subcategories.map(s => ({
    value: s.value,
    label: s.label,
  })) ?? [];

  const handleSubmit = async () => {
    if (!manufacturer.trim() || !model.trim()) {
      setError('Manufacturer and model are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/product-registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          subcategory: subcategory || null,
          manufacturer: manufacturer.trim(),
          model: model.trim(),
          description: description.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed to submit product');
        return;
      }
      onCreated(json.product);
    } catch {
      setError('Failed to submit product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground pb-1">
        Add this product to the community registry so other sailors can find it too.
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Manufacturer"
          value={manufacturer}
          onChange={e => setManufacturer(e.target.value)}
          placeholder="e.g., Yanmar"
          required
        />
        <Input
          label="Model"
          value={model}
          onChange={e => setModel(e.target.value)}
          placeholder="e.g., 3YM30"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Category"
          value={category}
          onChange={e => {
            setCategory(e.target.value as EquipmentCategory);
            setSubcategory('');
          }}
          options={categoryOptions}
          required
        />
        <Select
          label="Subcategory"
          value={subcategory}
          onChange={e => setSubcategory(e.target.value)}
          options={subcategoryOptions}
          placeholder="Select subcategory..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="e.g., Three-cylinder heat-exchanger inboard / saildrive"
        />
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button variant="ghost" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button variant="primary" type="button" onClick={handleSubmit} isLoading={saving}>
          Add to Registry
        </Button>
      </div>
    </div>
  );
}
