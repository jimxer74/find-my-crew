import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { ClientTest } from '@/app/debug/client-test';

export default async function DebugPage() {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, roles, username')
    .limit(5);

  return (
    <main className="min-h-screen bg-background text-foreground p-8 space-y-6">
      <section>
        <h1 className="text-2xl font-bold mb-2">Supabase Server Debug</h1>
        <p className="text-sm text-muted-foreground mb-2">
          This is the result of a server-side query to the <code>profiles</code> table.
        </p>
        <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
          {JSON.stringify({ data, error }, null, 2)}
        </pre>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Supabase Client Debug</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Below is the result of a client-side query using the browser Supabase client.
        </p>
        <ClientTest />
      </section>
    </main>
  );
}

