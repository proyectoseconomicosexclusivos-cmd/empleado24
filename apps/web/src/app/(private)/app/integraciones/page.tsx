import Link from 'next/link';
import { ArrowRight, CalendarDays, Mail, MessageSquare, Phone, PlugZap } from 'lucide-react';
import { CompanyService } from '@/services/company-service';
import { IntegrationService } from '@/services/integration-service';
import { createClient } from '@/lib/supabase/server';
import { IntegrationTestButton } from '@/components/integration-test-button';

const icons = { voice: Phone, calendar: CalendarDays, email: Mail, messaging: MessageSquare, telephony: Phone } as const;
const statusCopy = {
  connected: ['Conectada', 'bg-[#e9ffcf] text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]'],
  error: ['Necesita atención', 'bg-[#fff0eb] text-[#7b3c2b] dark:bg-[#3c211a] dark:text-[#ffc9b8]'],
  pending: ['Pendiente de verificar', 'bg-[#fff8e5] text-[#5f4b16] dark:bg-[#2c260f] dark:text-[#f4dda0]'],
  expired: ['Ha caducado', 'bg-[#fff0eb] text-[#7b3c2b] dark:bg-[#3c211a] dark:text-[#ffc9b8]'],
} as const;

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ configured?: string }> }) {
  const membership = await CompanyService.current();
  const relation = membership?.companies;
  const company = Array.isArray(relation) ? relation[0] : relation;
  if (!company) return null;
  const supabase = await createClient();
  const [{ data: providers }, integrationsResult] = await Promise.all([
    supabase.from('integration_providers').select('*').eq('active', true).order('category'),
    IntegrationService.list(company.id),
  ]);
  const integrations = integrationsResult.data ?? [];
  const query = await searchParams;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:px-10 md:py-14">
      <header className="max-w-3xl"><p className="eyebrow">Conexiones</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.06em] md:text-5xl">Dale a cada empleado lo que necesita para trabajar.</h1><p className="mt-4 leading-7 text-[var(--muted)]">Cada conexión pertenece únicamente a {company.name}. Hasta que una herramienta esté verificada, ningún empleado afirmará que puede utilizarla.</p></header>
      {query.configured && <p role="status" className="mt-7 rounded-2xl bg-[#fff8e5] p-4 text-sm text-[#5f4b16] dark:bg-[#2c260f] dark:text-[#f4dda0]">Credenciales guardadas de forma cifrada. Comprueba la conexión antes de darla por disponible.</p>}
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {(providers ?? []).filter((provider) => provider.provider_key !== 'retell').map((provider) => {
          const connection = integrations.find((item) => item.provider_key === provider.provider_key);
          const statusKey = connection?.status as keyof typeof statusCopy | undefined;
          const status = statusKey && statusCopy[statusKey] ? statusCopy[statusKey] : ['Pendiente de configurar', 'bg-black/5 text-[var(--muted)] dark:bg-white/5'];
          const Icon = icons[provider.category];
          return <article key={provider.provider_key} className="surface rounded-3xl p-6"><div className="flex items-start justify-between gap-4"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#efffcf] text-[#526a00] dark:bg-[#263300] dark:text-[#d7f897]"><Icon size={19} /></span><span className={`rounded-full px-3 py-1.5 text-xs font-medium ${status[1]}`}>{status[0]}</span></div><h2 className="mt-8 text-xl font-semibold">{provider.name}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{connection?.last_error_message || (connection?.status === 'connected' ? 'La conexión ha sido verificada.' : 'Todavía no está disponible para tu Recepcionista.')}</p><div className="mt-6 flex flex-wrap items-start gap-3"><Link href={`/app/integraciones/${provider.provider_key}`} className="inline-flex items-center gap-2 rounded-full bg-[#111315] px-4 py-2 text-sm font-medium text-white dark:bg-[#f4f5f0] dark:text-[#111315]">{connection ? 'Revisar conexión' : 'Completar conexión'} <ArrowRight size={14} /></Link>{connection && <IntegrationTestButton id={connection.id} />}</div></article>;
        })}
      </div>
      {!providers?.length && <div className="mt-10 rounded-3xl border border-dashed border-[var(--line)] p-8 text-center"><PlugZap className="mx-auto text-[var(--muted)]" /><p className="mt-4 font-medium">No hay herramientas disponibles todavía.</p></div>}
    </main>
  );
}
