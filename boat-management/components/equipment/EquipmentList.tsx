'use client';

import { useState, useMemo } from 'react';
import { Button, Badge, Card, Select } from '@shared/ui';
import type { BoatEquipment, EquipmentCategory } from '@boat-management/lib/types';
import { EQUIPMENT_CATEGORIES, getCategoryLabel, getSubcategoryLabel } from '@boat-management/lib/types';

interface EquipmentListProps {
  equipment: BoatEquipment[];
  onAdd: () => void;
  onEdit: (item: BoatEquipment) => void;
  onDelete: (item: BoatEquipment) => void;
  isOwner: boolean;
}

const statusConfig: Record<string, { variant: 'success' | 'warning' | 'secondary'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  needs_replacement: { variant: 'warning', label: 'Needs Replacement' },
  decommissioned: { variant: 'secondary', label: 'Decommissioned' },
};

export function EquipmentList({ equipment, onAdd, onEdit, onDelete, isOwner }: EquipmentListProps) {
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let items = equipment;
    if (filterCategory) {
      items = items.filter(item => item.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        item =>
          item.name.toLowerCase().includes(q) ||
          item.manufacturer?.toLowerCase().includes(q) ||
          item.model?.toLowerCase().includes(q) ||
          item.serial_number?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [equipment, filterCategory, searchQuery]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, BoatEquipment[]>();
    for (const item of filtered) {
      const existing = map.get(item.category) ?? [];
      existing.push(item);
      map.set(item.category, existing);
    }
    return map;
  }, [filtered]);

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...EQUIPMENT_CATEGORIES.map(c => ({ value: c.value, label: c.label })),
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
            placeholder="Search equipment..."
            className="w-full sm:w-64 rounded border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            options={categoryOptions}
            className="w-full sm:w-auto"
          />
        </div>
        {isOwner && (
          <Button variant="primary" onClick={onAdd} size="sm">
            + Add Equipment
          </Button>
        )}
      </div>

      {/* Equipment count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
        {filterCategory && ` in ${getCategoryLabel(filterCategory as EquipmentCategory)}`}
      </p>

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {equipment.length === 0
              ? 'No equipment added yet. Start building your boat equipment profile.'
              : 'No equipment matches your filter.'}
          </p>
          {isOwner && equipment.length === 0 && (
            <Button variant="primary" onClick={onAdd}>
              Add Your First Equipment
            </Button>
          )}
        </Card>
      )}

      {/* Grouped equipment list */}
      {Array.from(grouped.entries()).map(([categoryKey, items]) => (
        <div key={categoryKey}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {getCategoryLabel(categoryKey as EquipmentCategory)} ({items.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map(item => (
              <EquipmentCard
                key={item.id}
                item={item}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item)}
                isOwner={isOwner}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EquipmentCard({
  item,
  onEdit,
  onDelete,
  isOwner,
}: {
  item: BoatEquipment;
  onEdit: () => void;
  onDelete: () => void;
  isOwner: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const statusInfo = statusConfig[item.status] ?? statusConfig.active;

  return (
    <Card padding="sm" className="flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-card-foreground truncate">{item.name}</h4>
          {item.subcategory && (
            <p className="text-xs text-muted-foreground">
              {getSubcategoryLabel(item.category, item.subcategory)}
            </p>
          )}
        </div>
        <Badge variant={statusInfo.variant} size="sm">
          {statusInfo.label}
        </Badge>
      </div>

      <div className="space-y-1 text-sm text-muted-foreground flex-1">
        {item.manufacturer && (
          <p className="truncate">
            <span className="font-medium">Make:</span> {item.manufacturer}
            {item.model && ` ${item.model}`}
          </p>
        )}
        {item.serial_number && (
          <p className="truncate">
            <span className="font-medium">S/N:</span> {item.serial_number}
          </p>
        )}
        {item.year_installed && (
          <p>
            <span className="font-medium">Installed:</span> {item.year_installed}
          </p>
        )}
      </div>

      {isOwner && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
          <button
            onClick={onEdit}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Edit
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-auto"
            >
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setConfirmDelete(false);
                }}
                className="text-xs text-destructive font-medium hover:text-destructive/80 transition-colors"
              >
                Confirm
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
