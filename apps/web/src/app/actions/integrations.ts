'use server';

import { testProviderConnection, type IntegrationCredentials } from '@empleado24/integrations/connection-health';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CompanyService } from '@/services/company-service';
import { IntegrationService } from '@/services/integration-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ensureCentralRetellIntegration, tenantRetellAdapter } from '@/lib/retell-runtime';
import { headers } from 'next/headers';
import { enforceRateLimit } from '@/lib/rate-limit';

const apiKeyProviders: Record<string, string[]> = {
  zadarma: ['api_key', 'api_secret'],
  brevo: ['api_key'],
  twilio: ['account_sid', 'auth_token'],
  telnyx: ['api_key'],
  whatsapp_meta: ['access_token'],
};

async function protectIntegrationAction(action: string, userId: string, companyId: string) {
  const request = new Request('https://empleado24.internal/action', { headers: await headers() });
  const decision = await enforceRateLimit(request, {
    action,
    maxRequests: 6,
    windowSeconds: 900,
    dimensions: [{ kind: 'user', value: userId }, { kind: 'company', value: companyId }],
  });
  if (!decision.allowed) redirect('/app/integraciones?error=rate_limit');
}

export async function configureIntegration(formData: FormData) {
  const providerKey = String(formData.get('provider_key') ?? '');
  const fields = apiKeyProviders[providerKey];
  if (!fields) redirect(`/app/integraciones/${providerKey}?error=unsupported`);
  const membership = await CompanyService.current();
  const relation = membership?.companies;
  const company = Array.isArray(relation) ? relation[0] : relation;
  const userId = membership?.user_id;
  if (!company || !userId) redirect('/onboarding');
  await protectIntegrationAction('integration.configure', userId, company.id);
  const credentials = Object.fromEntries(fields.filter((field) => field !== 'phone_number').map((field) => [field, String(formData.get(field) ?? '').trim()]));
  if (Object.values(credentials).some((value) => value.length < 4)) redirect(`/app/integraciones/${providerKey}?error=invalid`);
  const publicConfig = providerKey === 'zadarma'
    ? { from_number: String(formData.get('phone_number') ?? '').trim() }
    : providerKey === 'whatsapp_meta'
      ? { waba_id: String(formData.get('waba_id') ?? '').trim(), phone_number_id: String(formData.get('phone_number_id') ?? '').trim(), graph_api_version: String(formData.get('graph_api_version') ?? 'v21.0').trim() }
      : {};
  if (providerKey === 'zadarma' && !/^\+[1-9]\d{7,14}$/.test(String(publicConfig.from_number))) redirect(`/app/integraciones/${providerKey}?error=invalid`);
  if (providerKey === 'whatsapp_meta' && (!/^\d+$/.test(String(publicConfig.waba_id)) || !/^\d+$/.test(String(publicConfig.phone_number_id)) || !/^v\d+\.\d+$/.test(String(publicConfig.graph_api_version)))) redirect(`/app/integraciones/${providerKey}?error=invalid`);
  const { data: integrationId, error } = await IntegrationService.configure({ companyId: company.id, providerKey, displayName: String(formData.get('display_name') ?? providerKey).slice(0, 80), authMethod: 'api_key', credentials, publicConfig, makePrimary: true });
  if (error || !integrationId) redirect(`/app/integraciones/${providerKey}?error=save`);

  const health = await testProviderConnection({ providerKey, authMethod: 'api_key', credentials: credentials as IntegrationCredentials, publicConfig });
  await recordHealth(integrationId, health);
  revalidatePath('/app', 'layout');
  if (health.status !== 'connected') {
    const friendly = providerKey === 'zadarma'
      ? ({
          provider_http_401: 'api_key',
          provider_http_403: 'api_secret',
          provider_http_404: 'phone_number',
          connection_timeout: 'unreachable',
          provider_unreachable: 'unreachable',
        } as Record<string, string>)[health.code] ?? 'connection'
      : 'connection';
    redirect(`/app/integraciones/${providerKey}?error=${friendly}`);
  }
  if (providerKey === 'brevo') redirect('/app/especialista-email?connected=1');
  if (providerKey === 'whatsapp_meta') redirect('/app/whatsapp?connected=1');
  redirect(providerKey === 'retell' ? '/app/integraciones/retell?connected=1' : `/onboarding?configured=${providerKey}`);
}

export async function skipGoogleCalendar() {
  const membership = await CompanyService.current();
  const relation = membership?.companies;
  const company = Array.isArray(relation) ? relation[0] : relation;
  const userId = membership?.user_id;
  if (!company || !userId) redirect('/login');
  await protectIntegrationAction('integration.calendar.skip', userId, company.id);
  const supabase = createAdminClient();
  const { data: current } = await supabase.from('settings').select('data').eq('company_id', company.id).maybeSingle();
  const currentData = current?.data && typeof current.data === 'object' && !Array.isArray(current.data) ? current.data as Record<string, unknown> : {};
  await supabase.from('settings').upsert({ company_id: company.id, data: { ...currentData, calendar_skipped: true, calendar_skipped_at: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: 'company_id' });
  revalidatePath('/app', 'layout');
  redirect('/onboarding?configured=calendar_skipped');
}

export async function configureRetellResources(formData: FormData) {
  const membership = await CompanyService.current();
  const relation = membership?.companies;
  const company = Array.isArray(relation) ? relation[0] : relation;
  const userId = membership?.user_id;
  if (!company || !userId) redirect('/onboarding');
  await protectIntegrationAction('integration.resources', userId, company.id);

  const integrations = await IntegrationService.list(company.id);
  const existing = (integrations.data ?? []).find((item) => item.provider_key === 'retell');
  const integrationId = existing?.id ?? await ensureCentralRetellIntegration(await createClient(), company.id);
  const integration = existing ?? (integrationId ? { id: integrationId, status: 'connected', display_name: 'Recepcionista IA' } : null);
  if (!integration || integration.status !== 'connected') redirect('/app/recepcionista?error=connection');

  const voiceId = String(formData.get('voice_id') ?? '').trim();
  const fromNumber = String(formData.get('from_number') ?? '').trim();
  if (!voiceId || (fromNumber && !/^\+[1-9]\d{7,14}$/.test(fromNumber)))
    redirect('/app/integraciones/retell?error=resources');

  let availableVoices: Array<{ id: string }>;
  try {
    const { admin, adapter } = await tenantRetellAdapter(integration.id);
    const voices = await adapter.listVoices();
    if ('error' in voices) throw new Error('retell_resource_discovery_failed');
    availableVoices = voices.data;
  } catch {
    redirect('/app/integraciones/retell?error=discovery');
  }
  if (!availableVoices.some((voice) => voice.id === voiceId)) {
    redirect('/app/integraciones/retell?error=resources');
  }

  const { error } = await IntegrationService.configure({
    integrationId: integration.id,
    companyId: company.id,
    providerKey: 'retell',
    displayName: integration.display_name,
    authMethod: 'api_key',
    credentials: null,
    publicConfig: fromNumber ? { voice_id: voiceId, from_number: fromNumber } : { voice_id: voiceId },
    makePrimary: true,
  });
  if (error) redirect('/app/integraciones/retell?error=save');
  await recordHealth(integration.id, {
    status: 'connected',
    code: 'connection_ok',
    message: 'Conexión y recursos verificados.',
    latencyMs: 0,
    details: { resourcesVerified: true },
  });
  revalidatePath('/app', 'layout');
  redirect('/app/recepcionista?prepare=1');
}

async function recordHealth(
  integrationId: string,
  result: {
    status: 'connected' | 'error' | 'pending' | 'expired';
    code: string;
    message: string;
    latencyMs: number;
    details: Record<string, string | number | boolean>;
  },
) {
  const admin = createAdminClient();
  await admin.rpc('service_record_integration_health', {
    target_integration: integrationId,
    health_status: result.status,
    health_error_code: result.status === 'connected' ? '' : result.code,
    health_message: result.message,
    health_latency_ms: result.latencyMs,
    health_details: result.details,
  });
}
