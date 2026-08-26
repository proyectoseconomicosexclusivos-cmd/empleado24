import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function text(value: unknown, maximum = 300) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

/**
 * This is deliberately a user-initiated handoff, not an unsolicited send.
 * A commercial WhatsApp sender is configured independently from each
 * customer's WhatsApp integration, so a tenant's number can never be reused
 * for Empleado24 sales outreach.
 */
export async function GET(request: Request) {
  const token = text(new URL(request.url).searchParams.get('token'), 128);
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(token)) return NextResponse.json({ error: 'invalid_lead' }, { status: 400 });

  const sender = (process.env.SALES_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
  if (!/^\d{8,16}$/.test(sender)) return NextResponse.json({ available: false });

  const { data, error } = await (createAdminClient() as any)
    .from('sales_assistant_leads')
    .select('name,company_name,primary_problem,phone,consent_status,do_not_contact_at')
    .eq('lead_token', token)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 });
  if (!data.phone || data.consent_status !== 'opted_in' || data.do_not_contact_at)
    return NextResponse.json({ available: false });

  const message = [
    `Hola, soy ${data.name}.`,
    'Acabo de hablar con Laura de Empleado24.',
    `Busco mejorar ${data.primary_problem || 'la atención comercial'} en ${data.company_name || 'mi empresa'}.`,
    'Quiero ver la recomendación preparada para mí.',
  ].join(' ');
  return NextResponse.json({ available: true, href: `https://wa.me/${sender}?text=${encodeURIComponent(message)}` });
}
