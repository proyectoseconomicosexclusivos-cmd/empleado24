import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { guardRateLimit } from '@/lib/api-guard';

function anonymousId(value: string | null) {
  return value && /^[A-Za-z0-9_-]{16,120}$/.test(value) ? value : null;
}

function chooseVariant(visitor: string, variants: Array<{ key?: unknown }>) {
  const usable = variants.filter((entry): entry is { key: string; message?: string } => typeof entry?.key === 'string' && entry.key.length > 0);
  if (!usable.length) return null;
  let hash = 0;
  for (const character of visitor) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return usable[hash % usable.length] ?? null;
}

export async function GET(request: Request) {
  const id = anonymousId(new URL(request.url).searchParams.get('anonymousId'));
  if (!id) return NextResponse.json({ error: 'invalid_visitor' }, { status: 400 });
  const limited = await guardRateLimit(request, {
    action: 'conversion.experiment.read', maxRequests: 12, windowSeconds: 300,
    dimensions: [{ kind: 'identity', value: id }],
  });
  if (limited) return limited;

  const admin = createAdminClient() as any;
  const { data: experiment } = await admin
    .from('conversion_experiments')
    .select('experiment_key,target,variants')
    .eq('status', 'active')
    .eq('target', 'laura_opening')
    .maybeSingle();
  if (!experiment) return NextResponse.json({ experiment: null });

  const { data: assignment } = await admin
    .from('conversion_experiment_assignments')
    .select('variant_key')
    .eq('experiment_key', experiment.experiment_key)
    .eq('anonymous_id', id)
    .maybeSingle();
  const selected = assignment
    ? (experiment.variants as Array<{ key?: string; message?: string }>).find((variant) => variant.key === assignment.variant_key) ?? null
    : chooseVariant(id, experiment.variants as Array<{ key?: unknown; message?: unknown }>);
  if (!selected) return NextResponse.json({ experiment: null });
  if (!assignment) await admin.from('conversion_experiment_assignments').upsert({
    experiment_key: experiment.experiment_key, anonymous_id: id, variant_key: selected.key,
  }, { onConflict: 'experiment_key,anonymous_id', ignoreDuplicates: true });
  return NextResponse.json({ experiment: { key: experiment.experiment_key, target: experiment.target, variant: selected.key, message: selected.message ?? null } });
}
