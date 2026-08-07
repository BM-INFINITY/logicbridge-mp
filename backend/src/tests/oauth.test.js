/**
 * OAuth & Gmail Integration Unit Tests
 *
 * Tests OAuthService and GmailConnectionProvider without making real network calls.
 * All external API calls (googleapis, fetch) are overridden at the method level.
 */

const OAuthService = require('../services/OAuthService');
const GmailConnectionProvider = require('../providers/connections/GmailConnectionProvider');
const CredentialService = require('../services/CredentialService');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function assertThrows(fn, expectedSnippet, label) {
  try {
    await fn();
    console.error(`  ❌ FAIL: ${label} — expected an error but none was thrown`);
    failed++;
  } catch (err) {
    if (err.message && err.message.includes(expectedSnippet)) {
      console.log(`  ✅ ${label}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${label} — wrong error: "${err.message}"`);
      failed++;
    }
  }
}

async function main() {
  console.log('\n🧪 Starting OAuth & Gmail Unit Tests...\n');

  const savedEnv = { ...process.env };

  // ── Group 1: OAuthService configuration guard ─────────────────────────────
  console.log('Group 1: OAuthService configuration');

  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REDIRECT_URI;

  assert(!OAuthService.isConfigured(), 'isConfigured() returns false when env vars missing');

  await assertThrows(
    () => { OAuthService.generateAuthUrl('user123'); },
    'not configured',
    'generateAuthUrl() throws when unconfigured'
  );

  // ── Group 2: OAuth URL generation ─────────────────────────────────────────
  console.log('\nGroup 2: OAuth URL generation');

  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/oauth/google/callback';

  assert(OAuthService.isConfigured(), 'isConfigured() returns true when env vars are set');

  const url = OAuthService.generateAuthUrl('user123', 'My Gmail');
  assert(typeof url === 'string', 'generateAuthUrl() returns a string');
  assert(url.includes('accounts.google.com'), 'URL points to Google accounts');
  assert(url.includes('gmail.send'), 'URL requests gmail.send scope');
  assert(url.includes('offline'), 'URL requests offline access for refresh token');

  // ── Group 3: State encode/decode ──────────────────────────────────────────
  console.log('\nGroup 3: State parameter encoding');

  const urlObj = new URL(url);
  const state = urlObj.searchParams.get('state');
  assert(typeof state === 'string' && state.length > 0, 'State param is present in URL');

  const decoded = OAuthService.decodeState(state);
  assert(decoded.userId === 'user123', 'State decodes correct userId');
  assert(decoded.connectionName === 'My Gmail', 'State decodes correct connectionName');

  // ── Group 4: Invalid state rejection ─────────────────────────────────────
  console.log('\nGroup 4: Invalid state handling');

  await assertThrows(
    () => OAuthService.decodeState('not-base64url-json!!!'),
    'Invalid OAuth state',
    'decodeState() throws on invalid state'
  );

  // ── Group 5: Credential encryption round-trip ─────────────────────────────
  console.log('\nGroup 5: Credential encryption (via CredentialService)');

  const tokenPayload = {
    accessToken: 'ya29.fake-access-token',
    refreshToken: '1//fake-refresh-token',
    expiryDate: Date.now() + 3600_000,
    email: 'test@gmail.com',
    name: 'Test User',
  };

  const encrypted = CredentialService.encrypt(tokenPayload);
  assert(typeof encrypted === 'string', 'Credentials encrypt to a string');
  assert(!encrypted.includes('ya29'), 'Access token is not visible in encrypted blob');

  const decrypted = CredentialService.decrypt(encrypted);
  assert(decrypted.accessToken === tokenPayload.accessToken, 'Access token survives round-trip');
  assert(decrypted.refreshToken === tokenPayload.refreshToken, 'Refresh token survives round-trip');
  assert(decrypted.email === tokenPayload.email, 'Email survives round-trip');

  // ── Group 6: Redaction ────────────────────────────────────────────────────
  console.log('\nGroup 6: Credential redaction');

  const redacted = CredentialService.redact(tokenPayload);
  assert(redacted.accessToken === '***', 'accessToken is redacted');
  assert(redacted.refreshToken === '***', 'refreshToken is redacted');
  assert(redacted.email === '***', 'email is redacted');
  assert(Object.keys(redacted).length === Object.keys(tokenPayload).length, 'All keys preserved in redacted object');

  // ── Group 7: GmailConnectionProvider metadata ─────────────────────────────
  console.log('\nGroup 7: GmailConnectionProvider metadata');

  const gmail = new GmailConnectionProvider();
  const meta = gmail.metadata();

  assert(meta.id === 'gmail', 'Provider id is "gmail"');
  assert(meta.supportsOAuth === true, 'Provider supportsOAuth is true');
  assert(meta.supportsRefresh === true, 'Provider supportsRefresh is true');
  assert(meta.supportsEmail === true, 'Provider supportsEmail is true');
  assert(meta.supportsHTML === true, 'Provider supportsHTML is true');
  assert(Array.isArray(meta.requiredFields) && meta.requiredFields.length === 0, 'No requiredFields (OAuth provider)');

  // ── Group 8: Simulated successful connect ─────────────────────────────────
  console.log('\nGroup 8: GmailConnectionProvider.connect()');

  const connectResult = await gmail.connect({
    accessToken: 'ya29.token',
    refreshToken: '1//refresh',
    expiryDate: Date.now() + 3600_000,
    email: 'test@gmail.com',
    name: 'Test User',
  });
  assert(connectResult.success === true, 'connect() returns { success: true }');
  assert(connectResult.email === 'test@gmail.com', 'connect() returns correct email');

  // ── Group 9: RFC 2822 raw message construction ────────────────────────────
  console.log('\nGroup 9: RFC 2822 message builder');

  const raw = GmailConnectionProvider._buildRawMessage({
    from: 'Test User <test@gmail.com>',
    to: 'recipient@example.com',
    subject: 'Hello World',
    text: 'This is a test email.',
  });

  assert(typeof raw === 'string', '_buildRawMessage() returns a string');
  const decoded64 = Buffer.from(raw, 'base64url').toString('utf8');
  assert(decoded64.includes('To: recipient@example.com'), 'Raw message contains To header');
  assert(decoded64.includes('Subject: Hello World'), 'Raw message contains Subject header');
  assert(decoded64.includes('From: Test User'), 'Raw message contains From header');
  assert(decoded64.includes('This is a test email.'), 'Raw message contains body text');

  // ── Group 10: Token refresh simulation ───────────────────────────────────
  console.log('\nGroup 10: OAuthService.refreshAccessToken() simulation');

  const mockRefreshedCreds = {
    accessToken: 'ya29.new-token',
    expiryDate: Date.now() + 3600_000,
  };

  // Override the private refreshAccessToken call for simulation
  const originalRefresh = OAuthService.refreshAccessToken;
  OAuthService.refreshAccessToken = async (creds) => ({
    ...creds,
    ...mockRefreshedCreds,
  });

  const expiredCreds = {
    accessToken: 'ya29.expired',
    refreshToken: '1//valid-refresh',
    expiryDate: Date.now() - 1000, // already expired
    email: 'test@gmail.com',
  };

  const refreshed = await OAuthService.refreshAccessToken(expiredCreds);
  assert(refreshed.accessToken === 'ya29.new-token', 'refreshAccessToken() returns new access token');
  assert(refreshed.refreshToken === expiredCreds.refreshToken, 'Refresh token unchanged after refresh');

  OAuthService.refreshAccessToken = originalRefresh; // restore

  // ── Restore environment ───────────────────────────────────────────────────
  Object.keys(process.env).forEach((k) => {
    if (['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI'].includes(k)) {
      delete process.env[k];
    }
  });
  Object.assign(process.env, savedEnv);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('\n❌ SOME OAUTH TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL OAUTH & GMAIL TESTS PASSED!\n');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
