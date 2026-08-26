import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { guardRateLimit } from '@/lib/api-guard';

type ConversationBody = Record<string, unknown>;
type CommercialState = 'COLD' | 'INTERESTED' | 'VERY_INTERESTED' | 'READY_TO_BUY' | 'QUALIFIED' | 'CUSTOMER' | 'LOST' | 'DO_NOT_CONTACT';

const states = new Set<CommercialState>(['COLD', 'INTERESTED', 'VERY_INTERESTED', 'READY_TO_BUY', 'QUALIFIED', 'CUSTOMER', 'LOST', 'DO_NOT_CONTACT']);

function text(value: unknown, maximum: number) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function visitorId(value: unknown) {
  const candidate = text(value, 120);
  return /^[A-Za-z0-9_-]{16,120}$/.test(candidate) ? candidate : null;
}

function state(value: unknown): CommercialState | null {
  return typeof value === 'string' && states.has(value as CommercialState)
    ? value as CommercialState
    : null;
}

function roi(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const candidate = value as Record<string, unknown>;
  const numbers = ['monthlyHours', 'hourlyValue', 'monthlySaving', 'monthlyCost', 'monthlyBenefit'];
  return Object.fromEntries(numbers.flatMap((key) => {
    const amount = candidate[key];
    return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000
      ? [[key, Math.round(amount * 100) / 100]]
      : [];
  }));
}

export async function GET(request: Request) {
  const id = visitorId(new URL(request.url).searchParams.get('anonymousId'));
  if (!id) return NextResponse.json({ error: 'invalid_conversation' }, { status: 400 });
  const limited = await guardRateLimit(request, {
    action: 'sales_assistant.conversation.read', maxRequests: 30, windowSeconds: 300,
    dimensions: [{ kind: 'identity', value: id }],
  });
  if (limited) return limited;
  const { data, error } = await (createAdminClient() as any)
    .from('sales_assistant_conversations')
    .select('commercial_state,sector,company_size,primary_problem,objection,recommended_employees,roi_snapshot,visit_count,conversation_completed_at,demo_opened_at,last_seen_at')
    .eq('anonymous_id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'conversation_unavailable' }, { status: 503 });
  return NextResponse.json({ conversation: data ?? null });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ConversationBody | null;
  const id = visitorId(body?.anonymousId);
  const sessionId = visitorId(body?.sessionId);
  const action = text(body?.action, 40);
  if (!id || !sessionId || !['presented', 'answer', 'intent', 'objection', 'roi', 'demo', 'completed'].includes(action))
    return NextResponse.json({ error: 'invalid_conversation' }, { status: 400 });

  const limited = await guardRateLimit(request, {
    action: 'sales_assistant.conversation.write', maxRequests: 80, windowSeconds: 300,
    dimensions: [{ kind: 'identity', value: id }],
  });
  if (limited) return limited;

  const admin = createAdminClient() as any;
  const { data: existing, error: existingError } = await admin
    .from('sales_assistant_conversations')
    .select('anonymous_id,visit_count,answer_history,commercial_state')
    .eq('anonymous_id', id)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: 'conversation_unavailable' }, { status: 503 });

  const requestedState = state(body?.commercialState);
  const priorState = existing?.commercial_state as CommercialState | undefined;
  const stateRank: Record<CommercialState, number> = { COLD: 0, INTERESTED: 1, VERY_INTERESTED: 2, QUALIFIED: 3, READY_TO_BUY: 4, CUSTOMER: 5, LOST: 5, DO_NOT_CONTACT: 6 };
  const commercialState = requestedState && (!priorState || stateRank[requestedState] >= stateRank[priorState])
    ? requestedState
    : priorState ?? 'COLD';
  const history = Array.isArray(existing?.answer_history) ? existing.answer_history.slice(-19) : [];
  const answer = action === 'answer' || action === 'objection'
    ? { action, field: text(body?.field, 40), value: text(body?.value, 200), at: new Date().toISOString() }
    : null;
  if (answer) history.push(answer);
  const recommendation = Array.isArray(body?.recommendation)
    ? body.recommendation.filter((entry): entry is string => typeof entry === 'string').slice(0, 4)
    : undefined;
  const now = new Date().toISOString();
  const payload = {
    anonymous_id: id,
    session_id: sessionId,
    commercial_state: commercialState,
    sector: text(body?.sector, 80) || undefined,
    company_size: text(body?.companySize, 40) || undefined,
    primary_problem: text(body?.primaryProblem, 80) || undefined,
    objection: action === 'objection' ? text(body?.value, 200) || null : undefined,
    recommended_employees: recommendation,
    roi_snapshot: action === 'roi' ? roi(body?.roi) : undefined,
    answer_history: history,
    visit_count: action === 'presented' ? Number(existing?.visit_count ?? 0) + 1 : Number(existing?.visit_count ?? 0),
    conversation_started_at: action === 'answer' ? now : undefined,
    conversation_completed_at: action === 'completed' ? now : undefined,
    roi_shown_at: action === 'roi' ? now : undefined,
    demo_opened_at: action === 'demo' ? now : undefined,
    last_seen_at: now,
    updated_at: now,
  };
  const clean = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  const { data, error } = await admin.from('sales_assistant_conversations')
    .upsert(clean, { onConflict: 'anonymous_id' })
    .select('commercial_state,visit_count,sector,company_size,primary_problem,recommended_employees,roi_snapshot,objection')
    .single();
  if (error) return NextResponse.json({ error: 'conversation_unavailable' }, { status: 503 });
  return NextResponse.json({ ok: true, conversation: data });
}
