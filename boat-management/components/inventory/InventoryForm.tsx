'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Select, Modal } from '@shared/ui';
import type { BoatInventory, BoatEquipment } from '@boat-management/lib/types';
import { EQUIPMENT_CATEGORIES } from '@boat-management/lib/types';

interface InventoryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InventoryFormData) => Promise<void>;
  item?: BoatInventory | null;
  equipment?: BoatEquipment[];
}

export interface InventoryFormData {
  name: string;
  category: string;
  quantity: number;
  min_quantity: number;
  unit: string;
  location: string;
  supplier: string;
  part_number: string;
  cost: number | null;
  currency: string;
  purchase_date: string;
  expiry_date: string;
  notes: string;
  equipment_id: string | null;
}

const LOCATION_OPTIONS = [
  { value: '', label: 'Select location...' },
  { value: 'engine_room', label: 'Engine Room' },
  { value: 'lazarette', label: 'Lazarette' },
  { value: 'forepeak', label: 'Forepeak' },
  { value: 'cockpit_locker', label: 'Cockpit Locker' },
  { value: 'salon', label: 'Salon' },
  { value: 'galley', label: 'Galley' },
  { value: 'head', label: 'Head' },
  { value: 'aft_cabin', label: 'Aft Cabin' },
  { value: 'forward_cabin', label: 'Forward Cabin' },
  { value: 'chain_locker', label: 'Chain Locker' },
  { value: 'deck', label: 'On Deck' },
  { value: 'mast', label: 'Mast' },
  { value: 'other', label: 'Other' },
];

const UNIT_OPTIONS = [
  { value: '', label: 'Select unit...' },
  { value: 'pieces', label: 'Pieces' },
  { value: 'liters', label: 'Liters' },
  { value: 'meters', label: 'Meters' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'sets', label: 'Sets' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'bottles', label: 'Bottles' },
  { value: 'cans', label: 'Cans' },
];

const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'SEK', label: 'SEK' },
  { value: 'NOK', label: 'NOK' },
  { value: 'DKK', label: 'DKK' },
];

export function InventoryForm({ isOpen, onClose, onSubmit, item, equipment = [] }: InventoryFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [minQuantity, setMinQuantity] = useState('0');
  const [unit, setUnit] = useState('');
  const [location, setLocation] = useState('');
  const [supplier, setSupplier] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [equipmentId, setEquipmentId] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setName(item.name);
        setCategory(item.category);
        setQuantity(item.quantity.toString());
        setMinQuantity(item.min_quantity.toString());
        setUnit(item.unit ?? '');
        setLocation(item.location ?? '');
        setSupplier(item.supplier ?? '');
        setPartNumber(item.part_number ?? '');
        setCost(item.cost?.toString() ?? '');
        setCurrency(item.currency);
        setPurchaseDate(item.purchase_date ?? '');
        setExpiryDate(item.expiry_date ?? '');
        setNotes(item.notes ?? '');
        setEquipmentId(item.equipment_id ?? '');
      } else {
        setName(''); setCategory(''); setQuantity('0'); setMinQuantity('0');
        setUnit(''); setLocation(''); setSupplier(''); setPartNumber('');
        setCost(''); setCurrency('EUR'); setPurchaseDate(''); setExpiryDate('');
        setNotes(''); setEquipmentId('');
      }
      setError('');
    }
  }, [isOpen, item]);

  const categoryOptions = [
    { value: '', label: 'Select category...' },
    ...EQUIPMENT_CATEGORIES.map(c => ({ value: c.value, label: c.label })),
    { value: 'consumables', label: 'Consumables' },
    { value: 'provisions', label: 'Provisions' },
    { value: 'cleaning', label: 'Cleaning Supplies' },
    { value: 'tools', label: 'Tools' },
  ];

  const equipmentOptions = [
    { value: '', label: 'None (general spare)' },
    ...equipment.map(e => ({ value: e.id, label: `${e.name} (${e.category})` })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !category) {
      setError('Name and category are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        name: name.trim(),
        category,
        quantity: parseInt(quantity, 10) || 0,
        min_quantity: parseInt(minQuantity, 10) || 0,
        unit,
        location,
        supplier: supplier.trim(),
        part_number: partNumber.trim(),
        cost: cost ? parseFloat(cost) : null,
        currency,
        purchase_date: purchaseDate || '',
        expiry_date: expiryDate || '',
        notes: notes.trim(),
        equipment_id: equipmentId || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? 'Edit Spare Part' : 'Add Spare Part'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm">{error}</div>
        )}

        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Engine oil filter" required />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={categoryOptions} required />
          <Select label="Related Equipment" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} options={equipmentOptions} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input label="Quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <Input label="Min. Stock" type="number" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} helperText="Alert threshold" />
          <Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} options={UNIT_OPTIONS} />
          <Select label="Location" value={location} onChange={(e) => setLocation(e.target.value)} options={LOCATION_OPTIONS} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g., Marine Depot" />
          <Input label="Part Number" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="e.g., YM-119305-35151" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input label="Cost" type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
          <Select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} options={CURRENCY_OPTIONS} />
          <Input label="Purchase Date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          <Input label="Expiry Date" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Where to buy, compatible alternatives, etc."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit" isLoading={saving}>{item ? 'Update' : 'Add Item'}</Button>
        </div>
      </form>
    </Modal>
  );
}
