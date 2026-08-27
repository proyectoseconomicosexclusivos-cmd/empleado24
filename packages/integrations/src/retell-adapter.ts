import type {
  ProviderResult,
  VoiceAgentConfiguration,
  VoiceAgentResource,
  VoiceCallRecord,
  VoiceProvider,
} from './providers';
import { resilientFetch } from './resilient-fetch.ts';

const API_URL = 'https://api.retellai.com';

type JsonObject = Record<string, unknown>;

export interface RetellVoiceOption {
  id: string;
  name: string;
  provider: string;
  gender?: string;
  accent?: string;
  previewUrl?: string;
}

export interface RetellPhoneNumberOption {
  providerPhoneId: string;
  number: string;
  label: string;
  type: string;
  inboundAgentIds: string[];
  outboundAgentIds: string[];
}

class RetellHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function errorResult<T>(error: unknown): ProviderResult<T> {
  if (error instanceof RetellHttpError)
    return { error: { code: error.code, message: error.message } };
  if (error instanceof Error && error.name === 'AbortError')
    return { error: { code: 'retell_timeout', message: 'Retell no respondió a tiempo.' } };
  return {
    error: {
      code: 'retell_unavailable',
      message: error instanceof Error ? error.message : 'No se pudo contactar con Retell.',
    },
  };
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length ? value : undefined;
}

function normalizeCall(payload: JsonObject): VoiceCallRecord {
  const analysis = object(payload.call_analysis);
  const latency = object(payload.latency);
  const cost = object(payload.call_cost);
  return {
    callId: String(payload.call_id ?? ''),
    status: (payload.call_status as VoiceCallRecord['status']) ?? 'error',
    direction:
      payload.direction === 'inbound' || payload.direction === 'outbound'
        ? payload.direction
        : undefined,
    fromNumber: stringValue(payload.from_number),
    toNumber: stringValue(payload.to_number),
    agentId: stringValue(payload.agent_id),
    startedAt: numberValue(payload.start_timestamp),
    endedAt: numberValue(payload.end_timestamp),
    durationMs: numberValue(payload.duration_ms),
    transcript: stringValue(payload.transcript),
    summary: stringValue(analysis.call_summary),
    latency,
    analysis,
    cost,
    knowledgeEvidenceUrl: stringValue(payload.knowledge_base_retrieved_contents_url),
    errorCode: stringValue(payload.disconnection_reason),
    errorMessage: stringValue(payload.error_message),
    metadata: object(payload.metadata),
  };
}

export class RetellAdapter implements VoiceProvider {
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, timeoutMs = 12_000) {
    if (!apiKey.trim()) throw new Error('Retell API key is required.');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  private async request<T extends JsonObject | JsonObject[] | undefined>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    try {
      const response = await resilientFetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
        cache: 'no-store',
        timeoutMs: this.timeoutMs,
        maxAttempts: 3,
        breakerKey: 'retell-api',
      });
      if (!response.ok) {
        const body = object(await response.json().catch(() => ({})));
        throw new RetellHttpError(
          response.status,
          `retell_http_${response.status}`,
          stringValue(body.message) ?? 'Retell rechazó la operación.',
        );
      }
      if (response.status === 204) return undefined as T;
      const rawBody = await response.text();
      if (!rawBody.trim()) return undefined as T;
      return JSON.parse(rawBody) as T;
    } catch (error) {
      throw error;
    }
  }

  async testConnection(): Promise<ProviderResult<{ latencyMs: number }>> {
    const startedAt = Date.now();
    try {
      await this.request<JsonObject[]>('/list-agents?limit=1&is_latest=true');
      return { data: { latencyMs: Date.now() - startedAt } };
    } catch (error) {
      return errorResult(error);
    }
  }

  async listVoices(): Promise<ProviderResult<RetellVoiceOption[]>> {
    try {
      const voices = await this.request<JsonObject[]>('/list-voices');
      return {
        data: voices
          .map((voice) => ({
            id: String(voice.voice_id ?? ''),
            name: String(voice.voice_name ?? voice.voice_id ?? ''),
            provider: String(voice.provider ?? ''),
            gender: stringValue(voice.gender),
            accent: stringValue(voice.accent),
            previewUrl: stringValue(voice.preview_audio_url),
          }))
          .filter((voice) => voice.id && voice.name),
      };
    } catch (error) {
      return errorResult(error);
    }
  }

  async listPhoneNumbers(): Promise<ProviderResult<RetellPhoneNumberOption[]>> {
    try {
      const response = await this.request<JsonObject>(
        '/v2/list-phone-numbers?limit=1000&sort_order=ascending',
      );
      const items = Array.isArray(response.items) ? response.items : [];
      return {
        data: items
          .map((raw) => object(raw))
          .map((phone) => {
            const inboundAgents = Array.isArray(phone.inbound_agents)
              ? phone.inbound_agents.map(object)
              : [];
            const outboundAgents = Array.isArray(phone.outbound_agents)
              ? phone.outbound_agents.map(object)
              : [];
            const number = String(phone.phone_number ?? '');
            return {
              providerPhoneId: String(phone.phone_number_id ?? phone.phone_number ?? ''),
              number,
              label: String(phone.phone_number_pretty ?? number),
              type: String(phone.phone_number_type ?? ''),
              inboundAgentIds: inboundAgents
                .map((agent) => String(agent.agent_id ?? ''))
                .filter(Boolean),
              outboundAgentIds: outboundAgents
                .map((agent) => String(agent.agent_id ?? ''))
                .filter(Boolean),
            };
          })
          .filter((phone) => /^\+[1-9]\d{7,14}$/.test(phone.number)),
      };
    } catch (error) {
      return errorResult(error);
    }
  }

  private async createResponseEngine(
    input: VoiceAgentConfiguration,
    version?: number,
  ): Promise<{ responseEngineId: string; responseEngineVersion: number }> {
    const llm = await this.request<JsonObject>('/create-retell-llm', {
      method: 'POST',
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        model_temperature: 0.1,
        start_speaker: 'agent',
        begin_message: input.greeting || undefined,
        general_prompt: input.instructions,
        knowledge_base_ids: input.knowledgeBaseId ? [input.knowledgeBaseId] : undefined,
        general_tools: [
          {
            type: 'end_call',
            name: 'end_call',
            description: 'Finaliza la llamada cuando el cliente se haya despedido.',
          },
        ],
        version,
      }),
    });
    const responseEngineId = String(llm.llm_id ?? '');
    const responseEngineVersion = Number(llm.version ?? 0);
    if (!responseEngineId)
      throw new RetellHttpError(
        502,
        'retell_invalid_response',
        'Retell no devolvió el motor de conversación creado.',
      );
    return { responseEngineId, responseEngineVersion };
  }

  async createAgent(input: VoiceAgentConfiguration): Promise<ProviderResult<VoiceAgentResource>> {
    try {
      const { responseEngineId, responseEngineVersion } = await this.createResponseEngine(input);

      const agent = await this.request<JsonObject>('/create-agent', {
        method: 'POST',
        body: JSON.stringify({
          response_engine: {
            type: 'retell-llm',
            llm_id: responseEngineId,
            version: responseEngineVersion,
          },
          voice_id: input.voiceId,
          agent_name: input.name,
          webhook_url: input.webhookUrl,
          data_storage_setting: 'everything',
          post_call_analysis_model: 'gpt-4.1-mini',
          post_call_analysis_data: appointmentAnalysisFields,
        }),
      });
      const providerAgentId = String(agent.agent_id ?? '');
      const agentVersion = Number(agent.version ?? 0);
      if (!providerAgentId)
        throw new RetellHttpError(
          502,
          'retell_invalid_response',
          'Retell no devolvió el agente creado.',
        );
      await this.publishAgent(providerAgentId, agentVersion);
      return { data: { providerAgentId, responseEngineId, agentVersion, responseEngineVersion } };
    } catch (error) {
      return errorResult(error);
    }
  }

  async updateAgent(
    input: VoiceAgentConfiguration & {
      providerAgentId: string;
      responseEngineId: string;
      agentVersion: number;
    },
  ): Promise<ProviderResult<VoiceAgentResource>> {
    try {
      const currentAgent = await this.request<JsonObject>(
        `/get-agent/${encodeURIComponent(input.providerAgentId)}?version=${input.agentVersion}`,
      );
      let targetAgent = currentAgent;
      if (currentAgent.is_published !== false) {
        targetAgent = await this.request<JsonObject>(
          `/create-agent-version/${encodeURIComponent(input.providerAgentId)}`,
          {
            method: 'POST',
            body: JSON.stringify({ base_version: input.agentVersion }),
          },
        );
      }
      const agentVersion = Number(targetAgent.version);
      if (!Number.isInteger(agentVersion) || agentVersion < 0)
        throw new RetellHttpError(
          502,
          'retell_invalid_response',
          'Retell no devolvió una versión editable del agente.',
        );

      const draftResponseEngine = object(targetAgent.response_engine);
      let responseEngineId = stringValue(draftResponseEngine.llm_id) ?? input.responseEngineId;
      let responseEngineVersion = Number(draftResponseEngine.version ?? agentVersion);
      try {
        const llm = await this.request<JsonObject>(
          `/update-retell-llm/${encodeURIComponent(responseEngineId)}?version=${responseEngineVersion}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              model: 'gpt-4.1-mini',
              model_temperature: 0.1,
              start_speaker: 'agent',
              begin_message: input.greeting || undefined,
              general_prompt: input.instructions,
              knowledge_base_ids: input.knowledgeBaseId ? [input.knowledgeBaseId] : undefined,
              general_tools: [
                {
                  type: 'end_call',
                  name: 'end_call',
                  description: 'Finaliza la llamada cuando el cliente se haya despedido.',
                },
              ],
            }),
          },
        );
        responseEngineVersion = Number(llm.version ?? 0);
      } catch (error) {
        if (
          !(error instanceof RetellHttpError) ||
          error.status !== 400 ||
          !error.message.includes('Cannot update published LLM')
        )
          throw error;
        ({ responseEngineId, responseEngineVersion } = await this.createResponseEngine(
          input,
          agentVersion,
        ));
      }
      if (responseEngineVersion !== agentVersion) {
        ({ responseEngineId, responseEngineVersion } = await this.createResponseEngine(
          input,
          agentVersion,
        ));
      }
      const agentConfiguration = {
        response_engine: {
          type: 'retell-llm',
          llm_id: responseEngineId,
          version: responseEngineVersion,
        },
        voice_id: input.voiceId,
        agent_name: input.name,
        webhook_url: input.webhookUrl,
        webhook_events: ['call_started', 'call_ended', 'call_analyzed'],
        language: 'es-ES',
        timezone: 'Europe/Madrid',
        data_storage_setting: 'everything',
        post_call_analysis_model: 'gpt-4.1-mini',
        post_call_analysis_data: appointmentAnalysisFields,
      };
      const agent = await this.request<JsonObject>(
        `/update-agent/${encodeURIComponent(input.providerAgentId)}?version=${agentVersion}`,
        {
          method: 'PATCH',
          body: JSON.stringify(agentConfiguration),
        },
      );
      const updatedAgentVersion = Number(agent.version ?? agentVersion);
      await this.publishAgent(input.providerAgentId, updatedAgentVersion);
      return {
        data: {
          providerAgentId: input.providerAgentId,
          responseEngineId,
          agentVersion: updatedAgentVersion,
          responseEngineVersion,
        },
      };
    } catch (error) {
      return errorResult(error);
    }
  }

  async getAgent(providerAgentId: string): Promise<ProviderResult<Record<string, unknown>>> {
    try {
      return {
        data: await this.request<JsonObject>(`/get-agent/${encodeURIComponent(providerAgentId)}`),
      };
    } catch (error) {
      return errorResult(error);
    }
  }

  async deleteAgent(providerAgentId: string): Promise<ProviderResult<void>> {
    try {
      await this.request<undefined>(`/delete-agent/${encodeURIComponent(providerAgentId)}`, {
        method: 'DELETE',
      });
      return { data: undefined };
    } catch (error) {
      return errorResult(error);
    }
  }

  async placeTestCall(input: {
    providerAgentId: string;
    from: string;
    to: string;
    metadata: Record<string, string>;
  }): Promise<ProviderResult<{ callId: string; status: string }>> {
    try {
      const call = await this.request<JsonObject>('/v2/create-phone-call', {
        method: 'POST',
        body: JSON.stringify({
          from_number: input.from,
          to_number: input.to,
          override_agent_id: input.providerAgentId,
          ignore_e164_validation: !input.from.startsWith('+'),
          metadata: input.metadata,
        }),
      });
      const callId = String(call.call_id ?? '');
      if (!callId)
        throw new RetellHttpError(
          502,
          'retell_invalid_response',
          'Retell no devolvió el identificador de llamada.',
        );
      return { data: { callId, status: String(call.call_status ?? 'registered') } };
    } catch (error) {
      return errorResult(error);
    }
  }

  async createKnowledgeBase(
    name: string,
    items: Array<{ title: string; text: string }>,
  ): Promise<ProviderResult<{ knowledgeBaseId: string; status: string }>> {
    try {
      const body = new FormData();
      body.set('knowledge_base_name', name.slice(0, 39));
      body.set('knowledge_base_texts', JSON.stringify(items));
      const knowledgeBase = await this.request<JsonObject>('/create-knowledge-base', {
        method: 'POST',
        body,
      });
      const knowledgeBaseId = String(knowledgeBase.knowledge_base_id ?? '');
      if (!knowledgeBaseId)
        throw new RetellHttpError(
          502,
          'retell_invalid_response',
          'Retell no devolvió la base de conocimiento creada.',
        );
      return { data: { knowledgeBaseId, status: String(knowledgeBase.status ?? 'in_progress') } };
    } catch (error) {
      return errorResult(error);
    }
  }

  async waitForKnowledgeBase(
    knowledgeBaseId: string,
    timeoutMs = 30_000,
  ): Promise<ProviderResult<{ status: string }>> {
    const deadline = Date.now() + timeoutMs;
    try {
      while (Date.now() < deadline) {
        const knowledgeBase = await this.request<JsonObject>(
          `/get-knowledge-base/${encodeURIComponent(knowledgeBaseId)}`,
        );
        const status = String(knowledgeBase.status ?? 'error');
        if (status === 'complete') return { data: { status } };
        if (status === 'error')
          return {
            error: {
              code: 'retell_knowledge_base_error',
              message: 'Retell no pudo procesar la base de conocimiento.',
            },
          };
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
      return {
        error: {
          code: 'retell_knowledge_base_timeout',
          message: 'La base de conocimiento sigue procesándose en Retell.',
        },
      };
    } catch (error) {
      return errorResult(error);
    }
  }

  async assignPhoneNumber(
    phoneNumber: string,
    agentId: string,
    agentVersion: number,
    inboundWebhookUrl: string,
  ): Promise<ProviderResult<{ phoneNumber: string }>> {
    const candidates = [
      phoneNumber,
      ...(phoneNumber.startsWith('+') ? [phoneNumber.slice(1)] : []),
    ];
    for (const candidate of candidates) {
      try {
        await this.request<JsonObject | undefined>(
          `/update-phone-number/${encodeURIComponent(candidate)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              inbound_agents: [{ agent_id: agentId, agent_version: agentVersion, weight: 1 }],
              outbound_agents: [{ agent_id: agentId, agent_version: agentVersion, weight: 1 }],
              inbound_webhook_url: inboundWebhookUrl,
            }),
          },
        );
        return {
          data: { phoneNumber: phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}` },
        };
      } catch (error) {
        if (
          error instanceof RetellHttpError &&
          error.status === 404 &&
          candidate !== candidates[candidates.length - 1]
        )
          continue;
        return errorResult(error);
      }
    }
    return {
      error: {
        code: 'retell_phone_not_found',
        message: 'Retell no reconoce el número asignado a la Recepcionista.',
      },
    };
  }

  async getCall(callId: string): Promise<ProviderResult<VoiceCallRecord>> {
    try {
      return {
        data: normalizeCall(
          await this.request<JsonObject>(`/v2/get-call/${encodeURIComponent(callId)}`),
        ),
      };
    } catch (error) {
      return errorResult(error);
    }
  }

  async parseWebhook(
    rawBody: string,
    signature: string | undefined,
  ): Promise<ProviderResult<{ event: string; externalId: string; call: Record<string, unknown> }>> {
    if (!(await this.verifyWebhookSignature(rawBody, signature)))
      return { error: { code: 'invalid_signature', message: 'Firma de Retell no válida.' } };
    try {
      const payload = object(JSON.parse(rawBody));
      const call = object(payload.call);
      const externalId = String(call.call_id ?? '');
      const event = String(payload.event ?? '');
      if (!externalId || !event)
        return { error: { code: 'invalid_webhook', message: 'Webhook de Retell incompleto.' } };
      return { data: { event, externalId, call } };
    } catch {
      return { error: { code: 'invalid_json', message: 'Webhook de Retell no válido.' } };
    }
  }

  async verifyWebhookSignature(rawBody: string, signature: string | undefined): Promise<boolean> {
    return this.verifySignature(rawBody, signature);
  }

  private async publishAgent(agentId: string, version: number): Promise<void> {
    await this.request<JsonObject>(`/publish-agent-version/${encodeURIComponent(agentId)}`, {
      method: 'POST',
      body: JSON.stringify({
        version,
        version_title: 'Empleado24',
        version_description: 'Configuración sincronizada desde Empleado24.',
      }),
    });
  }

  private async verifySignature(rawBody: string, signature: string | undefined): Promise<boolean> {
    if (!signature) return false;
    const parts = Object.fromEntries(signature.split(',').map((part) => part.trim().split('=', 2)));
    const timestamp = Number(parts.v);
    const received = parts.d;
    if (!received || !Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 300_000)
      return false;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.apiKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const digest = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(rawBody + timestamp),
    );
    const expected = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    if (expected.length !== received.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1)
      difference |= expected.charCodeAt(index) ^ received.charCodeAt(index);
    return difference === 0;
  }
}

const appointmentAnalysisFields = [
  {
    type: 'boolean',
    name: 'appointment_requested',
    description: 'Indica si el cliente confirmó que quiere reservar una cita.',
    required: false,
  },
  {
    type: 'string',
    name: 'appointment_start',
    description: 'Fecha y hora confirmadas para la cita en formato ISO 8601 con zona horaria.',
    required: false,
  },
  {
    type: 'number',
    name: 'appointment_duration_minutes',
    description: 'Duración confirmada de la cita en minutos.',
    required: false,
  },
  {
    type: 'string',
    name: 'appointment_title',
    description: 'Motivo breve de la cita.',
    required: false,
  },
  {
    type: 'string',
    name: 'customer_name',
    description: 'Nombre del cliente que solicita la cita.',
    required: false,
  },
  {
    type: 'string',
    name: 'customer_email',
    description: 'Email del cliente si lo ha proporcionado.',
    required: false,
  },
  {
    type: 'boolean',
    name: 'potential_customer',
    description: 'Indica si la persona mostró una necesidad real que podría convertirse en venta.',
    required: false,
  },
  {
    type: 'string',
    name: 'sales_interest_level',
    description: 'Nivel de interés comercial: cold, interested, hot o very_hot.',
    required: false,
  },
  {
    type: 'number',
    name: 'estimated_value_eur',
    description: 'Valor aproximado en euros si se habló de un importe.',
    required: false,
  },
  {
    type: 'string',
    name: 'next_sales_action',
    description: 'Siguiente paso comercial acordado con el cliente.',
    required: false,
  },
  {
    type: 'string',
    name: 'company_sector',
    description: 'Sector de la empresa mencionado por la persona, si lo ha indicado.',
    required: false,
  },
  {
    type: 'string',
    name: 'company_size',
    description: 'Tamaño aproximado de empresa indicado por la persona.',
    required: false,
  },
  {
    type: 'string',
    name: 'primary_problem',
    description: 'Problema principal expresado: llamadas, atención al cliente, presupuestos, administración, ventas, agenda, tareas repetitivas u otro.',
    required: false,
  },
  {
    type: 'string',
    name: 'recommended_employee',
    description: 'Empleado o equipo recomendado durante la conversación, únicamente si se llegó a recomendar uno.',
    required: false,
  },
  {
    type: 'string',
    name: 'commercial_intent',
    description: 'Clasificación: curioso, interesado, muy_interesado, listo_para_probar, cliente, no_interesado o no_determinado.',
    required: false,
  },
  {
    type: 'string',
    name: 'commercial_objection',
    description: 'Objeción expresada por la persona, si existe.',
    required: false,
  },
  {
    type: 'boolean',
    name: 'follow_up_consent',
    description: 'Verdadero sólo si la persona autorizó expresamente contacto posterior.',
    required: false,
  },
];
