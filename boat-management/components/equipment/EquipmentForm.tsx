'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Select, Modal } from '@shared/ui';
import type {
  BoatEquipment,
  EquipmentCategory,
  EquipmentStatus,
  ProductRegistryEntry,
} from '@boat-management/lib/types';
import { EQUIPMENT_CATEGORIES as CATEGORIES } from '@boat-management/lib/types';
import { ProductRegistrySearch } from '../registry/ProductRegistrySearch';
import { ProductRegistryForm } from '../registry/ProductRegistryForm';

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
}

export function EquipmentForm({ isOpen, onClose, onSubmit, equipment, parentOptions = [] }: EquipmentFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAddToRegistry, setShowAddToRegistry] = useState(false);

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
      }
      setError('');
      setShowAddToRegistry(false);
    }
  }, [isOpen, equipment]);

  const currentCategoryInfo = CATEGORIES.find(c => c.value === category);
  const subcategoryOptions = currentCategoryInfo?.subcategories.map(s => ({
    value: s.value,
    label: s.label,
  })) ?? [];

  const handleProductSelect = (product: ProductRegistryEntry) => {
    setProductRegistryId(product.id);
    setManufacturer(product.manufacturer);
    setModel(product.model);
    if (product.subcategory) setSubcategory(product.subcategory);
    if (product.category) setCategory(product.category as EquipmentCategory);
    // Pre-fill name if not already set
    if (!name) setName(`${product.manufacturer} ${product.model}`);
    setShowAddToRegistry(false);
  };

  const handleRegistryProductCreated = (product: ProductRegistryEntry) => {
    setShowAddToRegistry(false);
    handleProductSelect(product);
  };

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

        {/* Registry search — only shown when adding new equipment */}
        {!equipment && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              Find in Product Registry
            </label>
            {showAddToRegistry ? (
              <div className="border border-border rounded-md p-4 bg-muted/30">
                <ProductRegistryForm
                  initialManufacturer={manufacturer}
                  initialModel={model}
                  initialCategory={category}
                  onCreated={handleRegistryProductCreated}
                  onCancel={() => setShowAddToRegistry(false)}
                />
              </div>
            ) : (
              <>
                <ProductRegistrySearch
                  category={category !== 'engine' ? undefined : 'engine'}
                  onSelect={handleProductSelect}
                />
                <p className="text-xs text-muted-foreground">
                  Select a product to auto-fill the form.{' '}
                  <button
                    type="button"
                    onClick={() => setShowAddToRegistry(true)}
                    className="text-primary hover:underline"
                  >
                    Not in registry? Add it
                  </button>
                </p>
                {productRegistryId && (
                  <p className="text-xs text-green-700 dark:text-green-400">
                    ✓ Linked to product registry
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Yanmar 3YM30"
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
          {parentOptions.length > 0 && (
            <Select
              label="Parent Equipment"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              options={parentOptions}
              placeholder="None (top-level)"
            />
          )}
        </div>

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
  );
}
