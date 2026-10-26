import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ClientAuthentication, OAuth2Client } from 'google-auth-library';

describe('OAuth Desktop público', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (!server?.listening) return;
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => error ? reject(error) : resolve());
    });
    server = undefined;
  });

  it('canjea código y renueva tokens sin enviar client_secret', async () => {
    const requests: URLSearchParams[] = [];
    server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        requests.push(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ access_token: 'access-test', token_type: 'Bearer', expires_in: 3600 }));
      });
    });
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject);
      server!.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address() as AddressInfo;
    const redirectUri = 'http://127.0.0.1:48921/oauth2callback';
    const client = new OAuth2Client({
      clientId: 'desktop-client-id',
      redirectUri,
      clientAuthentication: ClientAuthentication.None,
      endpoints: { oauth2TokenUrl: `http://127.0.0.1:${address.port}/token` }
    });

    await client.getToken({ code: 'authorization-code', codeVerifier: 'pkce-verifier', redirect_uri: redirectUri });
    client.setCredentials({ refresh_token: 'refresh-test' });
    await client.getAccessToken();

    expect(requests).toHaveLength(2);
    expect(requests[0]?.get('client_id')).toBe('desktop-client-id');
    expect(requests[0]?.get('code_verifier')).toBe('pkce-verifier');
    expect(requests[0]?.has('client_secret')).toBe(false);
    expect(requests[1]?.get('client_id')).toBe('desktop-client-id');
    expect(requests[1]?.get('refresh_token')).toBe('refresh-test');
    expect(requests[1]?.has('client_secret')).toBe(false);
  });
});
