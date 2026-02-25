'use client';

import { useState, useMemo } from 'react';
import { Button, Badge, Card, Select } from '@shared/ui';
import type { BoatInventory } from '@boat-management/lib/types';
import { getCategoryLabel, type EquipmentCategory } from '@boat-management/lib/types';

interface InventoryListProps {
  inventory: BoatInventory[];
  onAdd: () => void;
  onEdit: (item: BoatInventory) => void;
  onDelete: (item: BoatInventory) => void;
  isOwner: boolean;
}

export function InventoryList({ inventory, onAdd, onEdit, onDelete, isOwner }: InventoryListProps) {
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);

  const filtered = useMemo(() => {
    let items = inventory;
    if (filterCategory) {
      items = items.filter(i => i.category === filterCategory);
    }
    if (showLowStock) {
      items = items.filter(i => i.min_quantity > 0 && i.quantity <= i.min_quantity);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.supplier?.toLowerCase().includes(q) ||
        i.part_number?.toLowerCase().includes(q) ||
        i.location?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [inventory, filterCategory, searchQuery, showLowStock]);

  const lowStockCount = useMemo(
    () => inventory.filter(i => i.min_quantity > 0 && i.quantity <= i.min_quantity).length,
    [inventory]
  );

  // Gather unique categories from data
  const categories = useMemo(() => {
    const cats = new Set(inventory.map(i => i.category));
    return Array.from(cats).sort();
  }, [inventory]);

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...categories.map(c => ({ value: c, label: getCategoryLabel(c as EquipmentCategory) || c })),
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1 w-full sm:w-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inventory..."
            className="w-full sm:w-64 rounded border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} options={categoryOptions} className="w-full sm:w-auto" />
          {lowStockCount > 0 && (
            <button
              onClick={() => setShowLowStock(!showLowStock)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                showLowStock
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}
            >
              {lowStockCount} Low Stock
            </button>
          )}
        </div>
        {isOwner && (
          <Button variant="primary" onClick={onAdd} size="sm">+ Add Item</Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
        {showLowStock && ' (low stock only)'}
      </p>

      {filtered.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {inventory.length === 0
              ? 'No spare parts tracked yet. Start adding items to your inventory.'
              : 'No items match your filter.'}
          </p>
          {isOwner && inventory.length === 0 && (
            <Button variant="primary" onClick={onAdd}>Add Your First Item</Button>
          )}
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 font-medium text-muted-foreground">Item</th>
                <th className="pb-2 font-medium text-muted-foreground hidden sm:table-cell">Location</th>
                <th className="pb-2 font-medium text-muted-foreground text-center">Qty</th>
                <th className="pb-2 font-medium text-muted-foreground hidden md:table-cell">Part #</th>
                <th className="pb-2 font-medium text-muted-foreground text-right hidden lg:table-cell">Cost</th>
                {isOwner && <th className="pb-2 font-medium text-muted-foreground text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(item => (
                <InventoryRow
                  key={item.id}
                  item={item}
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item)}
                  isOwner={isOwner}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InventoryRow({
  item,
  onEdit,
  onDelete,
  isOwner,
}: {
  item: BoatInventory;
  onEdit: () => void;
  onDelete: () => void;
  isOwner: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isLowStock = item.min_quantity > 0 && item.quantity <= item.min_quantity;
  const isExpired = item.expiry_date && new Date(item.expiry_date) < new Date();

  return (
    <tr className="group hover:bg-muted/30 transition-colors">
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-2">
          <div>
            <p className="font-medium text-foreground">{item.name}</p>
            <p className="text-xs text-muted-foreground">{getCategoryLabel(item.category as EquipmentCategory) || item.category}</p>
          </div>
          {isLowStock && <Badge variant="warning" size="sm">Low</Badge>}
          {isExpired && <Badge variant="error" size="sm">Expired</Badge>}
        </div>
      </td>
      <td className="py-2.5 pr-3 text-muted-foreground hidden sm:table-cell">{item.location ?? '-'}</td>
      <td className="py-2.5 text-center">
        <span className={`font-medium ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
          {item.quantity}
        </span>
        {item.unit && <span className="text-xs text-muted-foreground ml-0.5">{item.unit}</span>}
        {item.min_quantity > 0 && (
          <span className="text-xs text-muted-foreground ml-1">/ {item.min_quantity}</span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-muted-foreground hidden md:table-cell font-mono text-xs">
        {item.part_number ?? '-'}
      </td>
      <td className="py-2.5 text-right text-muted-foreground hidden lg:table-cell">
        {item.cost != null ? `${item.cost} ${item.currency}` : '-'}
      </td>
      {isOwner && (
        <td className="py-2.5 text-right">
          {!confirmDelete ? (
            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={onEdit} className="text-xs text-muted-foreground hover:text-primary transition-colors">Edit</button>
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Delete</button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground">Cancel</button>
              <button onClick={() => { onDelete(); setConfirmDelete(false); }} className="text-xs text-destructive font-medium">Confirm</button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}
