import { NextResponse } from 'next/server';
import type { Json } from '@empleado24/types';
import {
  authorizedRetellContext,
  buildReceptionistInstructions,
  configurationHash,
  publicAppUrl,
  recordOperation,
  tenantRetellAdapter,
} from '@/lib/retell-runtime';
import { guardRateLimit } from '@/lib/api-guard';

export const maxDuration = 60;

function statusFor(error: string) {
  if (error === 'unauthorized') return 401;
  if (error === 'forbidden') return 403;
  if (error === 'not_found') return 404;
  return 409;
}

function readableErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
    return error.message;
  return 'retell_agent_sync_failed';
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authorized = await authorizedRetellContext(id);
  if ('error' in authorized)
    return NextResponse.json(
      { error: authorized.error },
      { status: statusFor(authorized.error ?? 'unknown') },
    );
  const limited = await guardRateLimit(request, {
    action: 'retell.agent.read', maxRequests: 30, windowSeconds: 60,
    dimensions: [{ kind: 'user', value: authorized.user.id }, { kind: 'company', value: authorized.employee.company_id }],
  });
  if (limited) return limited;
  const { data: resource } = await authorized.supabase
    .from('employee_provider_resources')
    .select('*')
    .eq('employee_id', id)
    .eq('provider_key', 'retell')
    .maybeSingle();
  if (!resource) return NextResponse.json({ error: 'agent_not_created' }, { status: 404 });
  try {
    const { adapter } = await tenantRetellAdapter(authorized.integration.id);
    const result = await adapter.getAgent(resource.external_agent_id);
    if ('error' in result)
      return NextResponse.json(
        { error: result.error.code, message: result.error.message },
        { status: 502 },
      );
    return NextResponse.json({ resource, provider: result.data });
  } catch {
    return NextResponse.json({ error: 'retell_runtime_unavailable' }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now();
  const { id } = await context.params;
  const authorized = await authorizedRetellContext(id);
  if ('error' in authorized)
    return NextResponse.json(
      { error: authorized.error },
      { status: statusFor(authorized.error ?? 'unknown') },
    );
  const { employee, integration, supabase } = authorized;
  const limited = await guardRateLimit(request, {
    action: 'retell.agent.sync', maxRequests: 4, windowSeconds: 900,
    dimensions: [{ kind: 'user', value: authorized.user.id }, { kind: 'company', value: employee.company_id }],
  });
  if (limited) return limited;
  if (!integration.enabled || integration.status !== 'connected')
    return NextResponse.json(
      {
        error: 'retell_connection_not_verified',
        message: 'Primero verifica la conexión privada con Retell.',
      },
      { status: 409 },
    );
  const publicConfig = integration.public_config as Record<string, Json | undefined>;
  let voiceId = typeof publicConfig.voice_id === 'string' ? publicConfig.voice_id.trim() : '';
  const configuredFromNumber =
    typeof publicConfig.from_number === 'string' ? publicConfig.from_number.trim() : '';
  if (configuredFromNumber && !/^\+[1-9]\d{7,14}$/.test(configuredFromNumber))
    return NextResponse.json(
      {
        error: 'retell_phone_configuration_missing',
        message: 'Configura un número de teléfono válido antes de preparar la línea.',
      },
      { status: 409 },
    );
  const appUrl = publicAppUrl(request);
  if (!appUrl)
    return NextResponse.json(
      {
        error: 'public_webhook_url_required',
        message: 'Retell necesita una URL pública HTTPS para devolver el resultado de la llamada.',
      },
      { status: 409 },
    );

  try {
    const [{ admin, adapter }, prompt, { data: zadarma }] = await Promise.all([
      tenantRetellAdapter(integration.id),
      buildReceptionistInstructions(employee.company_id, employee.id),
      supabase.from('company_integrations').select('public_config,status,enabled').eq('company_id', employee.company_id).eq('provider_key', 'zadarma').maybeSingle(),
    ]);
    if (!zadarma || zadarma.status !== 'connected' || !zadarma.enabled) {
      return NextResponse.json({ error: 'zadarma_connection_required', message: 'Conecta y verifica tu cuenta Zadarma antes de preparar la línea.' }, { status: 409 });
    }
    const voices = await adapter.listVoices();
    if ('error' in voices) throw new Error(`${voices.error.code}:${voices.error.message}`);
    if (!voices.data.some((voice) => voice.id === voiceId)) {
      const defaultVoice = voices.data[0];
      if (!defaultVoice)
        return NextResponse.json(
          {
            error: 'retell_voice_unavailable',
            message: 'La cuenta central no tiene una voz disponible en este momento. Inténtalo de nuevo en unos minutos.',
          },
          { status: 502 },
        );
      voiceId = defaultVoice.id;
      const { error: voiceSaveError } = await admin
        .from('company_integrations')
        .update({
          public_config: { ...publicConfig, voice_id: voiceId } as Json,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id)
        .eq('company_id', employee.company_id);
      if (voiceSaveError) throw voiceSaveError;
    }
    const zadarmaConfig = (zadarma.public_config ?? {}) as Record<string, unknown>;
    const { data: current } = await admin
      .from('employee_provider_resources')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('provider_key', 'retell')
      .maybeSingle();
    const zadarmaNumber = typeof zadarmaConfig.from_number === 'string' ? zadarmaConfig.from_number.trim() : '';
    const fromNumber = configuredFromNumber || current?.external_phone_number || zadarmaNumber;
    if (!/^\+[1-9]\d{7,14}$/.test(fromNumber)) return NextResponse.json({ error: 'zadarma_phone_number_required', message: 'Configura un número Zadarma válido en formato internacional.' }, { status: 409 });
    const { data: phoneOwner, error: phoneOwnerError } = await admin
      .from('employee_provider_resources')
      .select('id')
      .eq('provider_key', 'retell')
      .eq('external_phone_number', fromNumber)
      .neq('employee_id', employee.id)
      .maybeSingle();
    if (phoneOwnerError) throw phoneOwnerError;
    if (phoneOwner)
      return NextResponse.json(
        {
          error: 'phone_already_connected',
          message: 'Este número ya está conectado a otra empresa. Usa un número distinto para esta empresa.',
        },
        { status: 409 },
      );
    const hash = configurationHash({
      prompt,
      voiceId,
      fromNumber,
      webhook: `${appUrl}/api/webhooks/retell`,
    });
    if (current?.configuration_hash === hash && current.status === 'ready') {
      const provider = await adapter.getAgent(current.external_agent_id);
      if ('data' in provider)
        return NextResponse.json({ status: 'ready', resource: current, provider: provider.data });
    }

    let knowledgeBaseId = current?.external_knowledge_base_id ?? null;
    if (prompt.knowledge.length && current?.configuration_hash !== hash) {
      const knowledgeResult = await adapter.createKnowledgeBase(
        `${String(prompt.company.name).slice(0, 24)} · ${String(prompt.employee.name).slice(0, 10)}`,
        prompt.knowledge.map((item) => ({ title: item.title, text: item.content })),
      );
      if ('error' in knowledgeResult)
        throw new Error(`${knowledgeResult.error.code}:${knowledgeResult.error.message}`);
      knowledgeBaseId = knowledgeResult.data.knowledgeBaseId;
      const ready = await adapter.waitForKnowledgeBase(knowledgeBaseId);
      if ('error' in ready) throw new Error(`${ready.error.code}:${ready.error.message}`);
    }

    const agentName = `${employee.name} - Recepcionista IA`;
    const configuration = {
      employeeId: employee.id,
      name: agentName,
      instructions: prompt.instructions,
      greeting: Array.isArray(employee.employee_configs)
        ? employee.employee_configs[0]?.greeting
        : employee.employee_configs?.greeting,
      voiceId,
      webhookUrl: `${appUrl}/api/webhooks/retell`,
      knowledgeBaseId,
    };
    const providerAgentId = current?.external_agent_id;
    const responseEngineId = current?.external_response_engine_id;
    const agentVersion = current?.agent_version;
    const result =
      providerAgentId && responseEngineId
        ? await adapter.updateAgent({
            ...configuration,
            providerAgentId,
            responseEngineId,
            agentVersion: agentVersion ?? 0,
          })
        : await adapter.createAgent(configuration);
    if ('error' in result) throw new Error(`${result.error.code}:${result.error.message}`);
    const phoneAssignment = await adapter.assignPhoneNumber(
      fromNumber,
      result.data.providerAgentId,
      result.data.agentVersion,
      `${appUrl}/api/webhooks/retell`,
    );
    if ('error' in phoneAssignment)
      throw new Error(`${phoneAssignment.error.code}:${phoneAssignment.error.message}`);

    const resource = {
      company_id: employee.company_id,
      employee_id: employee.id,
      integration_id: integration.id,
      provider_key: 'retell',
      external_agent_id: result.data.providerAgentId,
      external_response_engine_id: result.data.responseEngineId,
      external_knowledge_base_id: knowledgeBaseId,
      external_phone_number: phoneAssignment.data.phoneNumber,
      agent_version: result.data.agentVersion,
      response_engine_version: result.data.responseEngineVersion,
      status: 'ready',
      configuration_hash: hash,
      last_synced_at: new Date().toISOString(),
      last_error_code: null,
      last_error_message: null,
      updated_at: new Date().toISOString(),
    };
    const { data: stored, error: storeError } = await admin
      .from('employee_provider_resources')
      .upsert(resource, { onConflict: 'employee_id,provider_key' })
      .select()
      .single();
    if (storeError) throw storeError;
    await admin
      .from('employees')
      .update({
        provider_key: 'retell',
        runtime_status: 'active',
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', employee.id);
    await recordOperation({
      companyId: employee.company_id,
      integrationId: integration.id,
      employeeId: employee.id,
      operation: current ? 'retell.agent.update' : 'retell.agent.create',
      status: 'succeeded',
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({ status: 'ready', resource: stored });
  } catch (error) {
    const message = readableErrorMessage(error);
    try {
      await recordOperation({
        companyId: employee.company_id,
        integrationId: integration.id,
        employeeId: employee.id,
        operation: 'retell.agent.sync',
        status: message.includes('timeout') ? 'timeout' : 'failed',
        latencyMs: Date.now() - startedAt,
        errorCode: message.split(':')[0],
        errorMessage: message.slice(0, 500),
      });
    } catch {
      // The original provider error is the actionable failure.
    }
    return NextResponse.json({ error: 'retell_agent_sync_failed', message }, { status: 502 });
  }
}
