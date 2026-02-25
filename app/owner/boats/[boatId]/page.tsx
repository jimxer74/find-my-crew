'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { logger } from '@shared/logging';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { Card, Badge, Button } from '@shared/ui';
import { getCategoryLabel, type EquipmentCategory } from '@boat-management/lib/types';
import type { BoatEquipment, BoatInventory, BoatMaintenanceTask, MaintenanceStatus } from '@boat-management/lib/types';
import Link from 'next/link';

export default function BoatDashboardPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = use(params);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<BoatEquipment[]>([]);
  const [inventory, setInventory] = useState<BoatInventory[]>([]);
  const [tasks, setTasks] = useState<BoatMaintenanceTask[]>([]);

  const loadDashboardData = useCallback(async () => {
    if (!boatId) return;
    try {
      const [eqRes, invRes, taskRes] = await Promise.all([
        fetch(`/api/boats/${boatId}/equipment`),
        fetch(`/api/boats/${boatId}/inventory`),
        fetch(`/api/boats/${boatId}/maintenance`),
      ]);

      const [eqJson, invJson, taskJson] = await Promise.all([
        eqRes.json(), invRes.json(), taskRes.json(),
      ]);

      if (eqRes.ok) setEquipment(eqJson.data ?? []);
      if (invRes.ok) setInventory(invJson.data ?? []);
      if (taskRes.ok) setTasks(taskJson.data ?? []);
    } catch (err) {
      logger.error('Error loading dashboard', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }, [boatId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const today = new Date().toISOString().split('T')[0];
  const overdueTasks = tasks.filter(t =>
    t.due_date && t.due_date < today && (t.status === 'pending' || t.status === 'in_progress')
  );
  const upcomingTasks = tasks.filter(t =>
    t.due_date && t.due_date >= today && (t.status === 'pending' || t.status === 'in_progress')
  ).slice(0, 5);
  const lowStockItems = inventory.filter(i => i.min_quantity > 0 && i.quantity <= i.min_quantity);
  const needsReplacement = equipment.filter(e => e.status === 'needs_replacement');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  // Equipment category breakdown
  const categoryBreakdown = new Map<string, number>();
  for (const e of equipment) {
    categoryBreakdown.set(e.category, (categoryBreakdown.get(e.category) ?? 0) + 1);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Equipment" value={equipment.length} href={`/owner/boats/${boatId}/equipment`} />
        <StatCard label="Inventory Items" value={inventory.length} href={`/owner/boats/${boatId}/inventory`} />
        <StatCard
          label="Pending Tasks"
          value={tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length}
          href={`/owner/boats/${boatId}/maintenance`}
        />
        <StatCard label="Completed" value={completedTasks.length} href={`/owner/boats/${boatId}/maintenance`} />
      </div>

      {/* Alerts section */}
      {(overdueTasks.length > 0 || lowStockItems.length > 0 || needsReplacement.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Alerts</h2>

          {overdueTasks.length > 0 && (
            <Card padding="sm" className="border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="error" size="sm">{overdueTasks.length} Overdue</Badge>
                <span className="text-sm font-medium text-foreground">Maintenance Tasks</span>
              </div>
              <ul className="space-y-1">
                {overdueTasks.map(t => (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{t.title}</span>
                    <span className="text-xs text-red-600 dark:text-red-400">
                      Due {new Date(t.due_date!).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={`/owner/boats/${boatId}/maintenance`} className="text-xs text-primary hover:text-primary/80 mt-2 inline-block">
                View all tasks
              </Link>
            </Card>
          )}

          {lowStockItems.length > 0 && (
            <Card padding="sm" className="border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="warning" size="sm">{lowStockItems.length} Low Stock</Badge>
                <span className="text-sm font-medium text-foreground">Inventory Items</span>
              </div>
              <ul className="space-y-1">
                {lowStockItems.map(i => (
                  <li key={i.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{i.name}</span>
                    <span className="text-xs text-yellow-700 dark:text-yellow-400">
                      {i.quantity} / {i.min_quantity} {i.unit ?? ''}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={`/owner/boats/${boatId}/inventory`} className="text-xs text-primary hover:text-primary/80 mt-2 inline-block">
                View inventory
              </Link>
            </Card>
          )}

          {needsReplacement.length > 0 && (
            <Card padding="sm" className="border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="warning" size="sm">{needsReplacement.length}</Badge>
                <span className="text-sm font-medium text-foreground">Equipment Needs Replacement</span>
              </div>
              <ul className="space-y-1">
                {needsReplacement.map(e => (
                  <li key={e.id} className="text-sm text-foreground">
                    {e.name} ({getCategoryLabel(e.category)})
                  </li>
                ))}
              </ul>
              <Link href={`/owner/boats/${boatId}/equipment`} className="text-xs text-primary hover:text-primary/80 mt-2 inline-block">
                View equipment
              </Link>
            </Card>
          )}
        </div>
      )}

      {/* Upcoming tasks */}
      {upcomingTasks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Upcoming Tasks</h2>
          <div className="space-y-2">
            {upcomingTasks.map(t => (
              <Card key={t.id} padding="sm" className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.category} {t.estimated_hours ? `- ${t.estimated_hours}h` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={priorityBadgeVariant(t.priority)} size="sm" outlined>
                    {t.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(t.due_date!).toLocaleDateString()}
                  </span>
                </div>
              </Card>
            ))}
          </div>
          <Link href={`/owner/boats/${boatId}/maintenance`} className="text-xs text-primary hover:text-primary/80 mt-2 inline-block">
            View all tasks
          </Link>
        </div>
      )}

      {/* Equipment overview */}
      {equipment.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Equipment by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Array.from(categoryBreakdown.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => (
                <Card key={cat} padding="sm" className="text-center">
                  <p className="text-lg font-bold text-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground">{getCategoryLabel(cat as EquipmentCategory)}</p>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {equipment.length === 0 && inventory.length === 0 && tasks.length === 0 && (
        <Card className="text-center py-12">
          <h2 className="text-lg font-semibold text-foreground mb-2">Welcome to Boat Management</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Start by adding your boat's equipment, spare parts, and maintenance schedule
            to keep everything organized and on track.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={`/owner/boats/${boatId}/equipment`}>
              <Button variant="primary">Add Equipment</Button>
            </Link>
            <Link href={`/owner/boats/${boatId}/inventory`}>
              <Button variant="outline">Add Spare Parts</Button>
            </Link>
            <Link href={`/owner/boats/${boatId}/maintenance`}>
              <Button variant="outline">Schedule Maintenance</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <Card padding="sm" className="text-center hover:border-primary/50 transition-colors cursor-pointer">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </Card>
    </Link>
  );
}

function priorityBadgeVariant(priority: string): 'secondary' | 'info' | 'warning' | 'error' {
  switch (priority) {
    case 'critical': return 'error';
    case 'high': return 'warning';
    case 'medium': return 'info';
    default: return 'secondary';
  }
}
