import 'server-only';
import { createHash } from 'node:crypto';
import { RetellAdapter } from '@empleado24/integrations/retell-adapter';
import type { Json } from '@empleado24/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export function maskPhone(phone: string) {
  const suffix = phone.replace(/\D/g, '').slice(-4);
  return suffix ? `•••• ${suffix}` : 'Número privado';
}

export function configurationHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function publicAppUrl(request: Request) {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  const url = (configured || new URL(request.url).origin).replace(/\/$/, '');
  if (!/^https:\/\//.test(url) || /localhost|127\.0\.0\.1/.test(url)) return null;
  return url;
}

export async function ensureCentralRetellIntegration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
) {
  const markReady = async (integrationId: string) => {
    if (process.env.RETELL_API_KEY) {
      await createAdminClient().rpc('service_record_integration_health', {
        target_integration: integrationId,
        health_status: 'connected',
        health_error_code: '',
        health_message: 'Cuenta central de voz disponible.',
        health_latency_ms: 0,
        health_details: { account: 'central' },
      });
    }
    return integrationId;
  };
  const { data: existing } = await supabase
    .from('company_integrations')
    .select('id')
    .eq('company_id', companyId)
    .eq('provider_key', 'retell')
    .maybeSingle();
  if (existing?.id) {
    const { data: refreshed } = await supabase.rpc('configure_company_integration', {
      target_integration: existing.id,
      target_company: companyId,
      target_provider: 'retell',
      target_display_name: 'Recepcionista IA',
      target_auth_method: 'api_key',
      target_public_config: {},
      secret_payload: {},
      credential_expiry: null!,
      make_primary: true,
    });
    return markReady(refreshed ?? existing.id);
  }
  const { data: created } = await supabase.rpc('configure_company_integration', {
      target_integration: null!,
    target_company: companyId,
    target_provider: 'retell',
    target_display_name: 'Recepcionista IA',
    target_auth_method: 'api_key',
    target_public_config: {},
    secret_payload: {},
    credential_expiry: null!,
    make_primary: true,
  });
  return created ? markReady(created) : null;
}

export async function authorizedRetellContext(employeeId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: 'unauthorized' as const };
  const { data: employee } = await supabase.from('employees').select('*,employee_configs(*)').eq('id', employeeId).maybeSingle();
  if (!employee) return { error: 'not_found' as const };
  const { data: isAdmin } = await supabase.rpc('is_company_admin', { target_company: employee.company_id });
  if (!isAdmin) return { error: 'forbidden' as const };
  let { data: integration } = await supabase
    .from('company_integrations')
    .select('id,company_id,provider_key,status,enabled,public_config')
    .eq('company_id', employee.company_id)
    .eq('provider_key', 'retell')
    .maybeSingle();
  if (!integration) {
    const created = await ensureCentralRetellIntegration(supabase, employee.company_id);
    if (created) {
      const result = await supabase.from('company_integrations').select('id,company_id,provider_key,status,enabled,public_config').eq('id', created).maybeSingle();
      integration = result.data;
    }
  }
  if (!integration) return { error: 'integration_missing' as const };
  return { supabase, user: auth.user, employee, integration };
}

export async function tenantRetellAdapter(integrationId: string) {
  void integrationId;
  const admin = createAdminClient();
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) throw new Error('central_retell_api_key_missing');
  return { admin, adapter: new RetellAdapter(apiKey) };
}

export async function buildReceptionistInstructions(companyId: string, employeeId: string) {
  const admin = createAdminClient();
  const [{ data: company }, { data: employee }, { data: config }, { data: knowledge }] = await Promise.all([
    admin.from('companies').select('name,sector,country,locale,timezone,business_hours').eq('id', companyId).single(),
    admin.from('employees').select('name,description,employee_type,primary_locale,secondary_locales,personality,instructions,schedule').eq('id', employeeId).single(),
    admin.from('employee_configs').select('*').eq('employee_id', employeeId).maybeSingle(),
    admin.from('knowledge_items').select('title,content,category').eq('company_id', companyId).or(`employee_id.is.null,employee_id.eq.${employeeId}`).eq('status', 'active').order('created_at'),
  ]);
  if (!company || !employee) throw new Error('employee_configuration_missing');
  const isCloser = employee.employee_type === 'closer';
  const rules = [
    isCloser
      ? `Eres ${employee.name}, el Director Comercial digital de ${company.name}.`
      : `Eres ${employee.name}, la Recepcionista digital de ${company.name}.`,
    `Habla principalmente en ${employee.primary_locale}. Zona horaria: ${company.timezone}.`,
    employee.description ? `Tu responsabilidad: ${employee.description}` : '',
    config?.greeting ? `Saludo acordado: ${config.greeting}` : '',
    config?.farewell ? `Despedida acordada: ${config.farewell}` : '',
    config?.unknown_answer_policy ? `Si no sabes algo: ${config.unknown_answer_policy}` : 'Si no conoces una respuesta, dilo con honestidad y pide los datos para que una persona continúe.',
    config?.upset_customer_policy ? `Si el cliente se enfada: ${config.upset_customer_policy}` : '',
    config?.urgency_policy ? `Si detectas una urgencia: ${config.urgency_policy}` : '',
    config?.human_handoff_policy ? `Si pide hablar con una persona: ${config.human_handoff_policy}` : '',
    'No inventes precios, horarios, disponibilidad ni políticas. Usa únicamente la base de conocimiento conectada.',
    'Si el cliente confirma una cita, repite fecha, hora, zona horaria, duración y motivo antes de cerrar.',
    isCloser
      ? 'Comprende el interés real, acuerda un siguiente paso y registra con claridad si es una oportunidad comercial. No presiones ni inventes condiciones.'
      : 'Indica con naturalidad que eres una recepcionista digital cuando sea relevante o te lo pregunten.',
  ].filter(Boolean);
  return { instructions: rules.join('\n'), company, employee, knowledge: knowledge ?? [] };
}

export async function recordOperation(input: {
  companyId: string;
  integrationId: string;
  employeeId?: string;
  callId?: string;
  operation: string;
  status: 'started' | 'succeeded' | 'failed' | 'timeout' | 'retrying';
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
  details?: Record<string, Json | undefined>;
}) {
  const admin = createAdminClient();
  await admin.from('integration_operations').insert({
    company_id: input.companyId,
    integration_id: input.integrationId,
    employee_id: input.employeeId,
    call_id: input.callId,
    provider_key: 'retell',
    operation: input.operation,
    status: input.status,
    latency_ms: input.latencyMs,
    error_code: input.errorCode,
    error_message: input.errorMessage,
    details: (input.details ?? {}) as Json,
  });
}
