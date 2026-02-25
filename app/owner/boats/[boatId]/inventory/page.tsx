'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { logger } from '@shared/logging';
import { InventoryList } from '@boat-management/components/inventory';
import { InventoryForm } from '@boat-management/components/inventory';
import type { InventoryFormData } from '@boat-management/components/inventory';
import type { BoatInventory, BoatEquipment } from '@boat-management/lib/types';

export default function InventoryPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = use(params);
  const { user } = useAuth();
  const [inventory, setInventory] = useState<BoatInventory[]>([]);
  const [equipment, setEquipment] = useState<BoatEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BoatInventory | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const loadData = useCallback(async () => {
    if (!boatId) return;
    try {
      const [invRes, eqRes] = await Promise.all([
        fetch(`/api/boats/${boatId}/inventory`),
        fetch(`/api/boats/${boatId}/equipment`),
      ]);
      const [invJson, eqJson] = await Promise.all([invRes.json(), eqRes.json()]);
      if (invRes.ok) setInventory(invJson.data ?? []);
      if (eqRes.ok) setEquipment(eqJson.data ?? []);
    } catch (err) {
      logger.error('Error loading inventory', { error: err instanceof Error ? err.message : String(err) });
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
    loadData();
  }, [loadData]);

  const handleAdd = () => { setEditingItem(null); setIsFormOpen(true); };
  const handleEdit = (item: BoatInventory) => { setEditingItem(item); setIsFormOpen(true); };

  const handleDelete = async (item: BoatInventory) => {
    try {
      const res = await fetch(`/api/boats/${boatId}/inventory/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        setInventory(prev => prev.filter(i => i.id !== item.id));
      }
    } catch (err) {
      logger.error('Error deleting inventory item', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleSubmit = async (data: InventoryFormData) => {
    const url = editingItem
      ? `/api/boats/${boatId}/inventory/${editingItem.id}`
      : `/api/boats/${boatId}/inventory`;
    const method = editingItem ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || 'Failed to save item');
    }
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading inventory...</div>
      </div>
    );
  }

  return (
    <>
      <InventoryList
        inventory={inventory}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isOwner={isOwner}
      />
      <InventoryForm
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingItem(null); }}
        onSubmit={handleSubmit}
        item={editingItem}
        equipment={equipment}
      />
    </>
  );
}
