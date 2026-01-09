'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';

type Result = {
  data: any;
  error: any;
} | null;

export function ClientTest() {
  const [result, setResult] = useState<Result>(null);

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, username')
        .limit(5);

      setResult({ data, error });
    };

    run();
  }, []);

  return (
    <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

