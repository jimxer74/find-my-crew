import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';

type Params = Promise<{ id: string }>;

/**
 * GET /api/product-registry/[id]/spare-parts
 * Fetch cached spare parts for a product from the shared registry.
 * Publicly readable — no auth required.
 */
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from('product_spare_parts')
    .select('id, name, part_number, category, description, quantity, unit, notes, source, is_verified')
    .eq('product_registry_id', id)
    .order('category')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ parts: data ?? [] });
}
