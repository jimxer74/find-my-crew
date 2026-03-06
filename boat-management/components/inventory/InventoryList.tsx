'use client';

import { useState, useMemo, ReactNode } from 'react';
import { Button, Badge, Card, Select } from '@shared/ui';
import type { BoatInventory, BoatEquipment } from '@boat-management/lib/types';
import { getCategoryLabel, type EquipmentCategory } from '@boat-management/lib/types';

interface InventoryListProps {
  inventory: BoatInventory[];
  equipment?: BoatEquipment[];
  onAdd: () => void;
  onEdit: (item: BoatInventory) => void;
  onDelete: (item: BoatInventory) => void;
  isOwner: boolean;
}

export function InventoryList({ inventory, equipment = [], onAdd, onEdit, onDelete, isOwner }: InventoryListProps) {
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

  const categories = useMemo(() => {
    const cats = new Set(inventory.map(i => i.category));
    return Array.from(cats).sort();
  }, [inventory]);

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...categories.map(c => ({ value: c, label: getCategoryLabel(c as EquipmentCategory) || c })),
  ];

  // Build equipment id → name map
  const equipmentMap = useMemo(() => {
    const m = new Map<string, string>();
    equipment.forEach(eq => m.set(eq.id, eq.name));
    return m;
  }, [equipment]);

  // Group filtered items by equipment_id
  const groups = useMemo(() => {
    const byEquipment = new Map<string | null, BoatInventory[]>();

    filtered.forEach(item => {
      const key = item.equipment_id ?? null;
      if (!byEquipment.has(key)) byEquipment.set(key, []);
      byEquipment.get(key)!.push(item);
    });

    // Sort: named equipment groups first (by name), then General
    const result: Array<{ equipmentId: string | null; label: string; items: BoatInventory[] }> = [];

    byEquipment.forEach((items, equipmentId) => {
      const label = equipmentId
        ? (equipmentMap.get(equipmentId) ?? 'Unknown Equipment')
        : 'General';
      result.push({ equipmentId, label, items });
    });

    result.sort((a, b) => {
      if (a.equipmentId === null) return 1;
      if (b.equipmentId === null) return -1;
      return a.label.localeCompare(b.label);
    });

    return result;
  }, [filtered, equipmentMap]);

  const showGrouped = equipment.length > 0;

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
            className="w-full sm:w-64 rounded border border-border bg-input-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
      ) : showGrouped ? (
        <div className="space-y-3">
          {groups.map(({ equipmentId, label, items }) => (
            <InventoryGroup key={equipmentId ?? '__general__'} label={label} count={items.length}>
              <InventoryTable items={items} onEdit={onEdit} onDelete={onDelete} isOwner={isOwner} />
            </InventoryGroup>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <InventoryTable items={filtered} onEdit={onEdit} onDelete={onDelete} isOwner={isOwner} />
        </div>
      )}
    </div>
  );
}

function InventoryGroup({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-2 w-full px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <svg
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">({count} {count === 1 ? 'item' : 'items'})</span>
      </button>
      {!collapsed && (
        <div className="overflow-x-auto">
          {children}
        </div>
      )}
    </div>
  );
}

function InventoryTable({
  items,
  onEdit,
  onDelete,
  isOwner,
}: {
  items: BoatInventory[];
  onEdit: (item: BoatInventory) => void;
  onDelete: (item: BoatInventory) => void;
  isOwner: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left bg-background">
          <th className="px-4 pb-2 pt-2 font-medium text-muted-foreground">Item</th>
          <th className="pb-2 pt-2 font-medium text-muted-foreground hidden sm:table-cell">Location</th>
          <th className="pb-2 pt-2 font-medium text-muted-foreground text-center">Qty</th>
          <th className="pb-2 pt-2 font-medium text-muted-foreground hidden md:table-cell">Part #</th>
          <th className="pb-2 pt-2 font-medium text-muted-foreground text-right hidden lg:table-cell">Cost</th>
          {isOwner && <th className="pb-2 pt-2 pr-4 font-medium text-muted-foreground text-right">Actions</th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {items.map(item => (
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
      <td className="py-2.5 pl-4 pr-3">
        <div className="flex items-center gap-2">
          <div>
            <p className="font-medium text-foreground">{item.name}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">{getCategoryLabel(item.category as EquipmentCategory) || item.category}</p>
              {item.supplier_url && (
                <a
                  href={item.supplier_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 transition-colors"
                  title="Open supplier page"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Buy
                </a>
              )}
            </div>
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
        <td className="py-2.5 pr-4 text-right">
          {!confirmDelete ? (
            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={onEdit} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
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
