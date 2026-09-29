/**
 * Google Sheets Connection & OAuth Unit Tests
 * Covers:
 *   - Provider registration in ConnectionRegistry
 *   - OAuth configuration, scopes, authorization URL, state encoding/decoding
 *   - Token refresh handling
 *   - Credential encryption, decryption, and secret redaction
 */

const assert = require('assert');
const { connectionRegistry } = require('../providers/connections/ConnectionRegistry');
const GoogleSheetsConnectionProvider = require('../providers/connections/GoogleSheetsConnectionProvider');
const OAuthService = require('../services/OAuthService');
const CredentialService = require('../services/CredentialService');
const { redactSecrets } = require('../utils/SecretRedactor');

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Starting Google Sheets Connection & OAuth Tests...\n');

  // Set mock OAuth credentials for testing environment
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'mock-google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'mock-google-client-secret';
  process.env.GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/oauth/google/callback';

  // ── 1. Provider Registration ──────────────────────────────────────────────
  console.log('Test Group 1: Provider Registration');

  const provider = connectionRegistry.resolve('google_sheets');
  check(Boolean(provider), 'ConnectionRegistry: google_sheets provider is registered');
  check(provider.id === 'google_sheets', 'ConnectionRegistry: provider ID is google_sheets');
  check(provider.name === 'Google Sheets', 'ConnectionRegistry: provider name is Google Sheets');
  check(provider.supportsOAuth === true, 'ConnectionRegistry: supportsOAuth is true');
  check(Array.isArray(provider.requiredFields) && provider.requiredFields.length === 0, 'ConnectionRegistry: requiredFields is empty array for pure OAuth');

  const aliasProvider = connectionRegistry.resolve('google-sheets');
  check(Boolean(aliasProvider), 'ConnectionRegistry: google-sheets hyphenated alias resolves');
  check(aliasProvider.id === 'google_sheets', 'ConnectionRegistry: hyphenated alias maps to google_sheets provider');

  // Check provider instance methods
  const gsProviderInstance = new GoogleSheetsConnectionProvider();
  check(typeof gsProviderInstance.verifyCredentials === 'function', 'GoogleSheetsConnectionProvider: has verifyCredentials');
  check(typeof gsProviderInstance.refreshToken === 'function', 'GoogleSheetsConnectionProvider: has refreshToken');
  check(typeof gsProviderInstance.disconnect === 'function', 'GoogleSheetsConnectionProvider: has disconnect');

  // ── 2. OAuth Configuration & Scopes ───────────────────────────────────────
  console.log('Test Group 2: OAuth Configuration & Scopes');

  check(Boolean(OAuthService.PROVIDER_SCOPES.google_sheets), 'OAuthService: has PROVIDER_SCOPES.google_sheets');
  const scopes = OAuthService.PROVIDER_SCOPES.google_sheets;
  check(scopes.includes('https://www.googleapis.com/auth/spreadsheets'), 'OAuthService: includes spreadsheets scope');
  check(scopes.includes('https://www.googleapis.com/auth/drive.file'), 'OAuthService: includes drive.file scope');
  check(scopes.includes('email') && scopes.includes('profile'), 'OAuthService: includes profile and email scopes');

  // Generate auth URL
  const authUrl = OAuthService.generateAuthUrl('user_123', 'My Sheet Connection', 'google_sheets');
  check(typeof authUrl === 'string' && authUrl.startsWith('https://accounts.google.com/o/oauth2/v2/auth'), 'OAuthService: generates Google OAuth 2.0 URL');
  check(authUrl.includes('access_type=offline'), 'OAuthService: sets access_type=offline for refresh tokens');
  check(authUrl.includes('prompt=consent'), 'OAuthService: sets prompt=consent');
  check(authUrl.includes(encodeURIComponent('https://www.googleapis.com/auth/spreadsheets')), 'OAuthService: URL includes encoded spreadsheets scope');

  // State decoding
  const urlParsed = new URL(authUrl);
  const state = urlParsed.searchParams.get('state');
  const decodedState = OAuthService.decodeState(state);
  check(decodedState.connectionName === 'My Sheet Connection', 'OAuthService: state preserves connectionName');
  check(decodedState.userId === 'user_123', 'OAuthService: state preserves userId');
  check(decodedState.provider === 'google_sheets', 'OAuthService: state preserves provider: google_sheets');

  // ── 3. Token Refresh & Verification ───────────────────────────────────────
  console.log('Test Group 3: Token Refresh & Verification');

  // Verify credentials without access token rejects
  const invalidCredsRes = await gsProviderInstance.verifyCredentials({});
  check(invalidCredsRes.valid === false, 'GoogleSheetsConnectionProvider: rejects empty credentials');

  // Mock verifyCredentials for valid credentials test
  const originalVerify = OAuthService.verifyCredentials;
  OAuthService.verifyCredentials = async (credentials, provider) => {
    if (!credentials?.access_token && !credentials?.accessToken) {
      return { ok: false, valid: false, message: 'Missing token' };
    }
    return { ok: true, valid: true, email: 'sheets-user@example.com', message: 'Google Sheets verified' };
  };

  try {
    const validCredsRes = await gsProviderInstance.verifyCredentials({ access_token: 'valid_test_token' });
    check(validCredsRes.valid === true, 'GoogleSheetsConnectionProvider: accepts credentials with access_token');
  } finally {
    OAuthService.verifyCredentials = originalVerify;
  }

  // Mock token refresh
  const originalRefresh = OAuthService.refreshAccessToken;
  OAuthService.refreshAccessToken = async (credentials) => {
    const rToken = credentials.refreshToken || credentials.refresh_token;
    check(rToken === 'refresh-123', 'OAuthService: refreshAccessToken called with correct refreshToken');
    return {
      access_token: 'new-access-token-456',
      refresh_token: rToken,
      expiry_date: Date.now() + 3600000,
    };
  };

  try {
    const refreshed = await gsProviderInstance.refreshToken({ refresh_token: 'refresh-123', access_token: 'old-token' });
    check(refreshed.access_token === 'new-access-token-456', 'GoogleSheetsConnectionProvider: refreshToken returns updated access_token');
  } finally {
    OAuthService.refreshAccessToken = originalRefresh;
  }

  // ── 4. Credential Encryption & Redaction ──────────────────────────────────
  console.log('Test Group 4: Credential Encryption & Redaction');

  const rawTokens = {
    access_token: 'ya29.a0AfH6_SECRET_ACCESS_TOKEN_12345',
    refresh_token: '1//0gSECRET_REFRESH_TOKEN_67890',
    id_token: 'secret-id-token',
    token_type: 'Bearer',
    expiry_date: 1800000000000,
  };

  // Encrypt via CredentialService
  const encrypted = CredentialService.encrypt(rawTokens);
  check(typeof encrypted === 'string', 'CredentialService: encrypted payload is a string');
  check(!encrypted.includes('SECRET_ACCESS_TOKEN'), 'CredentialService: ciphertext does not contain access token plaintext');
  check(!encrypted.includes('SECRET_REFRESH_TOKEN'), 'CredentialService: ciphertext does not contain refresh token plaintext');

  // Decrypt via CredentialService
  const decrypted = CredentialService.decrypt(encrypted);
  check(decrypted.access_token === rawTokens.access_token, 'CredentialService: decrypt returns identical access token');
  check(decrypted.refresh_token === rawTokens.refresh_token, 'CredentialService: decrypt returns identical refresh token');

  // Verify SecretRedactor redacts all tokens
  const sampleLogPayload = {
    spreadsheetId: 'sheet-abc',
    operation: 'add_row',
    auth: rawTokens,
    headers: {
      Authorization: `Bearer ${rawTokens.access_token}`,
    },
  };

  const redacted = redactSecrets(sampleLogPayload);
  check(redacted.auth.access_token === '[REDACTED]', 'SecretRedactor: redacts access_token field');
  check(redacted.auth.refresh_token === '[REDACTED]', 'SecretRedactor: redacts refresh_token field');
  check(redacted.auth.id_token === '[REDACTED]', 'SecretRedactor: redacts id_token field');
  check(redacted.headers.Authorization === 'Bearer [REDACTED]', 'SecretRedactor: redacts Authorization Bearer header');
  check(!JSON.stringify(redacted).includes('SECRET_ACCESS_TOKEN'), 'SecretRedactor: no access token leaked in JSON stringify');
  check(!JSON.stringify(redacted).includes('SECRET_REFRESH_TOKEN'), 'SecretRedactor: no refresh token leaked in JSON stringify');

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
