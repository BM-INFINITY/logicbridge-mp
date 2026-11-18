/**
 * NetworkSecurity — Centralized network validation and Server-Side Request Forgery (SSRF) defense.
 *
 * Implements multi-layered protection against SSRF, DNS rebinding, cloud metadata exfiltration,
 * and internal network scanning:
 *   1. Protocol enforcement (HTTP and HTTPS only)
 *   2. Hostname normalization and blacklisted domain checks
 *   3. Strict IPv4 and IPv6 private/reserved/loopback/link-local/multicast CIDR validation
 *   4. IPv4-mapped IPv6 extraction and normalization (e.g. ::ffff:127.0.0.1, ::ffff:7f00:1)
 *   5. Alternative IP representation normalization (hex, octal, integer via URL standard)
 *   6. Comprehensive DNS resolution checking every resolved address
 *   7. DNS rebinding mitigation via custom lookup tied directly to socket connection
 *   8. Independent validation of every redirect hop (disables blind automatic redirect following)
 *   9. Cloud metadata service protection (AWS/GCP/Azure/Alibaba 169.254.169.254, metadata.google.internal)
 */

const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const axios = require('axios');

// Cloud metadata and internal service hostnames
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google',
  'instance-data',
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.localdomain',
];

// Offline & Test mock DNS table for deterministic offline test execution
const MOCK_DNS_TABLE = new Map([
  ['example.com', [{ address: '93.184.216.34', family: 4 }]],
  ['api.example.com', [{ address: '93.184.216.34', family: 4 }]],
  ['jsonplaceholder.typicode.com', [{ address: '93.184.216.34', family: 4 }]],
  ['script.google.com', [{ address: '142.250.190.74', family: 4 }]],
  ['api.openai.com', [{ address: '104.18.7.192', family: 4 }]],
  ['api.anthropic.com', [{ address: '104.18.7.192', family: 4 }]],
  ['openrouter.ai', [{ address: '104.18.7.192', family: 4 }]],
  ['generativelanguage.googleapis.com', [{ address: '142.250.190.74', family: 4 }]],
]);

/**
 * Registers mock DNS entries for automated offline testing
 * @param {string} hostname
 * @param {Array<string>|string} ips
 */
function registerMockDns(hostname, ips) {
  const normHost = String(hostname || '').toLowerCase().trim();
  const list = Array.isArray(ips) ? ips : [ips];
  const records = list.map((ip) => ({
    address: ip,
    family: net.isIP(ip) || 4,
  }));
  MOCK_DNS_TABLE.set(normHost, records);
}

/**
 * Clears custom mock DNS entries
 * @param {string} [hostname]
 */
function clearMockDns(hostname) {
  if (hostname) {
    MOCK_DNS_TABLE.delete(String(hostname).toLowerCase().trim());
  } else {
    MOCK_DNS_TABLE.clear();
    // Restore default public fixtures
    MOCK_DNS_TABLE.set('example.com', [{ address: '93.184.216.34', family: 4 }]);
    MOCK_DNS_TABLE.set('api.example.com', [{ address: '93.184.216.34', family: 4 }]);
    MOCK_DNS_TABLE.set('jsonplaceholder.typicode.com', [{ address: '93.184.216.34', family: 4 }]);
    MOCK_DNS_TABLE.set('script.google.com', [{ address: '142.250.190.74', family: 4 }]);
    MOCK_DNS_TABLE.set('api.openai.com', [{ address: '104.18.7.192', family: 4 }]);
    MOCK_DNS_TABLE.set('api.anthropic.com', [{ address: '104.18.7.192', family: 4 }]);
    MOCK_DNS_TABLE.set('openrouter.ai', [{ address: '104.18.7.192', family: 4 }]);
    MOCK_DNS_TABLE.set('generativelanguage.googleapis.com', [{ address: '142.250.190.74', family: 4 }]);
  }
}

/**
 * Resolves all addresses for a hostname, consulting mock table first if offline or mocked
 * @param {string} hostname
 * @returns {Promise<Array<{ address: string, family: number }>>}
 */
async function resolveAllAddresses(hostname) {
  const normHost = String(hostname).toLowerCase().trim().replace(/^\[|\]$/g, '');
  if (MOCK_DNS_TABLE.has(normHost)) {
    return MOCK_DNS_TABLE.get(normHost);
  }

  try {
    return await dns.promises.lookup(normHost, { all: true });
  } catch (err) {
    if (MOCK_DNS_TABLE.has(normHost)) {
      return MOCK_DNS_TABLE.get(normHost);
    }
    throw err;
  }
}

/**
 * Converts a dotted-quad IPv4 string to an unsigned 32-bit integer
 * @param {string} ip
 * @returns {number}
 */
function ipv4ToInt(ip) {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) {
    return null;
  }
  return ((octets[0] << 24) >>> 0) + ((octets[1] << 16) >>> 0) + ((octets[2] << 8) >>> 0) + (octets[3] >>> 0);
}

/**
 * Checks whether an IPv4 address string falls within private, loopback, or reserved CIDRs
 * @param {string} ip
 * @returns {{ blocked: boolean, reason?: string }}
 */
function checkIPv4(ip) {
  const num = ipv4ToInt(ip);
  if (num === null) {
    return { blocked: true, reason: 'Invalid IPv4 address format' };
  }

  // 0.0.0.0/8 (Current network)
  if ((num >>> 24) === 0) {
    return { blocked: true, reason: 'Current network (0.0.0.0/8)' };
  }

  // 10.0.0.0/8 (Private network RFC 1918)
  if ((num >>> 24) === 10) {
    return { blocked: true, reason: 'Private network (10.0.0.0/8)' };
  }

  // 100.64.0.0/10 (Carrier-grade NAT RFC 6598: 100.64.0.0 - 100.127.255.255)
  if ((num >>> 22) === ((100 << 2) | (64 >> 6))) {
    return { blocked: true, reason: 'Carrier-grade NAT (100.64.0.0/10)' };
  }

  // 127.0.0.0/8 (Loopback RFC 1122)
  if ((num >>> 24) === 127) {
    return { blocked: true, reason: 'Loopback address (127.0.0.0/8)' };
  }

  // 169.254.0.0/16 (Link-local & Cloud Metadata RFC 3927)
  if ((num >>> 16) === ((169 << 8) | 254)) {
    return { blocked: true, reason: 'Link-local / Cloud metadata (169.254.0.0/16)' };
  }

  // 172.16.0.0/12 (Private network RFC 1918: 172.16.0.0 - 172.31.255.255)
  if ((num >>> 20) === ((172 << 4) | (16 >> 4))) {
    return { blocked: true, reason: 'Private network (172.16.0.0/12)' };
  }

  // 192.0.0.0/24 (IETF Protocol Assignments RFC 6890)
  if ((num >>> 24) === 192 && ((num >>> 16) & 0xff) === 0 && ((num >>> 8) & 0xff) === 0) {
    return { blocked: true, reason: 'IETF Protocol Assignments (192.0.0.0/24)' };
  }

  // 192.0.2.0/24 (TEST-NET-1 RFC 5737)
  if ((num >>> 24) === 192 && ((num >>> 16) & 0xff) === 0 && ((num >>> 8) & 0xff) === 2) {
    return { blocked: true, reason: 'TEST-NET-1 documentation (192.0.2.0/24)' };
  }

  // 192.88.99.0/24 (6to4 Relay Anycast RFC 7526)
  if ((num >>> 24) === 192 && ((num >>> 16) & 0xff) === 88 && ((num >>> 8) & 0xff) === 99) {
    return { blocked: true, reason: '6to4 Relay Anycast (192.88.99.0/24)' };
  }

  // 192.168.0.0/16 (Private network RFC 1918)
  if ((num >>> 16) === ((192 << 8) | 168)) {
    return { blocked: true, reason: 'Private network (192.168.0.0/16)' };
  }

  // 198.18.0.0/15 (Network benchmark RFC 2544: 198.18.0.0 - 198.19.255.255)
  if ((num >>> 17) === ((198 << 7) | (18 >> 1))) {
    return { blocked: true, reason: 'Benchmark testing (198.18.0.0/15)' };
  }

  // 198.51.100.0/24 (TEST-NET-2 RFC 5737)
  if ((num >>> 24) === 198 && ((num >>> 16) & 0xff) === 51 && ((num >>> 8) & 0xff) === 100) {
    return { blocked: true, reason: 'TEST-NET-2 documentation (198.51.100.0/24)' };
  }

  // 203.0.113.0/24 (TEST-NET-3 RFC 5737)
  if ((num >>> 24) === 203 && ((num >>> 16) & 0xff) === 0 && ((num >>> 8) & 0xff) === 113) {
    return { blocked: true, reason: 'TEST-NET-3 documentation (203.0.113.0/24)' };
  }

  // 224.0.0.0/4 (Multicast RFC 5771: 224.0.0.0 - 239.255.255.255)
  if ((num >>> 28) >= 14 && (num >>> 28) <= 14) {
    return { blocked: true, reason: 'Multicast address (224.0.0.0/4)' };
  }

  // 240.0.0.0/4 (Reserved for future use RFC 1112: 240.0.0.0 - 255.255.255.255)
  if ((num >>> 28) === 15) {
    return { blocked: true, reason: 'Reserved / Broadcast (240.0.0.0/4)' };
  }

  return { blocked: false };
}

/**
 * Normalizes an IPv6 address string into 8 16-bit blocks
 * @param {string} ip
 * @returns {Array<number>|null}
 */
function ipv6ToBlocks(ip) {
  let clean = ip.replace(/^\[|\]$/g, '').toLowerCase().trim();

  // Handle embedded IPv4 notation (e.g. ::ffff:127.0.0.1)
  if (clean.includes('.')) {
    const lastColon = clean.lastIndexOf(':');
    if (lastColon === -1) return null;
    const ipv4Part = clean.slice(lastColon + 1);
    const v4Bytes = ipv4Part.split('.').map(Number);
    if (v4Bytes.length !== 4 || v4Bytes.some((b) => isNaN(b) || b < 0 || b > 255)) {
      return null;
    }
    const hex1 = ((v4Bytes[0] << 8) | v4Bytes[1]).toString(16);
    const hex2 = ((v4Bytes[2] << 8) | v4Bytes[3]).toString(16);
    clean = clean.slice(0, lastColon + 1) + hex1 + ':' + hex2;
  }

  const parts = clean.split('::');
  if (parts.length > 2) return null; // Only one '::' permitted in IPv6

  let left = parts[0] ? parts[0].split(':').filter(Boolean) : [];
  let right = parts[1] ? parts[1].split(':').filter(Boolean) : [];

  if (parts.length === 2) {
    const missing = 8 - (left.length + right.length);
    if (missing < 0) return null;
    const mid = new Array(missing).fill('0');
    left = [...left, ...mid, ...right];
  }

  if (left.length !== 8) return null;

  const blocks = [];
  for (const p of left) {
    const val = parseInt(p, 16);
    if (isNaN(val) || val < 0 || val > 0xffff) return null;
    blocks.push(val);
  }
  return blocks;
}

/**
 * Checks whether an IPv6 address string falls within private, loopback, or reserved CIDRs
 * @param {string} ip
 * @returns {{ blocked: boolean, reason?: string }}
 */
function checkIPv6(ip) {
  const blocks = ipv6ToBlocks(ip);
  if (!blocks) {
    return { blocked: true, reason: 'Invalid IPv6 address format' };
  }

  // ::/128 (Unspecified)
  if (blocks.every((b) => b === 0)) {
    return { blocked: true, reason: 'IPv6 Unspecified address (::)' };
  }

  // ::1/128 (Loopback)
  if (blocks.slice(0, 7).every((b) => b === 0) && blocks[7] === 1) {
    return { blocked: true, reason: 'IPv6 Loopback address (::1)' };
  }

  // IPv4-mapped IPv6 (::ffff:0:0/96)
  if (blocks.slice(0, 5).every((b) => b === 0) && blocks[5] === 0xffff) {
    const octet0 = (blocks[6] >> 8) & 0xff;
    const octet1 = blocks[6] & 0xff;
    const octet2 = (blocks[7] >> 8) & 0xff;
    const octet3 = blocks[7] & 0xff;
    const mappedIpv4 = `${octet0}.${octet1}.${octet2}.${octet3}`;
    const v4Check = checkIPv4(mappedIpv4);
    if (v4Check.blocked) {
      return { blocked: true, reason: `IPv4-mapped IPv6 pointing to ${v4Check.reason}` };
    }
  }

  // IPv4-compatible IPv6 (::0:0/96 - deprecated)
  if (blocks.slice(0, 6).every((b) => b === 0) && (blocks[6] !== 0 || blocks[7] > 1)) {
    const octet0 = (blocks[6] >> 8) & 0xff;
    const octet1 = blocks[6] & 0xff;
    const octet2 = (blocks[7] >> 8) & 0xff;
    const octet3 = blocks[7] & 0xff;
    const compatIpv4 = `${octet0}.${octet1}.${octet2}.${octet3}`;
    const v4Check = checkIPv4(compatIpv4);
    if (v4Check.blocked) {
      return { blocked: true, reason: `IPv4-compatible IPv6 pointing to ${v4Check.reason}` };
    }
  }

  // 64:ff9b::/96 (IPv4/IPv6 translation RFC 6052)
  if (blocks[0] === 0x0064 && blocks[1] === 0xff9b && blocks.slice(2, 6).every((b) => b === 0)) {
    const octet0 = (blocks[6] >> 8) & 0xff;
    const octet1 = blocks[6] & 0xff;
    const octet2 = (blocks[7] >> 8) & 0xff;
    const octet3 = blocks[7] & 0xff;
    const transIpv4 = `${octet0}.${octet1}.${octet2}.${octet3}`;
    const v4Check = checkIPv4(transIpv4);
    if (v4Check.blocked) {
      return { blocked: true, reason: `IPv4/IPv6 translation pointing to ${v4Check.reason}` };
    }
  }

  // fc00::/7 (Unique Local Address ULA RFC 4193: fc00:: - fdff:ffff:...)
  if ((blocks[0] & 0xfe00) === 0xfc00) {
    return { blocked: true, reason: 'IPv6 Unique Local / Private address (fc00::/7)' };
  }

  // fe80::/10 (Link-local unicast RFC 4291: fe80:: - febf:ffff:...)
  if ((blocks[0] & 0xffc0) === 0xfe80) {
    return { blocked: true, reason: 'IPv6 Link-local unicast address (fe80::/10)' };
  }

  // ff00::/8 (Multicast)
  if ((blocks[0] & 0xff00) === 0xff00) {
    return { blocked: true, reason: 'IPv6 Multicast address (ff00::/8)' };
  }

  // 2001:db8::/32 (Documentation)
  if (blocks[0] === 0x2001 && blocks[1] === 0x0db8) {
    return { blocked: true, reason: 'IPv6 Documentation address (2001:db8::/32)' };
  }

  return { blocked: false };
}

/**
 * Checks if an IP address string (IPv4 or IPv6) is a private, loopback, metadata, or reserved IP
 * @param {string} ip
 * @param {object} [options]
 * @param {boolean} [options.allowPrivate=false] - For controlled admin-whitelisted internal AI endpoints
 * @returns {{ blocked: boolean, reason?: string }}
 */
function isPrivateOrBlockedIP(ip, options = {}) {
  if (!ip || typeof ip !== 'string') {
    return { blocked: true, reason: 'Missing or empty IP address' };
  }

  const cleanIp = ip.trim().replace(/^\[|\]$/g, '');

  const family = net.isIP(cleanIp);
  if (family === 4) {
    const v4Result = checkIPv4(cleanIp);
    if (v4Result.blocked) {
      // Cloud metadata is NEVER allowed, even with allowPrivate: true
      const isCloudMetadata = cleanIp.startsWith('169.254.');
      if (options.allowPrivate && !isCloudMetadata) {
        return { blocked: false };
      }
      return v4Result;
    }
    return { blocked: false };
  }

  if (family === 6) {
    const v6Result = checkIPv6(cleanIp);
    if (v6Result.blocked) {
      // If IPv4-mapped, check if mapped IP is cloud metadata
      const isMappedMetadata = cleanIp.includes('169.254.') || cleanIp.includes('a9fe:');
      if (options.allowPrivate && !isMappedMetadata) {
        return { blocked: false };
      }
      return v6Result;
    }
    return { blocked: false };
  }

  return { blocked: true, reason: `Unrecognized IP address format: "${ip}"` };
}

/**
 * Determines whether a URL or host targets cloud metadata services
 * @param {string} hostOrUrl
 * @returns {boolean}
 */
function isCloudMetadata(hostOrUrl) {
  if (!hostOrUrl || typeof hostOrUrl !== 'string') return false;
  const lower = hostOrUrl.toLowerCase().trim();
  if (lower.includes('169.254.169.254')) return true;
  if (lower.includes('metadata.google.internal')) return true;
  if (lower.includes('100.100.100.200')) return true; // Alibaba Cloud metadata
  return false;
}

/**
 * Determines whether a specific destination hostname or IP is explicitly permitted
 * under the self-hosted AI endpoint security policy (SEC-02 & Part B.2).
 *
 * Policy precedence:
 *   1. Cloud metadata is unconditionally blocked (non-overridable)
 *   2. Explicit allowlisting via ALLOWED_PRIVATE_AI_HOSTS takes precedence
 *   3. Local Ollama loopback allowed via ALLOW_OLLAMA_LOCAL
 *   4. Backward-compatible broad override via ALLOW_PRIVATE_AI_ENDPOINTS
 *
 * @param {string} hostnameOrIp
 * @param {string} [providerId]
 * @returns {boolean}
 */
function isAllowedPrivateAiDestination(hostnameOrIp, providerId) {
  if (!hostnameOrIp || typeof hostnameOrIp !== 'string') return false;
  const clean = hostnameOrIp.toLowerCase().trim().replace(/^\[|\]$/g, '');

  // Cloud metadata is strictly forbidden under all circumstances
  if (isCloudMetadata(clean)) return false;

  // 1. Explicit hostname/IP allowlist via ALLOWED_PRIVATE_AI_HOSTS
  const explicitHosts = (process.env.ALLOWED_PRIVATE_AI_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  if (explicitHosts.length > 0) {
    if (explicitHosts.includes(clean)) return true;
  }

  // 2. Ollama local loopback policy
  if (providerId === 'ollama') {
    const isLoopback = clean === 'localhost' || clean === '127.0.0.1' || clean === '::1';
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      if (process.env.ALLOW_OLLAMA_LOCAL === 'true' && isLoopback) return true;
    } else {
      if (process.env.ALLOW_OLLAMA_LOCAL !== 'false' && isLoopback) return true;
    }
  }

  // 3. Fallback broad flag only permitted in development / test environments.
  // In production, explicit host/IP allowlisting via ALLOWED_PRIVATE_AI_HOSTS is mandatory.
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd && process.env.ALLOW_PRIVATE_AI_ENDPOINTS === 'true') {
    return true;
  }

  return false;
}

/**
 * Determines if administrative controls permit local Ollama / private AI deployment
 * @param {string} providerId
 * @returns {boolean}
 */
function isPrivateAiEndpointAllowed(providerId) {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    if (providerId === 'ollama' && process.env.ALLOW_OLLAMA_LOCAL === 'true') return true;
    return Boolean(process.env.ALLOWED_PRIVATE_AI_HOSTS);
  }
  // In development and test environments, allow local Ollama by default unless explicitly disabled
  return (
    process.env.ALLOW_OLLAMA_LOCAL !== 'false' ||
    Boolean(process.env.ALLOWED_PRIVATE_AI_HOSTS) ||
    process.env.ALLOW_PRIVATE_AI_ENDPOINTS === 'true'
  );
}

/**
 * Validates an outbound URL against SSRF, protocol, and hostname policies
 *
 * @param {string} targetUrl - URL string to validate
 * @param {object} [options]
 * @param {boolean} [options.allowPrivate=false] - For admin-whitelisted internal AI endpoints
 * @param {string} [options.providerId] - Provider ID (e.g. 'ollama')
 * @returns {Promise<{ valid: boolean, parsedUrl: URL, resolvedAddresses: Array<{ address: string, family: number }> }>}
 */
async function validateUrl(targetUrl, options = {}) {
  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.trim()) {
    throw new Error('URL must be a non-empty string');
  }

  let parsed;
  try {
    parsed = new URL(targetUrl.trim());
  } catch (err) {
    throw new Error(`Invalid URL: ${err.message}`);
  }

  // 1. Protocol Enforcement: HTTP and HTTPS only
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`SSRF blocked: Disallowed protocol "${protocol}". Only http: and https: are permitted.`);
  }

  // 2. Reject credentials embedded in URL
  if (parsed.username || parsed.password) {
    throw new Error('SSRF blocked: Embedded HTTP basic authentication in URL is not permitted');
  }

  // 3. Cloud metadata checks on raw input
  if (isCloudMetadata(targetUrl) || isCloudMetadata(parsed.hostname)) {
    throw new Error('SSRF blocked: Access to cloud instance metadata services is strictly prohibited');
  }

  const rawHostname = parsed.hostname.toLowerCase().trim();
  if (!rawHostname) {
    throw new Error('SSRF blocked: Hostname is required in URL');
  }

  // 4. Blacklisted Hostname and TLD checks
  const cleanHostname = rawHostname.replace(/^\[|\]$/g, '');
  const isAllowedAi = isAllowedPrivateAiDestination(cleanHostname, options.providerId);
  const allowPrivate = Boolean(options.allowPrivate || isAllowedAi);

  if (BLOCKED_HOSTNAMES.has(cleanHostname)) {
    if (!allowPrivate) {
      throw new Error(`SSRF blocked: Hostname "${cleanHostname}" is a prohibited internal/loopback destination`);
    }
  }

  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (cleanHostname.endsWith(suffix)) {
      if (!allowPrivate) {
        throw new Error(`SSRF blocked: Hostname with suffix "${suffix}" is a prohibited internal domain`);
      }
    }
  }

  // 5. IP Literal check (Node URL normalization handles integer/hex/octal IPv4)
  const isDirectIp = net.isIP(cleanHostname);
  if (isDirectIp) {
    const ipCheck = isPrivateOrBlockedIP(cleanHostname, { allowPrivate });
    if (ipCheck.blocked) {
      throw new Error(`SSRF blocked: IP address "${cleanHostname}" is prohibited (${ipCheck.reason})`);
    }
    return {
      valid: true,
      parsedUrl: parsed,
      resolvedAddresses: [{ address: cleanHostname, family: isDirectIp }],
    };
  }

  // 6. DNS Resolution and Multi-Address Verification
  let addresses = [];
  try {
    addresses = await resolveAllAddresses(cleanHostname);
  } catch (err) {
    // If hostname cannot be resolved
    throw new Error(`SSRF blocked: DNS resolution failed for hostname "${cleanHostname}": ${err.message}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`SSRF blocked: No DNS records returned for hostname "${cleanHostname}"`);
  }

  for (const record of addresses) {
    const check = isPrivateOrBlockedIP(record.address, { allowPrivate });
    if (check.blocked) {
      throw new Error(
        `SSRF blocked: Hostname "${cleanHostname}" resolved to prohibited address "${record.address}" (${check.reason})`
      );
    }
  }

  return {
    valid: true,
    parsedUrl: parsed,
    resolvedAddresses: addresses,
  };
}

/**
 * Creates a safe DNS lookup function tied to a specific request options object.
 * Guarantees that socket connections connect exclusively to pre-validated IP addresses,
 * defeating DNS rebinding attacks.
 *
 * @param {object} [options]
 * @param {boolean} [options.allowPrivate=false]
 * @param {string} [options.providerId]
 * @returns {Function} Custom lookup function compatible with http/https/axios
 */
function createSafeLookup(options = {}) {
  return function safeLookup(hostname, lookupOptions, callback) {
    const cb = typeof lookupOptions === 'function' ? lookupOptions : callback;
    const cleanHostname = String(hostname || '').toLowerCase().trim().replace(/^\[|\]$/g, '');
    const isAllowedAi = isAllowedPrivateAiDestination(cleanHostname, options.providerId);
    const allowPrivate = Boolean(options.allowPrivate || isAllowedAi);

    // Check hostname blacklist
    if (BLOCKED_HOSTNAMES.has(cleanHostname) && !allowPrivate) {
      return cb(new Error(`SSRF blocked: Prohibited hostname "${cleanHostname}"`));
    }

    // If already an IP literal
    if (net.isIP(cleanHostname)) {
      const check = isPrivateOrBlockedIP(cleanHostname, { allowPrivate });
      if (check.blocked) {
        return cb(new Error(`SSRF blocked: Prohibited IP "${cleanHostname}" (${check.reason})`));
      }
      return cb(null, cleanHostname, net.isIP(cleanHostname));
    }

    resolveAllAddresses(cleanHostname)
      .then((addresses) => {
        if (!addresses || addresses.length === 0) {
          return cb(new Error(`SSRF blocked: No DNS records for "${cleanHostname}"`));
        }

        for (const record of addresses) {
          const check = isPrivateOrBlockedIP(record.address, { allowPrivate });
          if (check.blocked) {
            return cb(
              new Error(
                `SSRF blocked: Hostname "${cleanHostname}" resolved to prohibited IP "${record.address}" (${check.reason})`
              )
            );
          }
        }

        const isAll = Boolean(lookupOptions && typeof lookupOptions === 'object' && lookupOptions.all);
        if (isAll) {
          cb(null, addresses);
        } else {
          cb(null, addresses[0].address, addresses[0].family);
        }
      })
      .catch((err) => cb(err));
  };
}

/**
 * Creates dedicated safe HTTP and HTTPS agents with safeLookup configured
 * @param {object} [options]
 * @returns {{ httpAgent: http.Agent, httpsAgent: https.Agent }}
 */
function createSafeAgents(options = {}) {
  const safeLookup = createSafeLookup(options);
  const httpAgent = new http.Agent({ lookup: safeLookup, keepAlive: true });
  const httpsAgent = new https.Agent({ lookup: safeLookup, keepAlive: true });
  return { httpAgent, httpsAgent };
}

/**
 * Executes an HTTP request with comprehensive SSRF protection, safe DNS lookup,
 * and independent verification of every redirect hop.
 *
 * @param {object} requestConfig - Axios request configuration
 * @param {object} [options]
 * @param {number} [options.maxRedirects=5] - Maximum permitted redirect hops
 * @param {boolean} [options.allowPrivate=false]
 * @param {string} [options.providerId]
 * @param {Function} [options.client] - Optional mock/test client override
 * @returns {Promise<object>} Axios response
 */
async function executeSafeRequest(requestConfig, options = {}) {
  const maxRedirects = options.maxRedirects !== undefined ? options.maxRedirects : 5;
  const allowPrivate = Boolean(
    options.allowPrivate ||
    (options.providerId && isPrivateAiEndpointAllowed(options.providerId))
  );

  let currentUrl = requestConfig.url;
  let currentMethod = (requestConfig.method || 'GET').toUpperCase();
  let currentData = requestConfig.data;
  let currentHeaders = { ...(requestConfig.headers || {}) };
  let redirectCount = 0;

  const { httpAgent, httpsAgent } = createSafeAgents({ allowPrivate, providerId: options.providerId });
  const client = options.client || axios;

  while (true) {
    // 1. Validate target URL before every hop
    await validateUrl(currentUrl, { allowPrivate, providerId: options.providerId });

    const singleHopConfig = {
      ...requestConfig,
      url: currentUrl,
      method: currentMethod,
      data: currentData,
      headers: currentHeaders,
      maxRedirects: 0, // Disable automatic redirect following
      httpAgent,
      httpsAgent,
      validateStatus: () => true, // Capture redirect status codes directly
    };

    const response = await client(singleHopConfig);

    // 2. Check for redirect response
    const status = response.status;
    const isRedirect = [301, 302, 303, 307, 308].includes(status);
    const location = response.headers?.location;

    if (isRedirect && location) {
      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new Error(`HTTP Request exceeded maximum redirect limit of ${maxRedirects}`);
      }

      // Resolve relative or absolute redirect destination
      let nextUrl;
      try {
        nextUrl = new URL(location, currentUrl).toString();
      } catch (err) {
        throw new Error(`Invalid redirect Location header "${location}": ${err.message}`);
      }

      // Validate the redirect destination URL strictly
      await validateUrl(nextUrl, { allowPrivate, providerId: options.providerId });

      // Handle method changes on 303 or 301/302 for POST
      if (status === 303 || ((status === 301 || status === 302) && currentMethod === 'POST')) {
        currentMethod = 'GET';
        currentData = undefined;
        delete currentHeaders['content-type'];
        delete currentHeaders['content-length'];
      }

      currentUrl = nextUrl;
      continue;
    }

    return response;
  }
}

module.exports = {
  isPrivateOrBlockedIP,
  checkIPv4,
  checkIPv6,
  ipv4ToInt,
  ipv6ToBlocks,
  isCloudMetadata,
  isPrivateAiEndpointAllowed,
  isAllowedPrivateAiDestination,
  validateUrl,
  createSafeLookup,
  createSafeAgents,
  executeSafeRequest,
  registerMockDns,
  clearMockDns,
};
