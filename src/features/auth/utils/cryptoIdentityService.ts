import { UserRole, UserStatus, Permission } from '@/types';
import { apiFetch } from '@/shared/services/apiClient';

// System secret seed used for HMAC integrity protection of portable account credentials
// This prevents modification of companyId, userId, role, or permissions.
const SYSTEM_INTEGRITY_SECRET = 'CHITFUND_PORTABLE_IDENTITY_HMAC_KEY_V1_2026';

export interface PortableStaffPayload {
  version: 1;
  type: 'CHIT_STAFF_INVITATION';
  userId: string;
  companyId: string;
  companyName: string;
  email: string;
  name: string;
  role: UserRole;
  customRoleName?: string;
  status: UserStatus;
  permissions: Permission[];
  salt: string;
  verifier: string; // PBKDF2-SHA256 hash of (password + salt)
  activationCode?: string; // Short user-friendly code, e.g. CHIT-A7K9-M2Q4
  issuedAt: string;
}

export interface ChitUserFile {
  app: 'CHIT_FUND_MANAGEMENT';
  format: 'CHIT_USER_INVITATION_V1';
  payload: PortableStaffPayload;
  signature: string;
  token: string;
  activationCode?: string;
}

// 30 unambiguous alphanumeric characters (excludes 0/O, 1/I, 5/S)
const SAFE_CODE_CHARS = '2346789ABCDEFGHJKLMNPQRTUVWXYZ';

/**
 * Generates a cryptographically secure random short activation code (CHIT-XXXX-XXXX)
 * Using browser native Web Crypto API (crypto.getRandomValues)
 */
export function generateShortActivationCode(): string {
  const bytes = new Uint8Array(8);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += SAFE_CODE_CHARS[bytes[i] % SAFE_CODE_CHARS.length];
    part2 += SAFE_CODE_CHARS[bytes[i + 4] % SAFE_CODE_CHARS.length];
  }
  return `CHIT-${part1}-${part2}`;
}

/**
 * Normalizes user input for activation codes:
 * Automatically uppercases, trims spaces, handles accidental spacing and hyphens.
 */
export function normalizeActivationCode(input: string): string {
  const cleaned = (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('CHIT')) {
    const rest = cleaned.slice(4);
    if (rest.length <= 4) return `CHIT-${rest}`;
    return `CHIT-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
  }
  if (cleaned.length <= 4) return `CHIT-${cleaned}`;
  if (cleaned.length <= 8) return `CHIT-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
  return `CHIT-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
}

/**
 * Checks whether an input string matches the short activation code format
 */
export function isShortActivationCode(input: string): boolean {
  const normalized = normalizeActivationCode(input);
  return /^CHIT-[2346789ABCDEFGHJKLMNPQRTUVWXYZ]{4}-[2346789ABCDEFGHJKLMNPQRTUVWXYZ]{4}$/.test(normalized);
}

// Local registry key for activation mappings
export const ACTIVATION_REGISTRY_KEY = 'chitfund_activation_registry';

export interface ActivationRegistryEntry {
  code: string;
  userId: string;
  companyId: string;
  token: string;
  chitUserFile: ChitUserFile;
  createdAt: string;
}

export function saveActivationCodeMapping(entry: ActivationRegistryEntry): void {
  try {
    const raw = localStorage.getItem(ACTIVATION_REGISTRY_KEY);
    const registry: Record<string, ActivationRegistryEntry> = raw ? JSON.parse(raw) : {};
    const normalized = normalizeActivationCode(entry.code);
    registry[normalized] = entry;
    localStorage.setItem(ACTIVATION_REGISTRY_KEY, JSON.stringify(registry));
  } catch (err) {
    console.warn('Failed to save activation code mapping', err);
  }

  // Sync to API for cross-device resolution without file upload
  try {
    apiFetch('auth.php?action=register_activation', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({
        code: normalizeActivationCode(entry.code),
        userId: entry.userId,
        companyId: entry.companyId,
        credential: entry.chitUserFile,
      }),
    }).catch(() => {});
  } catch {}
}

export function getActivationCodeMapping(code: string): ActivationRegistryEntry | null {
  try {
    const raw = localStorage.getItem(ACTIVATION_REGISTRY_KEY);
    if (!raw) return null;
    const registry: Record<string, ActivationRegistryEntry> = JSON.parse(raw);
    const normalized = normalizeActivationCode(code);
    return registry[normalized] || null;
  } catch {
    return null;
  }
}

export function invalidateActivationCode(code: string): void {
  const normalized = normalizeActivationCode(code);
  try {
    const raw = localStorage.getItem(ACTIVATION_REGISTRY_KEY);
    if (!raw) return;
    const registry: Record<string, ActivationRegistryEntry> = JSON.parse(raw);
    delete registry[normalized];
    localStorage.setItem(ACTIVATION_REGISTRY_KEY, JSON.stringify(registry));
  } catch (err) {
    console.warn('Failed to invalidate activation code', err);
  }

  // Invalidate on API
  try {
    apiFetch('auth.php?action=invalidate_code', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ code: normalized }),
    }).catch(() => {});
  } catch {}
}

/**
 * Generate a cryptographically secure random salt (hex string)
 */
export function generateCryptoSalt(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert string to Uint8Array UTF-8 buffer
 */
function strToBuffer(str: string): BufferSource {
  return new TextEncoder().encode(str) as unknown as BufferSource;
}

/**
 * Convert ArrayBuffer to Hex String
 */
function bufferToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Base64URL encoding helpers
 */
export function base64UrlEncode(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Derives a PBKDF2-SHA256 password verifier hash using Web Crypto API.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    // Fallback simple hash if Web Crypto Subtle is unavailable
    let hash = 0;
    const combined = password + salt;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash << 5) - hash + combined.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(32, '0');
  }

  try {
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      strToBuffer(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: strToBuffer(salt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    return bufferToHex(derivedBits);
  } catch (err) {
    console.error('[CryptoIdentity] PBKDF2 hashing failed, using fallback:', err);
    return fallbackSha256(password + salt);
  }
}

/**
 * Verifies a password against a stored PBKDF2 verifier hash.
 */
export async function verifyPassword(
  passwordAttempt: string,
  salt: string,
  expectedVerifier: string
): Promise<boolean> {
  try {
    const calculated = await hashPassword(passwordAttempt, salt);
    return calculated.toLowerCase() === expectedVerifier.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Fallback SHA-256 digest using Web Crypto or simple hash
 */
async function fallbackSha256(message: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const msgBuffer = strToBuffer(message);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      return bufferToHex(hashBuffer);
    } catch {}
  }
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    hash = (hash << 5) - hash + message.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

/**
 * Canonical deterministic string representation of payload for signature calculation
 */
function getCanonicalPayloadString(payload: Omit<PortableStaffPayload, 'version' | 'type'> & { version: number; type: string }): string {
  const sortedPermissions = [...(payload.permissions || [])].sort();
  return JSON.stringify({
    companyId: payload.companyId,
    companyName: payload.companyName,
    customRoleName: payload.customRoleName || '',
    email: payload.email.trim().toLowerCase(),
    issuedAt: payload.issuedAt,
    name: payload.name.trim(),
    permissions: sortedPermissions,
    role: payload.role,
    salt: payload.salt,
    status: payload.status,
    type: payload.type,
    userId: payload.userId,
    verifier: payload.verifier,
    version: payload.version,
  });
}

/**
 * Compute HMAC-SHA256 signature over data using Web Crypto API
 */
async function computeHmacSignature(canonicalData: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const key = await window.crypto.subtle.importKey(
        'raw',
        strToBuffer(SYSTEM_INTEGRITY_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sigBuffer = await window.crypto.subtle.sign('HMAC', key, strToBuffer(canonicalData));
      return bufferToHex(sigBuffer);
    } catch (err) {
      console.warn('[CryptoIdentity] Web Crypto HMAC failed, using fallback:', err);
    }
  }
  // Fallback digest
  return fallbackSha256(canonicalData + SYSTEM_INTEGRITY_SECRET);
}

/**
 * Generates a tamper-proof staff activation credential (token and .chituser file data)
 */
export async function generateStaffActivationCredential(params: {
  userId: string;
  companyId: string;
  companyName: string;
  email: string;
  name: string;
  role: UserRole;
  customRoleName?: string;
  status: UserStatus;
  permissions: Permission[];
  passwordPlaintext: string;
  existingActivationCode?: string;
}): Promise<{
  token: string;
  activationCode: string;
  chitUserFile: ChitUserFile;
  salt: string;
  verifier: string;
}> {
  const salt = generateCryptoSalt(16);
  const verifier = await hashPassword(params.passwordPlaintext, salt);
  const issuedAt = new Date().toISOString();
  const activationCode = params.existingActivationCode || generateShortActivationCode();

  const payload: PortableStaffPayload = {
    version: 1,
    type: 'CHIT_STAFF_INVITATION',
    userId: params.userId,
    companyId: params.companyId,
    companyName: params.companyName,
    email: params.email.trim().toLowerCase(),
    name: params.name.trim(),
    role: params.role,
    customRoleName: params.customRoleName,
    status: params.status,
    permissions: params.permissions,
    salt,
    verifier,
    activationCode,
    issuedAt,
  };

  const canonicalString = getCanonicalPayloadString(payload);
  const signature = await computeHmacSignature(canonicalString);

  const payloadBase64 = base64UrlEncode(JSON.stringify(payload));
  const sigBase64 = base64UrlEncode(signature);
  const token = `CHIT1.${payloadBase64}.${sigBase64}`;

  const chitUserFile: ChitUserFile = {
    app: 'CHIT_FUND_MANAGEMENT',
    format: 'CHIT_USER_INVITATION_V1',
    payload,
    signature,
    token,
    activationCode,
  };

  // Register in local activation code store
  saveActivationCodeMapping({
    code: activationCode,
    userId: params.userId,
    companyId: params.companyId,
    token,
    chitUserFile,
    createdAt: issuedAt,
  });

  return {
    token,
    activationCode,
    chitUserFile,
    salt,
    verifier,
  };
}

/**
 * Generates an activation credential from existing stored salt and verifier
 */
export async function generateCredentialFromVerifier(params: {
  userId: string;
  companyId: string;
  companyName: string;
  email: string;
  name: string;
  role: UserRole;
  customRoleName?: string;
  status: UserStatus;
  permissions: Permission[];
  salt: string;
  verifier: string;
  existingActivationCode?: string;
}): Promise<{
  token: string;
  activationCode: string;
  chitUserFile: ChitUserFile;
}> {
  const issuedAt = new Date().toISOString();
  const activationCode = params.existingActivationCode || generateShortActivationCode();

  const payload: PortableStaffPayload = {
    version: 1,
    type: 'CHIT_STAFF_INVITATION',
    userId: params.userId,
    companyId: params.companyId,
    companyName: params.companyName,
    email: params.email.trim().toLowerCase(),
    name: params.name.trim(),
    role: params.role,
    customRoleName: params.customRoleName,
    status: params.status,
    permissions: params.permissions,
    salt: params.salt,
    verifier: params.verifier,
    activationCode,
    issuedAt,
  };

  const canonicalString = getCanonicalPayloadString(payload);
  const signature = await computeHmacSignature(canonicalString);

  const payloadBase64 = base64UrlEncode(JSON.stringify(payload));
  const sigBase64 = base64UrlEncode(signature);
  const token = `CHIT1.${payloadBase64}.${sigBase64}`;

  const chitUserFile: ChitUserFile = {
    app: 'CHIT_FUND_MANAGEMENT',
    format: 'CHIT_USER_INVITATION_V1',
    payload,
    signature,
    token,
    activationCode,
  };

  saveActivationCodeMapping({
    code: activationCode,
    userId: params.userId,
    companyId: params.companyId,
    token,
    chitUserFile,
    createdAt: issuedAt,
  });

  return {
    token,
    activationCode,
    chitUserFile,
  };
}

/**
 * Validates and parses an activation credential (supports short code, token string, or .chituser JSON content).
 * Guarantees cryptographic integrity: role, companyId, permissions, userId cannot be tampered with.
 */
export async function verifyAndParseActivationCredential(
  credentialInput: string
): Promise<{
  isValid: boolean;
  error?: string;
  payload?: PortableStaffPayload;
}> {
  try {
    let raw = (credentialInput || '').trim();
    if (!raw) {
      return { isValid: false, error: 'Activation credential is empty.' };
    }

    let payload: PortableStaffPayload | null = null;
    let signature: string | null = null;

    // 0. Check if input is human-readable plain-text .chituser credential file
    if (
      raw.includes('Token') &&
      (raw.includes('CHIT FUND MANAGEMENT') ||
        raw.includes('STAFF ACCOUNT CREDENTIAL') ||
        raw.includes('--------------------------------'))
    ) {
      const tokenMatch = raw.match(/Token\s*:\s*([^\r\n]+)/i);
      if (tokenMatch && tokenMatch[1]) {
        raw = tokenMatch[1].trim();
      }
    }

    // 1. Check if input is a short activation code (CHIT-XXXX-XXXX)
    const normalizedCandidate = normalizeActivationCode(raw);
    if (isShortActivationCode(normalizedCandidate)) {
      // Check local activation registry first
      const localEntry = getActivationCodeMapping(normalizedCandidate);
      if (localEntry?.chitUserFile) {
        payload = localEntry.chitUserFile.payload;
        signature = localEntry.chitUserFile.signature;
      } else {
        // Try resolving via central backend API
        try {
          const apiRes = await apiFetch<any>(`auth.php?action=resolve_code&code=${encodeURIComponent(normalizedCandidate)}`, { skipAuth: true });
          if (apiRes?.success && apiRes.credential) {
            payload = apiRes.credential.payload;
            signature = apiRes.credential.signature;
          }
        } catch {
          // If network / offline
        }
      }

      if (!payload || !signature) {
        return {
          isValid: false,
          error: `Activation code "${normalizedCandidate}" not found. Please verify the code or upload your .chituser file.`,
        };
      }
    }

    // 2. Check if input is JSON (.chituser format)
    if (!payload && raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.payload && (parsed.signature || parsed.token)) {
          payload = parsed.payload;
          signature = parsed.signature;
          if (!signature && parsed.token?.startsWith('CHIT1.')) {
            const parts = parsed.token.split('.');
            signature = base64UrlDecode(parts[2]);
          }
        }
      } catch {}
    }

    // 3. Check if input is full token: CHIT1.<payloadB64>.<sigB64>
    if (!payload && raw.startsWith('CHIT1.')) {
      const parts = raw.split('.');
      if (parts.length === 3) {
        try {
          const payloadJson = base64UrlDecode(parts[1]);
          payload = JSON.parse(payloadJson);
          signature = base64UrlDecode(parts[2]);
        } catch {
          return { isValid: false, error: 'Malformed activation token format.' };
        }
      }
    }

    if (!payload || !signature) {
      return {
        isValid: false,
        error: 'Invalid invitation format. Please enter a valid activation code (CHIT-XXXX-XXXX) or upload a .chituser file.',
      };
    }

    // Validate essential fields
    if (
      !payload.userId ||
      !payload.companyId ||
      !payload.email ||
      !payload.name ||
      !payload.role ||
      !payload.salt ||
      !payload.verifier
    ) {
      return { isValid: false, error: 'Credential contains incomplete identity information.' };
    }

    // Check HMAC signature integrity
    const canonicalString = getCanonicalPayloadString(payload);
    const expectedSignature = await computeHmacSignature(canonicalString);

    if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
      return {
        isValid: false,
        error: 'Security Error: Credential integrity verification failed. Role, permissions, or company details may have been tampered with.',
      };
    }

    if (payload.status === 'Disabled') {
      return {
        isValid: false,
        error: 'This staff account has been marked as Disabled and cannot be activated.',
      };
    }

    return { isValid: true, payload };
  } catch (err: any) {
    return {
      isValid: false,
      error: err.message || 'An error occurred during credential verification.',
    };
  }
}

export interface ChitUserPlaintextParams {
  name: string;
  role: string;
  companyName: string;
  email: string;
  password?: string;
  token: string;
}

/**
 * Triggers a browser file download for a human-readable plain-text .chituser credential file.
 * The file is formatted cleanly as readable text (NOT JSON) and can be opened in Notepad / any text editor.
 */
export function downloadChitUserFile(
  target: ChitUserFile | ChitUserPlaintextParams,
  customFileName?: string,
  explicitPassword?: string
): void {
  let name = '';
  let role = '';
  let companyName = '';
  let email = '';
  let password = explicitPassword || '';
  let token = '';

  if ('payload' in target) {
    name = target.payload.name || '';
    role = target.payload.customRoleName || target.payload.role || '';
    companyName = target.payload.companyName || 'Chit Fund Management';
    email = target.payload.email || '';
    token = target.payload.activationCode || target.activationCode || target.token || '';
  } else {
    name = target.name || '';
    role = target.role || '';
    companyName = target.companyName || 'Chit Fund Management';
    email = target.email || '';
    token = target.token || '';
    if (!password && target.password) {
      password = target.password;
    }
  }

  const fileName =
    customFileName ||
    `${companyName.replace(/[^a-zA-Z0-9]/g, '_')}-${name.replace(/[^a-zA-Z0-9]/g, '_')}-${role.replace(/[^a-zA-Z0-9]/g, '_')}.chituser`;

  const fileContent = [
    'CHIT FUND MANAGEMENT',
    'STAFF ACCOUNT CREDENTIAL',
    '',
    '--------------------------------',
    `Name       : ${name}`,
    `Role       : ${role}`,
    `Company    : ${companyName}`,
    `Email      : ${email}`,
    '',
    `Password   : ${password}`,
    `Token      : ${token}`,
    '--------------------------------',
    '',
  ].join('\r\n');

  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
