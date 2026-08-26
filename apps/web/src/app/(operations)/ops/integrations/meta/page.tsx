import Link from 'next/link';
import { OperationsService } from '@/services/operations-service';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function MetaIntegrationPage() {
  await OperationsService.requireOwner();
  const admin = createAdminClient() as any;
  const { data: latestLead } = await admin.from('sales_assistant_leads')
    .select('created_at,meta_lead_id').eq('lead_source', 'meta_lead_form').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const runtimeReady = Boolean(process.env.META_APP_SECRET && (process.env.META_LEAD_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN) && process.env.META_LEAD_VERIFY_TOKEN);
  const status = runtimeReady && latestLead ? 'CONNECTED' : runtimeReady ? 'NEEDS_CONFIGURATION' : 'NEEDS_CONFIGURATION';

  return <main className="px-5 py-8 md:px-8 md:py-10">
    <Link href="/ops/business" className="text-sm text-white/55 hover:text-white">← CEO Dashboard</Link>
    <p className="mt-8 font-mono text-[10px] uppercase tracking-[.16em] text-[#ccff00]">Integración comercial</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">Meta Lead Ads</h1>
    <section className="mt-7 max-w-2xl rounded-3xl border border-white/10 bg-white/[.035] p-6">
      <p className={`text-sm font-semibold ${status === 'CONNECTED' ? 'text-[#ccff00]' : 'text-amber-200'}`}>Estado: {status}</p>
      <dl className="mt-6 grid gap-3 text-sm text-white/65 sm:grid-cols-2">
        <Status label="Meta App / credenciales de servidor" value={runtimeReady ? 'Preparadas' : 'Pendientes'} />
        <Status label="Webhook" value={runtimeReady ? 'Preparado para verificar' : 'Pendiente'} />
        <Status label="Lead Forms" value={latestLead ? 'Recibiendo leads' : 'Sin lead recibido'} />
        <Status label="Último lead" value={latestLead?.created_at ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(latestLead.created_at)) : '—'} />
        <Status label="WhatsApp" value="Separado; requiere remitente comercial" />
        <Status label="Último error" value="—" />
      </dl>
      <p className="mt-6 text-xs leading-5 text-white/40">Los formularios entran por webhook firmado, se guardan con idempotencia y solo se contactan por canales con consentimiento.</p>
    </section>
  </main>;
}

function Status({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 p-3"><dt className="text-xs text-white/40">{label}</dt><dd className="mt-1 font-medium text-white">{value}</dd></div>;
}
