import { resilientFetch } from './resilient-fetch.ts';
export type IntegrationHealthState = 'connected' | 'error' | 'pending' | 'expired';
export type IntegrationAuthMethod = 'oauth2' | 'api_key';
export type IntegrationCredentials = Record<string, string | undefined>;
export type IntegrationPublicConfig = Record<string, unknown>;

export interface ConnectionTestInput {
  providerKey: string;
  authMethod: IntegrationAuthMethod;
  credentials: IntegrationCredentials;
  publicConfig: IntegrationPublicConfig;
  credentialExpiresAt?: string | null;
  timeoutMs?: number;
}

export interface ConnectionTestResult {
  status: IntegrationHealthState;
  code: string;
  message: string;
  latencyMs: number;
  details: Record<string, string | number | boolean>;
}

interface Probe {
  url: string;
  headers: Record<string, string>;
}

async function zadarmaSignature(secret: string, path: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${path}d41d8cd98f00b204e9800998ecf8427e`));
  // Zadarma's documented PHP example base64-encodes the hexadecimal HMAC
  // string, rather than the raw HMAC bytes.
  const hexadecimalDigest = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return btoa(hexadecimalDigest);
}

const required = (credentials: IntegrationCredentials, key: string): string => {
  const value = credentials[key]?.trim();
  if (!value) throw new Error(`missing:${key}`);
  return value;
};

const bearer = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` });

const buildProbe = async (input: ConnectionTestInput): Promise<Probe> => {
  switch (input.providerKey) {
    case 'retell':
      return {
        url: 'https://api.retellai.com/list-agents?limit=1&is_latest=true',
        headers: bearer(required(input.credentials, 'api_key')),
      };
    case 'zadarma': {
      const key = required(input.credentials, 'api_key');
      const secret = required(input.credentials, 'api_secret');
      const path = '/v1/info/balance/';
      return { url: `https://api.zadarma.com${path}`, headers: { Authorization: `${key}:${await zadarmaSignature(secret, path)}` } };
    }
    case 'google_calendar':
      return {
        url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1',
        headers: bearer(required(input.credentials, 'access_token')),
      };
    case 'brevo': {
      const headers =
        input.authMethod === 'oauth2'
          ? bearer(required(input.credentials, 'access_token'))
          : { 'api-key': required(input.credentials, 'api_key') };
      return { url: 'https://api.brevo.com/v3/account', headers };
    }
    case 'whatsapp_meta': {
      const version = String(input.publicConfig.graph_api_version ?? '');
      const wabaId = String(input.publicConfig.waba_id ?? '');
      if (!/^v\d+\.\d+$/.test(version) || !/^\d+$/.test(wabaId)) throw new Error('missing:whatsapp_config');
      return {
        url: `https://graph.facebook.com/${version}/${wabaId}/phone_numbers?limit=1`,
        headers: bearer(required(input.credentials, 'access_token')),
      };
    }
    case 'twilio': {
      const accountSid = required(input.credentials, 'account_sid');
      const authToken = required(input.credentials, 'auth_token');
      return {
        url: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`,
        headers: { Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}` },
      };
    }
    case 'telnyx':
      return {
        url: 'https://api.telnyx.com/v2/balance',
        headers: bearer(required(input.credentials, input.authMethod === 'oauth2' ? 'access_token' : 'api_key')),
      };
    default:
      throw new Error('unsupported:provider');
  }
};

export async function testProviderConnection(input: ConnectionTestInput): Promise<ConnectionTestResult> {
  const startedAt = Date.now();
  const expiresAt = input.credentialExpiresAt ? Date.parse(input.credentialExpiresAt) : Number.NaN;
  if (Number.isFinite(expiresAt) && expiresAt <= startedAt) {
    return {
      status: 'expired',
      code: 'credential_expired',
      message: 'Las credenciales han expirado.',
      latencyMs: 0,
      details: {},
    };
  }

  let probe: Probe;
  try {
    probe = await buildProbe(input);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_configuration';
    return {
      status: code.startsWith('missing:') ? 'pending' : 'error',
      code,
      message: code.startsWith('missing:') ? 'Faltan credenciales o configuración.' : 'Proveedor no soportado.',
      latencyMs: Date.now() - startedAt,
      details: {},
    };
  }

  try {
    const response = await resilientFetch(probe.url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...probe.headers },
      cache: 'no-store',
      timeoutMs: input.timeoutMs ?? 8_000,
      maxAttempts: 3,
      breakerKey: `connection-health:${input.providerKey}`,
    });
    const latencyMs = Date.now() - startedAt;
    if (response.ok) {
      return {
        status: 'connected',
        code: 'connection_ok',
        message: 'Conexión verificada.',
        latencyMs,
        details: { httpStatus: response.status },
      };
    }
    const expired = response.status === 401 && input.authMethod === 'oauth2';
    return {
      status: expired ? 'expired' : 'error',
      code: expired ? 'oauth_token_expired' : `provider_http_${response.status}`,
      message: expired ? 'La autorización OAuth ha expirado.' : 'El proveedor rechazó la conexión.',
      latencyMs,
      details: { httpStatus: response.status },
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return {
      status: 'error',
      code: timedOut ? 'connection_timeout' : 'provider_unreachable',
      message: timedOut ? 'El proveedor no respondió a tiempo.' : 'No se pudo contactar con el proveedor.',
      latencyMs: Date.now() - startedAt,
      details: {},
    };
  }
}
