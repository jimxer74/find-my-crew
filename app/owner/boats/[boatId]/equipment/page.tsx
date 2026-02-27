'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { logger } from '@shared/logging';
import { EquipmentList } from '@boat-management/components/equipment';
import { EquipmentForm } from '@boat-management/components/equipment';
import type { EquipmentFormData } from '@boat-management/components/equipment';
import type { BoatEquipment } from '@boat-management/lib/types';
import { NewBoatWizardStep3 } from '@/app/components/manage/NewBoatWizardStep3';

interface BoatInfo {
  make_model: string | null;
  type: string | null;
  loa_m: number | null;
  year_built: number | null;
}

export default function EquipmentPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = use(params);
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<BoatEquipment[]>([]);
  const [boatInfo, setBoatInfo] = useState<BoatInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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
      .select('owner_id, make_model, type, loa_m, year_built')
      .eq('id', boatId)
      .single()
      .then(({ data }) => {
        if (data) {
          setIsOwner(data.owner_id === user.id);
          setBoatInfo({
            make_model: data.make_model ?? null,
            type: data.type ?? null,
            loa_m: data.loa_m ?? null,
            year_built: data.year_built ?? null,
          });
        }
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

  const handleGenerateComplete = useCallback(async () => {
    setIsGenerating(false);
    await loadEquipment();
  }, [loadEquipment]);

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

  // AI generation overlay — full-width, replaces the equipment list
  if (isGenerating && boatInfo) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-border">
          <button
            onClick={() => setIsGenerating(false)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Equipment
          </button>
        </div>
        <NewBoatWizardStep3
          boatId={boatId}
          makeModel={boatInfo.make_model ?? ''}
          boatType={boatInfo.type}
          loa_m={boatInfo.loa_m}
          yearBuilt={boatInfo.year_built}
          onComplete={handleGenerateComplete}
          onSkip={() => setIsGenerating(false)}
        />
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
        onGenerateAI={isOwner && boatInfo ? () => setIsGenerating(true) : undefined}
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
