import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';

type Params = Promise<{ id: string }>;

/**
 * GET /api/product-registry/[id]/maintenance-tasks
 * Fetch cached maintenance tasks for a product from the shared registry.
 * Publicly readable — no auth required.
 */
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from('product_maintenance_tasks')
    .select('id, title, description, category, priority, recurrence, estimated_hours, source, is_verified')
    .eq('product_registry_id', id)
    .order('category')
    .order('priority');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data ?? [] });
}

/**
 * POST /api/product-registry/[id]/maintenance-tasks
 * Cache AI-generated maintenance tasks for a product.
 * Replaces existing AI-sourced tasks for this product.
 * Requires authentication.
 */
export async function POST(request: NextRequest, { params }: { params: Params }) {
  const { id: productRegistryId } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { tasks } = body as {
    tasks: Array<{
      title: string;
      description?: string | null;
      category: string;
      priority?: string;
      recurrence?: { type: string; interval_days?: number; engine_hours?: number } | null;
      estimated_hours?: number | null;
    }>;
  };

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: 'tasks array is required' }, { status: 400 });
  }

  // Replace existing AI-generated tasks for this product
  const { error: deleteErr } = await supabase
    .from('product_maintenance_tasks')
    .delete()
    .eq('product_registry_id', productRegistryId)
    .eq('source', 'ai');

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  const { data, error: insertErr } = await supabase
    .from('product_maintenance_tasks')
    .insert(
      tasks.map(t => ({
        product_registry_id: productRegistryId,
        title: t.title,
        description: t.description ?? null,
        category: t.category,
        priority: t.priority ?? 'medium',
        recurrence: t.recurrence ?? null,
        estimated_hours: t.estimated_hours ?? null,
        source: 'ai',
        is_verified: false,
      }))
    )
    .select('id');

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ count: data?.length ?? 0 }, { status: 201 });
}
