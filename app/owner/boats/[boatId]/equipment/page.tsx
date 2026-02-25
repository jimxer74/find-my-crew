'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { logger } from '@shared/logging';
import { EquipmentList } from '@boat-management/components/equipment';
import { EquipmentForm } from '@boat-management/components/equipment';
import type { EquipmentFormData } from '@boat-management/components/equipment';
import type { BoatEquipment } from '@boat-management/lib/types';

export default function EquipmentPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = use(params);
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<BoatEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BoatEquipment | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const loadEquipment = useCallback(async () => {
    if (!boatId) return;
    try {
      const res = await fetch(`/api/boats/${boatId}/equipment`);
      const json = await res.json();
      if (res.ok) {
        setEquipment(json.data ?? []);
      } else {
        logger.error('Failed to load equipment', { error: json.error });
      }
    } catch (err) {
      logger.error('Error loading equipment', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }, [boatId]);

  useEffect(() => {
    if (!user?.id || !boatId) return;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from('boats')
      .select('owner_id')
      .eq('id', boatId)
      .single()
      .then(({ data }) => {
        setIsOwner(data?.owner_id === user.id);
      });
  }, [user?.id, boatId]);

  useEffect(() => {
    loadEquipment();
  }, [loadEquipment]);

  const handleAdd = () => { setEditingItem(null); setIsFormOpen(true); };
  const handleEdit = (item: BoatEquipment) => { setEditingItem(item); setIsFormOpen(true); };

  const handleDelete = async (item: BoatEquipment) => {
    try {
      const res = await fetch(`/api/boats/${boatId}/equipment/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        setEquipment(prev => prev.filter(e => e.id !== item.id));
      }
    } catch (err) {
      logger.error('Error deleting equipment', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleSubmit = async (data: EquipmentFormData) => {
    const url = editingItem
      ? `/api/boats/${boatId}/equipment/${editingItem.id}`
      : `/api/boats/${boatId}/equipment`;
    const method = editingItem ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || 'Failed to save equipment');
    }
    await loadEquipment();
  };

  const parentOptions = equipment
    .filter(e => !e.parent_id && e.id !== editingItem?.id)
    .map(e => ({ value: e.id, label: `${e.name} (${e.category})` }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading equipment...</div>
      </div>
    );
  }

  return (
    <>
      <EquipmentList
        equipment={equipment}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isOwner={isOwner}
      />
      <EquipmentForm
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingItem(null); }}
        onSubmit={handleSubmit}
        equipment={editingItem}
        parentOptions={parentOptions}
      />
    </>
  );
}
