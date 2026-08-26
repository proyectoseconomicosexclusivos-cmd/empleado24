import Link from 'next/link';
import { OperationsService } from '@/services/operations-service';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function WhatsAppIntegrationPage() {
  await OperationsService.requireOwner();
  const admin = createAdminClient() as any;
  const { count } = await admin.from('company_integrations')
    .select('id', { count: 'exact', head: true })
    .eq('provider_key', 'whatsapp_meta').eq('status', 'connected').eq('enabled', true);
  const webhookReady = Boolean(process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
  const dedicatedSender = /^\d{8,16}$/.test((process.env.SALES_WHATSAPP_NUMBER ?? '').replace(/\D/g, ''));
  const connected = webhookReady && dedicatedSender && Number(count ?? 0) > 0;

  return <main className="px-5 py-8 md:px-8 md:py-10">
    <Link href="/ops/business" className="text-sm text-white/55 hover:text-white">← CEO Dashboard</Link>
    <p className="mt-8 font-mono text-[10px] uppercase tracking-[.16em] text-[#ccff00]">Integración comercial</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">WhatsApp</h1>
    <section className="mt-7 max-w-2xl rounded-3xl border border-white/10 bg-white/[.035] p-6">
      <p className={`text-sm font-semibold ${connected ? 'text-[#ccff00]' : 'text-amber-200'}`}>Estado: {connected ? 'CONNECTED' : 'NOT CONNECTED'}</p>
      {!connected && <><h2 className="mt-5 text-xl font-semibold">Qué falta</h2><p className="mt-2 text-sm leading-6 text-white/60">WhatsApp Business Phone Number exclusivo de Empleado24 y su conexión verificable. Nunca se reutiliza un número de un cliente.</p></>}
      <h2 className="mt-7 text-sm font-semibold">Comprobaciones seguras</h2>
      <dl className="mt-3 grid gap-3 text-sm text-white/65 sm:grid-cols-2">
        <Status label="Webhook" value={webhookReady ? 'Preparado' : 'Pendiente'} />
        <Status label="Número comercial exclusivo" value={dedicatedSender ? 'Configurado' : 'Pendiente'} />
        <Status label="Integraciones de clientes activas" value={String(count ?? 0)} />
        <Status label="Persistencia e idempotencia" value="Preparadas" />
      </dl>
      <h2 className="mt-7 text-sm font-semibold">Qué hay que configurar</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/60"><li>Phone Number ID</li><li>WABA ID</li><li>Access Token</li><li>Webhook Verify Token</li></ul>
      <p className="mt-6 text-xs leading-5 text-white/40">Este panel no muestra ni almacena secretos. El envío comercial requiere consentimiento explícito.</p>
    </section>
  </main>;
}

function Status({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 p-3"><dt className="text-xs text-white/40">{label}</dt><dd className="mt-1 font-medium text-white">{value}</dd></div>;
}
