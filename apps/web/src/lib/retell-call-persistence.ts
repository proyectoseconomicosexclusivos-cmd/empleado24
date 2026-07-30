import 'server-only';
import { GoogleCalendarAdapter } from '@empleado24/integrations/google-calendar-adapter';
import type { VoiceCallRecord } from '@empleado24/integrations/providers';
import type { Json } from '@empleado24/types';
import { validGoogleAccessToken } from '@/lib/google-calendar-runtime';
import { maskPhone } from '@/lib/retell-runtime';
import { notifyOwner } from '@/lib/owner-notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOpportunityFromReceptionistCall } from '@/lib/sales-runtime';
import { getCustomer, publishEvent, saveMemory } from '@/lib/empleado24-brain';

type UsageRecordClient = {
  rpc: (
    name: 'service_record_billable_usage' | 'service_record_billable_usage_prepaid',
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: string | null; error: { message: string } | null }>;
};

function iso(value: number | undefined) {
  return value === undefined ? null : new Date(value).toISOString();
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function monthPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function googleEventId(callId: string) {
  return `e24${callId.replace(/-/g, '').toLowerCase()}`;
}

async function createAppointmentFromAnalysis(input: {
  companyId: string;
  employeeId: string;
  callId: string;
  analysis: Record<string, unknown>;
}) {
  const custom = object(input.analysis.custom_analysis_data);
  const requested =
    custom.appointment_requested === true || custom.appointment_requested === 'true';
  if (!requested) return;
  const startsAt =
    typeof custom.appointment_start === 'string' ? new Date(custom.appointment_start) : null;
  const duration = Math.round(numberValue(custom.appointment_duration_minutes) ?? 0);
  if (!startsAt || Number.isNaN(startsAt.getTime()) || duration < 5 || duration > 480) return;

  const admin = createAdminClient();
  const { data: integration } = await admin
    .from('company_integrations')
    .select('id,public_config,status,enabled')
    .eq('company_id', input.companyId)
    .eq('provider_key', 'google_calendar')
    .maybeSingle();
  if (!integration?.enabled || integration.status !== 'connected') {
    await admin.from('notifications').insert({
      company_id: input.companyId,
      type: 'appointment_pending_calendar',
      title: 'Tu Recepcionista ha recogido una cita',
      body: 'Conecta Google Calendar para confirmar automáticamente la próxima reserva.',
    });
    return;
  }

  const endsAt = new Date(startsAt.getTime() + duration * 60_000);
  const title =
    typeof custom.appointment_title === 'string' && custom.appointment_title.trim()
      ? custom.appointment_title.trim()
      : 'Cita reservada por tu Recepcionista';
  const eventId = googleEventId(input.callId);
  const reservation = await admin
    .from('calendar_appointments')
    .insert({
      company_id: input.companyId,
      employee_id: input.employeeId,
      call_id: input.callId,
      integration_id: integration.id,
      provider_key: 'google_calendar',
      provider_event_id: eventId,
      title,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      duration_minutes: duration,
      status: 'pending',
    })
    .select('id')
    .single();
  let reservationId = reservation.data?.id;
  if (reservation.error?.code === '23505') {
    const { data: existing } = await admin
      .from('calendar_appointments')
      .select('id,status')
      .eq('call_id', input.callId)
      .single();
    if (!existing || existing.status !== 'error') return;
    const claimed = await admin
      .from('calendar_appointments')
      .update({
        status: 'pending',
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('status', 'error')
      .select('id')
      .maybeSingle();
    if (!claimed.data) return;
    reservationId = claimed.data.id;
  } else if (reservation.error || !reservationId) {
    throw reservation.error ?? new Error('calendar_reservation_failed');
  }

  const started = Date.now();
  try {
    const accessToken = await validGoogleAccessToken(integration.id);
    const config = integration.public_config as { calendar_id?: string };
    const result = await new GoogleCalendarAdapter(
      accessToken,
      config.calendar_id || 'primary',
    ).createAppointment({
      employeeId: input.employeeId,
      startAt: startsAt.toISOString(),
      endAt: endsAt.toISOString(),
      title,
      description: `Reserva recogida por Empleado24 durante la llamada ${input.callId}.`,
      idempotencyKey: eventId,
    });
    if ('error' in result) throw new Error(`${result.error.code}:${result.error.message}`);
    await admin
      .from('calendar_appointments')
      .update({
        provider_event_id: result.data.externalId,
        event_url: result.data.eventUrl,
        status: 'confirmed',
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservationId);
    await Promise.all([
      admin.from('integration_operations').insert({
        company_id: input.companyId,
        integration_id: integration.id,
        employee_id: input.employeeId,
        call_id: input.callId,
        provider_key: 'google_calendar',
        operation: 'calendar.appointment.create',
        status: 'succeeded',
        latency_ms: Date.now() - started,
      }),
      admin.from('activity_logs').insert({
        company_id: input.companyId,
        employee_id: input.employeeId,
        event_type: 'appointment.created',
        payload: {
          call_id: input.callId,
          starts_at: startsAt.toISOString(),
          duration_minutes: duration,
        } as Json,
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'calendar_appointment_failed';
    await Promise.all([
      admin
        .from('calendar_appointments')
        .update({
          status: 'error',
          error_code: message.split(':')[0],
          error_message: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservationId),
      admin.from('integration_operations').insert({
        company_id: input.companyId,
        integration_id: integration.id,
        employee_id: input.employeeId,
        call_id: input.callId,
        provider_key: 'google_calendar',
        operation: 'calendar.appointment.create',
        status: 'failed',
        latency_ms: Date.now() - started,
        error_code: message.split(':')[0],
        error_message: message.slice(0, 500),
      }),
    ]);
    throw error;
  }
}

export async function persistRetellCall(input: {
  companyId: string;
  employeeId: string;
  integrationId: string;
  call: VoiceCallRecord;
  source: 'retell_webhook' | 'retell_reconciler';
}) {
  const admin = createAdminClient();
  const call = input.call;
  if (!call.callId) throw new Error('provider_call_id_missing');
  const combinedCost = numberValue(call.cost?.combined_cost);
  const terminal =
    call.status === 'ended' || call.status === 'not_connected' || call.status === 'error';
  const successful = call.analysis?.call_successful === true;
  const handledWithoutHuman =
    successful && !/transfer/i.test(call.errorCode ?? '') ? (call.durationMs ?? null) : null;
  const now = new Date();
  const values = {
    company_id: input.companyId,
    employee_id: input.employeeId,
    integration_id: input.integrationId,
    provider_key: 'retell',
    provider_call_id: call.callId,
    direction: call.direction ?? 'outbound',
    from_number_masked: call.fromNumber ? maskPhone(call.fromNumber) : null,
    to_number_masked: call.toNumber ? maskPhone(call.toNumber) : null,
    status: call.status,
    started_at: iso(call.startedAt),
    ended_at: iso(call.endedAt),
    duration_ms: call.durationMs,
    handled_without_human_ms: handledWithoutHuman,
    cost_amount_minor: combinedCost === undefined ? null : Math.round(combinedCost),
    cost_currency: combinedCost === undefined ? null : 'USD',
    transcript: call.transcript,
    summary: call.summary,
    error_code: call.errorCode,
    error_message: call.errorMessage,
    latency: (call.latency ?? {}) as Json,
    analysis: (call.analysis ?? {}) as Json,
    provider_cost: (call.cost ?? {}) as Json,
    knowledge_used: Boolean(call.knowledgeEvidenceUrl),
    knowledge_evidence_url: call.knowledgeEvidenceUrl,
    metadata: (call.metadata ?? {}) as Json,
    reconciliation_status: terminal ? 'succeeded' : 'scheduled',
    last_reconciled_at: input.source === 'retell_reconciler' ? now.toISOString() : null,
    next_reconcile_at: new Date(
      now.getTime() + (terminal ? 100 * 365 * 24 * 60 * 60_000 : 2 * 60_000),
    ).toISOString(),
    reconciliation_error_code: null,
    reconciliation_error_message: null,
    updated_at: now.toISOString(),
  };
  const result = await admin
    .from('voice_calls')
    .upsert(values, { onConflict: 'provider_key,provider_call_id' })
    .select()
    .single();
  if (result.error || !result.data) throw result.error ?? new Error('call_persistence_failed');
  const persisted = result.data as { id: string; usage_recorded_at: string | null };

  if (!terminal) {
    const customerPhone = call.direction === 'inbound' ? call.fromNumber : call.toNumber;
    if (customerPhone) {
      const customer = await getCustomer({ companyId: input.companyId, phone: customerPhone, source: 'phone' });
      await publishEvent({
        companyId: input.companyId, customerId: customer.id, employeeId: input.employeeId,
        name: 'CallStarted', source: 'retell', idempotencyKey: `brain:call-start:${call.callId}`,
        payload: { call_id: persisted.id, direction: call.direction ?? null },
      });
    }
  }

  if (terminal && !persisted.usage_recorded_at) {
    const usage = await (admin as unknown as UsageRecordClient).rpc(
      'service_record_billable_usage_prepaid',
      {
        target_company: input.companyId,
        target_employee: input.employeeId,
        target_call: persisted.id,
        target_provider_key: 'retell',
        target_provider_call_id: call.callId,
        target_duration_ms: call.durationMs ?? 0,
        target_currency: 'EUR',
        target_idempotency_key: `retell:${call.callId}:voice_call`,
        target_metadata: {
          source: input.source,
          status: call.status,
          provider_cost_raw: call.cost ?? null,
        } as Json,
      },
    );
    if (usage.error) throw usage.error;
    const marked = await admin
      .from('voice_calls')
      .update({ usage_recorded_at: now.toISOString() })
      .eq('id', persisted.id)
      .is('usage_recorded_at', null)
      .select('id')
      .maybeSingle();
    if (marked.data) {
      const period = monthPeriod(now);
      await Promise.all([
        admin.rpc('service_increment_usage', {
          target_company: input.companyId,
          target_metric: 'voice_calls',
          target_quantity: 1,
          target_period_start: period.start,
          target_period_end: period.end,
        }),
        admin.rpc('service_increment_usage', {
          target_company: input.companyId,
          target_metric: 'voice_seconds',
          target_quantity: Math.ceil((call.durationMs ?? 0) / 1_000),
          target_period_start: period.start,
          target_period_end: period.end,
        }),
        admin.from('activity_logs').insert({
          company_id: input.companyId,
          employee_id: input.employeeId,
          event_type: call.status === 'ended' ? 'call.answered' : 'call.failed',
          payload: {
            call_id: persisted.id,
            direction: call.direction ?? null,
            duration_ms: call.durationMs ?? null,
            status: call.status,
          } as Json,
        }),
      ]);
      void notifyOwner({
        subject: 'Empleado24 · primera llamada',
        message: `La Recepcionista ha atendido una llamada de ${Math.round((call.durationMs ?? 0) / 1000)} segundos.`,
        companyId: input.companyId,
        event: 'call.completed',
      }).catch(() => undefined);
    }
  }
  if (terminal) {
    const customerPhone = call.direction === 'inbound' ? call.fromNumber : call.toNumber;
    const customer = customerPhone ? await getCustomer({
      companyId: input.companyId,
      phone: customerPhone,
      source: 'phone',
    }) : null;
    await Promise.all([createAppointmentFromAnalysis({
      companyId: input.companyId,
      employeeId: input.employeeId,
      callId: persisted.id,
      analysis: call.analysis ?? {},
    }), createOpportunityFromReceptionistCall({
      companyId: input.companyId,
      callId: persisted.id,
      summary: call.summary,
      analysis: call.analysis ?? {},
      fromNumber: call.fromNumber,
    }),
    ...(customer ? [
      saveMemory({
        companyId: input.companyId, customerId: customer.id, employeeId: input.employeeId,
        type: 'summary', content: call.summary || `Llamada ${call.status}.`,
        metadata: { call_id: persisted.id, duration_ms: call.durationMs ?? 0 },
      }),
      publishEvent({
        companyId: input.companyId, customerId: customer.id, employeeId: input.employeeId,
        name: 'CallFinished', source: 'retell', idempotencyKey: `brain:call:${call.callId}`,
        payload: { call_id: persisted.id, status: call.status, duration_ms: call.durationMs ?? 0 },
      }),
    ] : []),
    ]);
  }
  return { id: persisted.id, terminal };
}
