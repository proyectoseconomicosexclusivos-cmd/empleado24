import Link from 'next/link';
import { ArrowLeft, KeyRound, Phone, ShieldCheck, Volume2 } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { configureIntegration, configureRetellResources } from '@/app/actions/integrations';
import { ensureCentralRetellIntegration, tenantRetellAdapter } from '@/lib/retell-runtime';
import { createClient } from '@/lib/supabase/server';
import { CompanyService } from '@/services/company-service';
import { IntegrationService } from '@/services/integration-service';

const credentialFields: Record<string, Array<[string, string]>> = {
  zadarma: [['api_key', 'Primera clave de conexión'], ['api_secret', 'Segunda clave de conexión'], ['phone_number', 'Número de teléfono']],
  brevo: [['api_key', 'Clave de conexión de Brevo']],
  twilio: [['account_sid', 'Account SID'], ['auth_token', 'Auth Token']],
  telnyx: [['api_key', 'Clave de conexión de Telnyx']],
};

const errorCopy: Record<string, string> = {
  connection: 'No hemos podido verificar esta conexión. Comprueba los datos y vuelve a intentarlo.',
  discovery: 'La conexión parece correcta, pero aún no podemos preparar la voz. Vuelve a intentarlo.',
  resources: 'La configuración elegida ya no está disponible. Elige otra y vuelve a guardar.',
  save: 'No se ha podido guardar la conexión. Inténtalo de nuevo.',
  invalid: 'Revisa los datos e inténtalo de nuevo.',
  api_key: 'La primera clave no es válida. Cópiala de nuevo desde tu cuenta de telefonía.',
  api_secret: 'La segunda clave no es válida. Cópiala de nuevo desde tu cuenta de telefonía.',
  phone_number: 'El número no pertenece a esta cuenta de Zadarma o no está disponible.',
  unreachable: 'Zadarma no ha respondido. Comprueba que el número puede recibir llamadas y vuelve a intentarlo.',
};

export default async function IntegrationDetail({
  params,
  searchParams,
}: {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{ error?: string; connected?: string; credential?: string }>;
}) {
  const { provider: providerKey } = await params;
  const supabase = await createClient();
  const { data: provider } = await supabase.from('integration_providers').select('*').eq('provider_key', providerKey).eq('active', true).maybeSingle();
  if (!provider) notFound();

  const query = await searchParams;
  const fields = credentialFields[providerKey];
  const oauthOnly = !fields;
  const membership = await CompanyService.current();
  const relation = membership?.companies;
  const company = Array.isArray(relation) ? relation[0] : relation;
  if (providerKey === 'retell') {
    if (company) await ensureCentralRetellIntegration(supabase, company.id);
    redirect('/app/recepcionista?prepare=1');
  }
  const integrationResult = company ? await IntegrationService.list(company.id) : { data: [] };
  const integration = (integrationResult.data ?? []).find((item) => item.provider_key === providerKey);
  const shouldEnterCredential = !integration || integration.status !== 'connected' || query.credential === '1';

  let retellResources: Awaited<ReturnType<typeof discoverRetellResources>> = null;
  if (providerKey === 'retell' && integration?.status === 'connected' && !shouldEnterCredential) {
    retellResources = await discoverRetellResources(integration.id);
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:px-10 md:py-14">
      <Link href="/app/integraciones" className="inline-flex items-center gap-2 text-sm text-[var(--muted)]"><ArrowLeft size={15} /> Volver a sus herramientas</Link>
      <header className="mt-10">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#efffcf] text-[#526a00] dark:bg-[#263300] dark:text-[#d7f897]"><KeyRound size={20} /></span>
        <p className="eyebrow mt-8">Conexión privada</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.06em]">{providerKey === 'retell' ? 'Preparar la voz de tu Recepcionista' : providerKey === 'zadarma' ? 'Conecta tu teléfono' : providerKey === 'brevo' ? 'Conecta la cuenta de envío de tu empresa' : `Conectar ${provider.name}`}</h1>
        <p className="mt-4 leading-7 text-[var(--muted)]">Las claves quedan cifradas dentro de tu empresa. Nunca se muestran de nuevo ni se comparten con otros clientes.</p>
      </header>

      {query.error && <p role="alert" className="mt-7 rounded-2xl bg-[#fff0eb] p-4 text-sm text-[#7b3c2b] dark:bg-[#3c211a] dark:text-[#ffc9b8]">{errorCopy[query.error] ?? errorCopy.invalid}</p>}
      {query.connected === '1' && <p role="status" className="mt-7 rounded-2xl bg-[#efffcf] p-4 text-sm text-[#486500] dark:bg-[#293500] dark:text-[#d5f899]">Conexión verificada. Ahora elige cómo quieres que hable.</p>}
      {providerKey === 'zadarma' && <section className="mt-7 rounded-3xl border border-[var(--line)] bg-black/[.025] p-6 text-sm dark:bg-white/[.035]"><p className="font-medium">Conecta tu teléfono</p><p className="mt-2 leading-6 text-[var(--muted)]">Puedes usar un número nuevo o conservar el fijo o móvil que ya conocen tus clientes. Compra el número o activa un desvío y después conecta las claves.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><a className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 font-medium hover:border-[#789500]" href="https://zadarma.com/es/order/numbers/" target="_blank" rel="noreferrer"><span className="block text-[#526a00]">1 · Comprar un número</span><span className="mt-1 block text-xs font-normal text-[var(--muted)]">Elige un número que pueda recibir llamadas.</span></a><a className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 font-medium hover:border-[#789500]" href="https://my.zadarma.com/api/" target="_blank" rel="noreferrer"><span className="block text-[#526a00]">2 · Crear claves de conexión</span><span className="mt-1 block text-xs font-normal text-[var(--muted)]">Copia las dos claves que te muestra tu cuenta.</span></a></div><div className="mt-5 rounded-2xl bg-[var(--card)] p-4 text-xs leading-5 text-[var(--muted)]"><p className="font-medium text-[var(--fg)]">Ejemplo de lo que debes pegar</p><p className="mt-1">Clave 1: <code>abc123…</code> · Clave 2: <code>••••••••</code> · Número: <code>+349XXXXXXXX</code></p></div></section>}
      {providerKey === 'brevo' && <section className="mt-7 rounded-3xl border border-[var(--line)] bg-black/[.025] p-6 text-sm dark:bg-white/[.035]"><p className="font-medium">Una única clave y nada más.</p><p className="mt-2 leading-6 text-[var(--muted)]">Abre tu cuenta de Brevo, crea una clave y pégala abajo. Tu Especialista Email utilizará exclusivamente esa cuenta para los envíos de {company?.name ?? 'tu empresa'}.</p><a className="mt-5 inline-flex rounded-full border border-[var(--line)] bg-[var(--card)] px-4 py-2 font-medium hover:border-[#789500]" href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noreferrer">Abrir mi cuenta de Brevo</a></section>}

      {oauthOnly ? (
        <section className="mt-9 rounded-3xl border border-dashed border-[var(--line)] p-7">
          <h2 className="font-semibold">Autoriza el calendario de tu empresa</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Google te mostrará exactamente qué permisos necesita tu Recepcionista. La autorización quedará aislada dentro de tu empresa.</p>
          {providerKey === 'google_calendar' ? <div className="mt-5 flex flex-wrap gap-3"><a href="/api/integrations/google-calendar/connect" className="inline-flex rounded-full bg-[#111315] px-4 py-2 text-sm font-medium text-white dark:bg-[#f4f5f0] dark:text-[#111315]">Conectar Google Calendar</a><Link href="/onboarding" className="inline-flex rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium">Omitir por ahora</Link></div> : <Link href="/app/integraciones" className="mt-5 inline-flex rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium">Volver</Link>}
        </section>
      ) : providerKey === 'retell' && integration?.status === 'connected' && !shouldEnterCredential ? (
        <RetellResourcesForm integration={integration} resources={retellResources} />
      ) : (
        <CredentialForm providerKey={providerKey} providerName={provider.name} fields={fields} />
      )}
    </main>
  );
}

async function discoverRetellResources(integrationId: string) {
  try {
    const { adapter } = await tenantRetellAdapter(integrationId);
    const voices = await adapter.listVoices();
    if ('error' in voices) return null;
    return { voices: voices.data };
  } catch {
    return null;
  }
}

function CredentialForm({ providerKey, providerName, fields }: { providerKey: string; providerName: string; fields: Array<[string, string]> }) {
  const exampleFor = (name: string) => name === 'api_key' ? 'Ejemplo: abc123…' : name === 'api_secret' ? 'Ejemplo: ••••••••' : name === 'phone_number' ? 'Ejemplo: +349XXXXXXXX' : undefined;
  return (
    <form action={configureIntegration} className="surface mt-9 rounded-3xl p-7">
      <input type="hidden" name="provider_key" value={providerKey} />
      <input type="hidden" name="display_name" value={providerName} />
      {fields.map(([name, label]) => <label key={name} className="mt-5 grid gap-2 text-sm font-medium first:mt-0">{label}<input className="input" type={name === 'phone_number' ? 'tel' : 'password'} name={name} required autoComplete="off" inputMode={name === 'phone_number' ? 'tel' : undefined} placeholder={exampleFor(name)} /><span className="text-xs font-normal text-[var(--muted)]">{name === 'phone_number' ? 'Debe incluir el prefijo internacional.' : 'Se guarda cifrado y nunca volverá a mostrarse.'}</span></label>)}
      <div className="mt-6 flex gap-3 rounded-2xl bg-black/[.025] p-4 text-sm text-[var(--muted)] dark:bg-white/[.035]">
        <ShieldCheck className="shrink-0 text-[#789500]" size={19} />
        <p>Empleado24 comprobará la conexión al guardarla. La clave quedará protegida y no volverá a mostrarse.</p>
      </div>
      <button className="mt-7 w-full rounded-full bg-[#ccff00] p-3 font-semibold text-[#111315]">Conectar y verificar</button>
    </form>
  );
}

function RetellResourcesForm({
  integration,
  resources,
}: {
  integration: { public_config: unknown };
  resources: NonNullable<Awaited<ReturnType<typeof discoverRetellResources>>> | null;
}) {
  const config = (integration.public_config ?? {}) as Record<string, unknown>;
  const currentVoice = String(config.voice_id ?? '');
  const voices = resources?.voices ?? [];

  if (!resources) {
    return <section className="mt-9 rounded-3xl border border-[#ead9a7] bg-[#fff8e5] p-7 text-[#5f4b16] dark:border-[#4d421f] dark:bg-[#2c260f] dark:text-[#f4dda0]"><h2 className="font-semibold">Aún no podemos preparar su voz.</h2><p className="mt-2 text-sm leading-6 opacity-80">La credencial sigue protegida. Vuelve a intentarlo o revisa la conexión si el problema continúa.</p><Link href="?credential=1" className="mt-5 inline-flex rounded-full bg-[#111315] px-4 py-2 text-sm font-medium text-white dark:bg-[#f4f5f0] dark:text-[#111315]">Revisar conexión</Link></section>;
  }

  return (
    <form action={configureRetellResources} className="surface mt-9 rounded-3xl p-7">
      <h2 className="text-xl font-semibold">Elige cómo atenderá tu Recepcionista</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Solo mostramos voces disponibles para tu cuenta. La línea se asignará automáticamente y nunca se compartirá con otra empresa.</p>

      <label className="mt-7 grid gap-2 text-sm font-medium"><span className="inline-flex items-center gap-2"><Volume2 size={16} /> Voz</span>
        <select className="input" name="voice_id" defaultValue={voices.some((voice) => voice.id === currentVoice) ? currentVoice : voices[0]?.id} required disabled={!voices.length}>
          {voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}{voice.accent ? ` · ${voice.accent}` : ''}{voice.gender ? ` · ${voice.gender}` : ''}</option>)}
        </select>
      </label>

      <div className="mt-5 rounded-2xl border border-[var(--line)] bg-black/[.025] p-5 text-sm text-[var(--muted)] dark:bg-white/[.035]">
        <p className="inline-flex items-center gap-2 font-medium text-[var(--fg)]"><Phone size={16} /> Línea automática</p>
        <p className="mt-1 leading-6">La línea se toma de tu cuenta de telefonía y permanece aislada para tu empresa.</p>
      </div>
      {!voices.length && <p role="alert" className="mt-5 text-sm text-[#7b3c2b] dark:text-[#ffc9b8]">No hay voces disponibles para esta cuenta.</p>}

      <button disabled={!voices.length} className="mt-7 w-full rounded-full bg-[#ccff00] p-3 font-semibold text-[#111315] disabled:cursor-not-allowed disabled:opacity-50">Guardar voz</button>
      <Link href="?credential=1" className="mt-4 block text-center text-sm text-[var(--muted)] underline-offset-4 hover:underline">Cambiar credencial</Link>
    </form>
  );
}
