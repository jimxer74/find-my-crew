'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { formatDate } from '@shared/utils';
import { Footer } from '@/app/components/Footer';
import {
  AlertTriangle,
  Anchor,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Ship,
  Users,
  Wrench,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Boat {
  id: string;
  name: string;
}

interface Journey {
  id: string;
  name: string;
  state: string;
  start_date: string | null;
  end_date: string | null;
  boat_id: string;
  boats: { name: string } | null;
  leg_count: number;
  crew_needed: number;
  approved_crew: number;
}

interface PendingRegistration {
  id: string;
  created_at: string;
  ai_match_score: number | null;
  leg_id: string;
  legs: {
    name: string;
    journeys: { name: string }[] | { name: string } | null;
  } | null;
  profiles: {
    full_name: string | null;
    profile_image_url: string | null;
  } | null;
  processing?: boolean;
}

interface MaintenanceTask {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  due_date: string | null;
  boat_id: string;
  boat_name: string;
}

interface DashboardStats {
  pendingCount: number;
  approvedCrewCount: number;
  legsNeedingCrew: number;
  publishedJourneys: number;
  inPlanningJourneys: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function isOverdue(task: MaintenanceTask): boolean {
  if (task.status === 'overdue') return true;
  if (!task.due_date) return false;
  return new Date(task.due_date) < new Date() && task.status !== 'completed' && task.status !== 'skipped';
}

function priorityColor(task: MaintenanceTask): string {
  if (isOverdue(task)) return 'text-destructive';
  if (task.priority === 'critical') return 'text-destructive';
  if (task.priority === 'high') return 'text-amber-500';
  return 'text-muted-foreground';
}

function priorityLabel(task: MaintenanceTask): string {
  if (isOverdue(task)) return 'OVERDUE';
  return task.priority.toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
  href,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <ChevronRight className="w-4 h-4 text-muted-foreground mt-1" />
      </div>
      <p className="mt-3 text-2xl font-bold text-foreground leading-none">{value}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Link>
  );
}

function SectionHeader({ title, count, href }: { title: string; count?: number; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-destructive text-destructive-foreground">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </div>
      {href && (
        <Link href={href} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OwnerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    pendingCount: 0,
    approvedCrewCount: 0,
    legsNeedingCrew: 0,
    publishedJourneys: 0,
    inPlanningJourneys: 0,
  });

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = getSupabaseBrowserClient();

    // Step 1: Get owner's boats
    const { data: boatsData } = await supabase
      .from('boats')
      .select('id, name')
      .eq('owner_id', user.id);

    const ownerBoats: Boat[] = boatsData ?? [];
    setBoats(ownerBoats);

    if (ownerBoats.length === 0) {
      setLoading(false);
      return;
    }

    const boatIds = ownerBoats.map((b) => b.id);

    // Step 2: Fetch journeys + maintenance in parallel (independent of each other)
    const [journeysRes, maintenanceRes] = await Promise.all([
      supabase
        .from('journeys')
        .select('id, name, state, start_date, end_date, boat_id, boats(name)')
        .in('boat_id', boatIds)
        .in('state', ['Published', 'In planning'])
        .order('start_date', { ascending: true })
        .limit(5),

      supabase
        .from('boat_maintenance_tasks')
        .select('id, title, priority, status, due_date, boat_id')
        .in('boat_id', boatIds)
        .in('priority', ['critical', 'high'])
        .in('status', ['pending', 'in_progress', 'overdue'])
        .eq('is_template', false)
        .order('due_date', { ascending: true })
        .limit(25),
    ]);

    const allJourneys = journeysRes.data ?? [];
    const journeyIds = allJourneys.map((j: any) => j.id);

    // Step 3: Fetch legs (requires journey IDs from step 2)
    const { data: legsData } = await supabase
      .from('legs')
      .select('id, journey_id, crew_needed')
      .in('journey_id', journeyIds.length > 0 ? journeyIds : ['00000000-0000-0000-0000-000000000000']);

    const allLegs = legsData ?? [];
    const legIds = allLegs.map((l: any) => l.id);

    // Step 4: Fetch pending + approved registrations in parallel (requires leg IDs)
    const [pendingRegsRes, approvedRegsRes2] = await Promise.all([
      legIds.length > 0
        ? supabase
            .from('registrations')
            .select(`
              id, created_at, ai_match_score, leg_id,
              legs(name, journeys(name)),
              profiles(full_name, profile_image_url)
            `)
            .in('leg_id', legIds)
            .eq('status', 'Pending approval')
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] }),

      legIds.length > 0
        ? supabase
            .from('registrations')
            .select('id, leg_id, status')
            .in('leg_id', legIds)
            .eq('status', 'Approved')
        : Promise.resolve({ data: [] }),
    ]);

    const pending: PendingRegistration[] = ((pendingRegsRes.data ?? []) as any[]).map((r: any) => r as PendingRegistration);
    const approved = approvedRegsRes2.data ?? [];

    // Build journey enrichment
    const legsByJourney: Record<string, { id: string; crew_needed: number }[]> = {};
    for (const leg of allLegs) {
      if (!legsByJourney[leg.journey_id]) legsByJourney[leg.journey_id] = [];
      legsByJourney[leg.journey_id].push(leg);
    }
    const approvedByLeg: Record<string, number> = {};
    for (const reg of approved) {
      approvedByLeg[reg.leg_id] = (approvedByLeg[reg.leg_id] ?? 0) + 1;
    }

    const enrichedJourneys: Journey[] = allJourneys.map((j: any) => {
      const legs = legsByJourney[j.id] ?? [];
      const crewNeeded = legs.reduce((s: number, l: any) => s + (l.crew_needed ?? 0), 0);
      const approvedCrew = legs.reduce((s: number, l: any) => s + (approvedByLeg[l.id] ?? 0), 0);
      return {
        id: j.id,
        name: j.name,
        state: j.state,
        start_date: j.start_date,
        end_date: j.end_date,
        boat_id: j.boat_id,
        boats: j.boats,
        leg_count: legs.length,
        crew_needed: crewNeeded,
        approved_crew: approvedCrew,
      };
    });

    // Maintenance — attach boat name
    const boatNameById: Record<string, string> = {};
    for (const b of ownerBoats) boatNameById[b.id] = b.name;

    const maintenance: MaintenanceTask[] = (maintenanceRes.data ?? []).map((t: any) => ({
      ...t,
      boat_name: boatNameById[t.boat_id] ?? 'Unknown boat',
    }));

    // Stats
    const publishedLegs = allLegs.filter((l: any) =>
      allJourneys.find((j: any) => j.id === l.journey_id && j.state === 'Published')
    );
    const legsNeedingCrew = publishedLegs.filter((l: any) => (l.crew_needed ?? 0) > 0).length;

    setJourneys(enrichedJourneys);
    setPendingRegistrations(pending);
    setMaintenanceTasks(maintenance);
    setStats({
      pendingCount: pending.length,
      approvedCrewCount: approved.length,
      legsNeedingCrew,
      publishedJourneys: allJourneys.filter((j: any) => j.state === 'Published').length,
      inPlanningJourneys: allJourneys.filter((j: any) => j.state === 'In planning').length,
    });

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
      return;
    }
    if (user) fetchDashboard();
  }, [user, authLoading, router, fetchDashboard]);

  // ── Registration actions ─────────────────────────────────────────────────────
  const handleRegistrationAction = async (
    registrationId: string,
    status: 'Approved' | 'Not approved'
  ) => {
    // Optimistic remove
    setPendingRegistrations((prev) => prev.filter((r) => r.id !== registrationId));
    setStats((prev) => ({ ...prev, pendingCount: Math.max(0, prev.pendingCount - 1) }));

    const supabase = getSupabaseBrowserClient();
    await supabase
      .from('registrations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', registrationId);
  };

  // ── Maintenance grouped by boat ──────────────────────────────────────────────
  const maintenanceByBoat: Record<string, MaintenanceTask[]> = {};
  for (const task of maintenanceTasks) {
    if (!maintenanceByBoat[task.boat_id]) maintenanceByBoat[task.boat_id] = [];
    maintenanceByBoat[task.boat_id].push(task);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 pt-8 pb-16">
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-16 space-y-8">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Skipper Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your fleet, crew and upcoming journeys</p>
        </div>

        {/* No boats yet — first-time empty state */}
        {boats.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Ship className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Welcome aboard!</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                Register your first boat to start planning journeys and finding crew.
              </p>
            </div>
            <Link
              href="/owner/boats"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add your first boat
            </Link>
          </div>
        )}

        {boats.length > 0 && (
          <>
            {/* ── Stat cards ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Pending approvals"
                value={stats.pendingCount}
                icon={<Clock className="w-5 h-5" />}
                color={stats.pendingCount > 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-muted text-muted-foreground'}
                href="/owner/registrations"
              />
              <StatCard
                label="Active crew"
                value={stats.approvedCrewCount}
                sub="approved registrations"
                icon={<Users className="w-5 h-5" />}
                color="bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400"
                href="/owner/registrations"
              />
              <StatCard
                label="Legs needing crew"
                value={stats.legsNeedingCrew}
                sub="on published journeys"
                icon={<MapPin className="w-5 h-5" />}
                color={stats.legsNeedingCrew > 0 ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-muted text-muted-foreground'}
                href="/owner/journeys"
              />
              <StatCard
                label="Published journeys"
                value={stats.publishedJourneys}
                sub={stats.inPlanningJourneys > 0 ? `+ ${stats.inPlanningJourneys} in planning` : undefined}
                icon={<Anchor className="w-5 h-5" />}
                color="bg-primary/10 text-primary"
                href="/owner/journeys"
              />
            </div>

            {/* ── Quick actions ────────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/owner/journeys/create"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" /> Plan a journey
              </Link>
              <Link
                href="/owner/boats"
                className="inline-flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-accent transition-colors"
              >
                <Ship className="w-4 h-4" /> Manage boats
              </Link>
              <Link
                href="/owner/registrations"
                className="inline-flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-accent transition-colors"
              >
                <Users className="w-4 h-4" /> All registrations
              </Link>
            </div>

            {/* ── Pending registrations ────────────────────────────────────────── */}
            <section>
              <SectionHeader
                title="Pending Registrations"
                count={stats.pendingCount}
                href="/owner/registrations"
              />

              {pendingRegistrations.length === 0 ? (
                <EmptyCard message="No pending crew applications — you're all caught up!" />
              ) : (
                <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
                  {pendingRegistrations.slice(0, 8).map((reg) => (
                    <div key={reg.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Avatar + name */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {reg.profiles?.profile_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={reg.profiles.profile_image_url}
                            alt={reg.profiles.full_name ?? 'Crew'}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold text-muted-foreground">
                            {(reg.profiles?.full_name ?? 'C').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {reg.profiles?.full_name ?? 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {(() => {
                            const j = (reg.legs as any)?.journeys;
                            const jName = Array.isArray(j) ? j[0]?.name : j?.name;
                            return jName ? `${jName} · ` : '';
                          })()}
                            {reg.legs?.name ?? 'Unknown leg'}
                          </p>
                        </div>
                      </div>

                      {/* Score + time */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                        {reg.ai_match_score != null && (
                          <span className={`font-semibold ${
                            reg.ai_match_score >= 80 ? 'text-green-600 dark:text-green-400' :
                            reg.ai_match_score >= 60 ? 'text-amber-500' : 'text-muted-foreground'
                          }`}>
                            {reg.ai_match_score}%
                          </span>
                        )}
                        <span>{timeAgo(reg.created_at)}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Link
                          href={`/owner/registrations/${reg.id}`}
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleRegistrationAction(reg.id, 'Approved')}
                          className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/60 rounded-md transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRegistrationAction(reg.id, 'Not approved')}
                          className="px-3 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingRegistrations.length > 8 && (
                    <div className="px-4 py-3 text-center">
                      <Link href="/owner/registrations" className="text-xs text-primary hover:underline">
                        View {pendingRegistrations.length - 8} more pending applications
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Upcoming journeys ────────────────────────────────────────────── */}
            <section>
              <SectionHeader title="Upcoming Journeys" href="/owner/journeys" />

              {journeys.length === 0 ? (
                <EmptyCard message="No upcoming journeys. Plan your first voyage!" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {journeys.map((journey) => (
                    <Link
                      key={journey.id}
                      href={`/owner/journeys/${journey.id}/legs`}
                      className="block bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {journey.name}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                          journey.state === 'Published'
                            ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}>
                          {journey.state === 'Published' ? 'Live' : 'Draft'}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-muted-foreground">
                        {journey.boats?.name && (
                          <div className="flex items-center gap-1.5">
                            <Ship className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{journey.boats.name}</span>
                          </div>
                        )}
                        {journey.start_date && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>
                              {formatDate(journey.start_date)}
                              {journey.end_date && ` – ${formatDate(journey.end_date)}`}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {journey.leg_count} leg{journey.leg_count !== 1 ? 's' : ''}
                        </span>
                        {journey.crew_needed > 0 && (
                          <span className={`font-medium ${
                            journey.approved_crew >= journey.crew_needed
                              ? 'text-green-600 dark:text-green-400'
                              : journey.approved_crew > 0
                                ? 'text-amber-500'
                                : 'text-muted-foreground'
                          }`}>
                            {journey.approved_crew}/{journey.crew_needed} crew
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* ── Fleet maintenance ────────────────────────────────────────────── */}
            <section>
              <SectionHeader title="Fleet Maintenance" href="/owner/boats" />

              {maintenanceTasks.length === 0 ? (
                <EmptyCard message="No critical or high-priority maintenance tasks outstanding." />
              ) : (
                <div className="space-y-4">
                  {Object.entries(maintenanceByBoat).map(([boatId, tasks]) => {
                    const boat = boats.find((b) => b.id === boatId);
                    const hasOverdue = tasks.some(isOverdue);
                    return (
                      <div key={boatId} className="bg-card border border-border rounded-xl overflow-hidden">
                        {/* Boat header */}
                        <div className={`flex items-center justify-between px-4 py-2.5 border-b border-border ${
                          hasOverdue ? 'bg-destructive/5' : 'bg-muted/50'
                        }`}>
                          <div className="flex items-center gap-2">
                            <Anchor className={`w-4 h-4 ${hasOverdue ? 'text-destructive' : 'text-muted-foreground'}`} />
                            <span className="text-sm font-semibold text-foreground">
                              {boat?.name ?? tasks[0].boat_name}
                            </span>
                            {hasOverdue && (
                              <span className="flex items-center gap-1 text-xs text-destructive font-medium">
                                <AlertTriangle className="w-3 h-3" /> Overdue
                              </span>
                            )}
                          </div>
                          <Link
                            href={`/owner/boats/${boatId}/maintenance`}
                            className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5"
                          >
                            Manage <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>

                        {/* Task rows */}
                        <div className="divide-y divide-border">
                          {tasks.slice(0, 6).map((task) => (
                            <Link
                              key={task.id}
                              href={`/owner/boats/${boatId}/maintenance`}
                              className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/50 transition-colors group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Wrench className={`w-3.5 h-3.5 flex-shrink-0 ${priorityColor(task)}`} />
                                <span className="text-sm text-foreground truncate">{task.title}</span>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0 text-xs ml-2">
                                <span className={`font-semibold ${priorityColor(task)}`}>
                                  {priorityLabel(task)}
                                </span>
                                {task.due_date && (
                                  <span className={`${isOverdue(task) ? 'text-destructive' : 'text-muted-foreground'}`}>
                                    {isOverdue(task) ? 'was ' : ''}{formatDate(task.due_date)}
                                  </span>
                                )}
                              </div>
                            </Link>
                          ))}
                          {tasks.length > 6 && (
                            <div className="px-4 py-2 text-xs text-muted-foreground">
                              +{tasks.length - 6} more tasks
                              <Link href={`/owner/boats/${boatId}/maintenance`} className="ml-1 text-primary hover:underline">
                                View all
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
