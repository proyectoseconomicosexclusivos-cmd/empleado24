import test from 'node:test';
import assert from 'node:assert/strict';
import { testProviderConnection } from './connection-health.ts';

test('expired credentials never call the provider', async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response('{}');
  };
  const result = await testProviderConnection({
    providerKey: 'google_calendar',
    authMethod: 'oauth2',
    credentials: { access_token: 'secret' },
    publicConfig: {},
    credentialExpiresAt: '2020-01-01T00:00:00.000Z',
  });
  assert.equal(result.status, 'expired');
  assert.equal(called, false);
});

test('Retell API key produces a successful health result', async () => {
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer tenant-secret');
    return new Response('[]', { status: 200 });
  };
  const result = await testProviderConnection({
    providerKey: 'retell',
    authMethod: 'api_key',
    credentials: { api_key: 'tenant-secret' },
    publicConfig: {},
  });
  assert.equal(result.status, 'connected');
  assert.equal(result.details.httpStatus, 200);
});

test('Zadarma uses its documented hexadecimal-HMAC signature format', async () => {
  globalThis.fetch = async (_url, init) => {
    assert.equal(
      init.headers.Authorization,
      'tenant-key:OGJiZTk1NDA5MTU0N2M0NmU5Njc1MzNlY2QxMDg2MTk2MTVmNzI4Ng==',
    );
    return new Response('{"status":"success","balance":10}', { status: 200 });
  };
  const result = await testProviderConnection({
    providerKey: 'zadarma',
    authMethod: 'api_key',
    credentials: { api_key: 'tenant-key', api_secret: 'customer-secret' },
    publicConfig: {},
  });
  assert.equal(result.status, 'connected');
});

test('OAuth 401 is classified as expired', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  const result = await testProviderConnection({
    providerKey: 'google_calendar',
    authMethod: 'oauth2',
    credentials: { access_token: 'expired-token' },
    publicConfig: {},
  });
  assert.equal(result.status, 'expired');
  assert.equal(result.code, 'oauth_token_expired');
});

test('incomplete WhatsApp configuration remains pending', async () => {
  const result = await testProviderConnection({
    providerKey: 'whatsapp_meta',
    authMethod: 'oauth2',
    credentials: { access_token: 'secret' },
    publicConfig: {},
  });
  assert.equal(result.status, 'pending');
});
