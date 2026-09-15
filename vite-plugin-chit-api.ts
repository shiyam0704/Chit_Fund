import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve(process.cwd(), '.chitfund-dev-db');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const JWT_SECRET = 'CHITFUND_DEV_SECRET_KEY_2026';
const SUPERADMIN_EMAIL = 'chitfundadmin@gmail.com';
const SUPERADMIN_PASS = 'adminchit@123';

interface DevDatabase {
  companies: Array<{ id: string; name: string; status: string; createdAt: string }>;
  users: Array<{
    id: string;
    companyId: string;
    name: string;
    email: string;
    passwordHash: string;
    role: string;
    customRoleName?: string;
    status: string;
    permissions: string[];
    createdAt: string;
  }>;
  chits: Array<any>;
  members: Array<any>;
  transactions: Array<any>;
  payouts: Array<any>;
  companySettings: Record<string, any>;
  auditLogs: Array<any>;
  activations?: Record<string, { userId: string; companyId: string; chitUserFile: any; createdAt: string }>;
}

function getDefaultDb(): DevDatabase {
  return {
    companies: [
      { id: 'CMP-001', name: 'Chit Fund Management', status: 'Active', createdAt: new Date().toISOString() },
    ],
    users: [
      {
        id: 'USR-ROOT-001',
        companyId: 'CMP-001',
        name: 'Super Administrator',
        email: SUPERADMIN_EMAIL,
        passwordHash: crypto.createHash('sha256').update(SUPERADMIN_PASS).digest('hex'),
        role: 'Super Admin',
        status: 'Active',
        permissions: [
          'VIEW_DASHBOARD', 'VIEW_CHITS', 'CHITS_CREATE', 'CHITS_EDIT', 'CHITS_DELETE',
          'VIEW_MEMBERS', 'MEMBERS_CREATE', 'MEMBERS_EDIT', 'MEMBERS_DELETE',
          'VIEW_PAYMENTS', 'PAYMENTS_CREATE', 'PAYMENTS_EDIT', 'PAYMENTS_DELETE',
          'VIEW_REPORTS', 'REPORTS_EXPORT', 'REPORTS_PRINT',
          'VIEW_SETTINGS', 'SETTINGS_EDIT',
          'VIEW_USERS', 'USERS_CREATE', 'USERS_EDIT', 'USERS_DELETE',
          'VIEW_BACKUP', 'BACKUP_CREATE', 'BACKUP_RESTORE',
          'VIEW_AUDIT_TRAIL', 'AUDIT_EXPORT', 'AUDIT_CLEAR',
        ],
        createdAt: new Date().toISOString(),
      },
    ],
    chits: [],
    members: [],
    transactions: [],
    payouts: [],
    companySettings: {},
    auditLogs: [],
    activations: {},
  };
}

function loadDb(): DevDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (!parsed.activations) parsed.activations = {};
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to load dev database, initializing fresh', e);
  }
  const initial = getDefaultDb();
  saveDb(initial);
  return initial;
}

function saveDb(data: DevDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save dev database', err);
  }
}

function createToken(payload: any): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 86400 * 7;
  const body = Buffer.from(JSON.stringify({ ...payload, exp, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (expectedSig !== signature) return null;
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function readBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export function chitApiDevPlugin(): Plugin {
  return {
    name: 'vite-plugin-chit-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlStr = req.url || '';
        if (!urlStr.startsWith('/api/')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        const parsedUrl = new URL(urlStr, 'http://localhost:5173');
        const pathname = parsedUrl.pathname;
        const action = parsedUrl.searchParams.get('action') || '';
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();

        const db = loadDb();

        const sendJson = (data: any, code = 200) => {
          res.statusCode = code;
          res.end(JSON.stringify(data));
        };

        const sendError = (msg: string, code = 400) => {
          res.statusCode = code;
          res.end(JSON.stringify({ error: true, message: msg }));
        };

        // --- AUTH ---
        if (pathname.endsWith('auth.php')) {
          if (action === 'login' && req.method === 'POST') {
            const body = await readBody(req);
            const email = (body.email || body.username || '').toLowerCase().trim();
            const password = body.password || '';

            // Super Admin
            if (email === SUPERADMIN_EMAIL && password === SUPERADMIN_PASS) {
              const comp = db.companies.find((c) => c.id === 'CMP-001') || { id: 'CMP-001', name: 'Chit Fund Management', status: 'Active' };
              const user = db.users.find((u) => u.email === SUPERADMIN_EMAIL)!;
              const tokenStr = createToken({
                userId: user.id,
                companyId: 'CMP-001',
                email: user.email,
                name: user.name,
                role: user.role,
                permissions: user.permissions,
              });
              return sendJson({
                success: true,
                token: tokenStr,
                user: { ...user, companyName: comp.name },
                company: comp,
              });
            }

            // Normal user
            const hash = crypto.createHash('sha256').update(password).digest('hex');
            const foundUser = db.users.find((u) => u.email.toLowerCase() === email && (u.passwordHash === hash || u.passwordHash === password));
            if (!foundUser) {
              return sendError('Invalid email or password', 401);
            }
            if (foundUser.status !== 'Active') {
              return sendError('Account is deactivated', 403);
            }

            const comp = db.companies.find((c) => c.id === foundUser.companyId) || { id: foundUser.companyId, name: 'Company', status: 'Active' };
            const tokenStr = createToken({
              userId: foundUser.id,
              companyId: foundUser.companyId,
              email: foundUser.email,
              name: foundUser.name,
              role: foundUser.role,
              permissions: foundUser.permissions,
            });

            return sendJson({
              success: true,
              token: tokenStr,
              user: { ...foundUser, companyName: comp.name },
              company: comp,
            });
          }

          if (action === 'resolve_code') {
            const code = (parsedUrl.searchParams.get('code') || '').toUpperCase().trim();
            if (!code) return sendError('Activation code required', 400);
            if (db.activations && db.activations[code]) {
              return sendJson({ success: true, credential: db.activations[code].chitUserFile });
            }
            return sendError(`Activation code "${code}" not found or expired`, 404);
          }

          if (action === 'register_activation' && req.method === 'POST') {
            const body = await readBody(req);
            const code = (body.code || '').toUpperCase().trim();
            if (code && body.credential) {
              if (!db.activations) db.activations = {};
              db.activations[code] = {
                userId: body.userId || '',
                companyId: body.companyId || '',
                chitUserFile: body.credential,
                createdAt: new Date().toISOString(),
              };
              saveDb(db);
              return sendJson({ success: true });
            }
            return sendError('Invalid activation data', 400);
          }

          if (action === 'invalidate_code' && req.method === 'POST') {
            const body = await readBody(req);
            const code = (body.code || '').toUpperCase().trim();
            if (code && db.activations && db.activations[code]) {
              delete db.activations[code];
              saveDb(db);
            }
            return sendJson({ success: true });
          }

          if (action === 'me') {
            const session = verifyToken(token);
            if (!session) return sendError('Unauthorized', 401);
            const comp = db.companies.find((c) => c.id === session.companyId);
            return sendJson({
              success: true,
              user: session,
              company: comp,
            });
          }
        }

        // Require authentication for all endpoints below
        const session = verifyToken(token);
        if (!session) {
          return sendError('Unauthorized: Missing or invalid token', 401);
        }
        const sessionCompanyId = session.companyId;

        // --- SYNC ---
        if (pathname.endsWith('sync.php')) {
          const companyChits = db.chits.filter((c) => c.companyId === sessionCompanyId);
          const companyMembers = db.members.filter((m) => m.companyId === sessionCompanyId);
          const companyTxns = db.transactions.filter((t) => t.companyId === sessionCompanyId);
          const companyPayouts = db.payouts.filter((p) => p.companyId === sessionCompanyId);
          const settings = db.companySettings[sessionCompanyId] || null;
          const audit = db.auditLogs.filter((a) => a.companyId === sessionCompanyId).slice(-200);

          return sendJson({
            success: true,
            companyId: sessionCompanyId,
            timestamp: new Date().toISOString(),
            data: {
              chits: companyChits,
              members: companyMembers,
              transactions: companyTxns,
              payouts: companyPayouts,
              companySettings: settings,
              auditLogs: audit,
            },
          });
        }

        // --- CHITS ---
        if (pathname.endsWith('chits.php')) {
          const body = await readBody(req);
          if (action === 'create') {
            const newChit = {
              ...body,
              id: body.id || 'CHIT-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
              companyId: sessionCompanyId,
              createdAt: new Date().toISOString(),
            };
            db.chits.unshift(newChit);
            saveDb(db);
            return sendJson({ success: true, id: newChit.id });
          }
          if (action === 'update') {
            const idx = db.chits.findIndex((c) => c.id === body.id && c.companyId === sessionCompanyId);
            if (idx === -1) return sendError('Chit not found', 404);
            db.chits[idx] = { ...db.chits[idx], ...body, companyId: sessionCompanyId };
            saveDb(db);
            return sendJson({ success: true, id: body.id });
          }
          if (action === 'delete') {
            const chitId = body.id || parsedUrl.searchParams.get('id');
            db.chits = db.chits.filter((c) => !(c.id === chitId && c.companyId === sessionCompanyId));
            saveDb(db);
            return sendJson({ success: true });
          }
        }

        // --- MEMBERS ---
        if (pathname.endsWith('members.php')) {
          const body = await readBody(req);
          if (action === 'create') {
            const newMember = {
              ...body,
              id: body.id || 'MEM-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
              companyId: sessionCompanyId,
              createdAt: new Date().toISOString(),
            };
            db.members.unshift(newMember);
            saveDb(db);
            return sendJson({ success: true, id: newMember.id });
          }
          if (action === 'update') {
            const idx = db.members.findIndex((m) => m.id === body.id && m.companyId === sessionCompanyId);
            if (idx === -1) return sendError('Member not found', 404);
            db.members[idx] = { ...db.members[idx], ...body, companyId: sessionCompanyId };
            saveDb(db);
            return sendJson({ success: true, id: body.id });
          }
          if (action === 'delete') {
            const memId = body.id || parsedUrl.searchParams.get('id');
            db.members = db.members.filter((m) => !(m.id === memId && m.companyId === sessionCompanyId));
            saveDb(db);
            return sendJson({ success: true });
          }
        }

        // --- TRANSACTIONS ---
        if (pathname.endsWith('transactions.php')) {
          const body = await readBody(req);
          if (action === 'create') {
            const newTxn = {
              ...body,
              id: body.id || 'TXN-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
              companyId: sessionCompanyId,
              createdBy: session.userId,
              createdAt: new Date().toISOString(),
            };
            db.transactions.unshift(newTxn);

            // Update chit collectedAmount
            const chit = db.chits.find((c) => c.id === newTxn.chitId && c.companyId === sessionCompanyId);
            if (chit) {
              const total = db.transactions
                .filter((t) => t.chitId === chit.id && t.companyId === sessionCompanyId && t.type !== 'Payout')
                .reduce((s, t) => s + (Number(t.amount) || 0), 0);
              chit.collectedAmount = total;
            }
            saveDb(db);
            return sendJson({ success: true, id: newTxn.id });
          }
          if (action === 'update') {
            const idx = db.transactions.findIndex((t) => t.id === body.id && t.companyId === sessionCompanyId);
            if (idx === -1) return sendError('Transaction not found', 404);
            db.transactions[idx] = { ...db.transactions[idx], ...body, companyId: sessionCompanyId };
            saveDb(db);
            return sendJson({ success: true, id: body.id });
          }
          if (action === 'delete') {
            const txnId = body.id || parsedUrl.searchParams.get('id');
            db.transactions = db.transactions.filter((t) => !(t.id === txnId && t.companyId === sessionCompanyId));
            saveDb(db);
            return sendJson({ success: true });
          }
        }

        // --- PAYOUTS ---
        if (pathname.endsWith('payouts.php')) {
          const body = await readBody(req);
          if (action === 'create') {
            const newPayout = {
              ...body,
              id: body.id || 'PAY-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
              companyId: sessionCompanyId,
              createdBy: session.userId,
              createdAt: new Date().toISOString(),
            };
            db.payouts.unshift(newPayout);
            saveDb(db);
            return sendJson({ success: true, id: newPayout.id });
          }
          if (action === 'delete') {
            const chitId = body.chitId || parsedUrl.searchParams.get('chitId');
            const monthNumber = Number(body.monthNumber || parsedUrl.searchParams.get('monthNumber'));
            db.payouts = db.payouts.filter((p) => !(p.chitId === chitId && p.monthNumber === monthNumber && p.companyId === sessionCompanyId));
            saveDb(db);
            return sendJson({ success: true });
          }
        }

        // --- SETTINGS ---
        if (pathname.endsWith('settings.php')) {
          if (action === 'get') {
            return sendJson({ success: true, settings: db.companySettings[sessionCompanyId] || null });
          }
          if (action === 'update') {
            const body = await readBody(req);
            db.companySettings[sessionCompanyId] = body.settings || body;
            saveDb(db);
            return sendJson({ success: true });
          }
        }

        // --- USERS ---
        if (pathname.endsWith('users.php')) {
          if (action === 'list') {
            const list = session.role === 'Super Admin' && parsedUrl.searchParams.has('all')
              ? db.users
              : db.users.filter((u) => u.companyId === sessionCompanyId);
            return sendJson({ success: true, users: list });
          }
          if (action === 'create') {
            const body = await readBody(req);
            const email = (body.email || '').toLowerCase().trim();
            if (db.users.some((u) => u.email.toLowerCase() === email)) {
              return sendError('A user with this email already exists', 409);
            }
            const newUser = {
              id: body.id || 'USR-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
              companyId: session.role === 'Super Admin' && body.companyId ? body.companyId : sessionCompanyId,
              name: body.name,
              email: email,
              passwordHash: crypto.createHash('sha256').update(body.password).digest('hex'),
              role: body.role || 'Staff',
              customRoleName: body.customRoleName || undefined,
              status: body.status || 'Active',
              permissions: body.permissions || ['VIEW_DASHBOARD', 'VIEW_CHITS', 'VIEW_MEMBERS', 'VIEW_PAYMENTS', 'PAYMENTS_CREATE', 'VIEW_REPORTS'],
              createdAt: new Date().toISOString(),
            };
            db.users.unshift(newUser);
            saveDb(db);
            return sendJson({ success: true, id: newUser.id, user: newUser });
          }
          if (action === 'update') {
            const body = await readBody(req);
            const idx = db.users.findIndex((u) => u.id === body.id && (session.role === 'Super Admin' || u.companyId === sessionCompanyId));
            if (idx === -1) return sendError('User not found', 404);
            const u = db.users[idx];
            if (body.password) {
              u.passwordHash = crypto.createHash('sha256').update(body.password).digest('hex');
            }
            if (body.name) u.name = body.name;
            if (body.role) u.role = body.role;
            if (body.status) u.status = body.status;
            if (body.permissions) u.permissions = body.permissions;
            saveDb(db);
            return sendJson({ success: true, id: u.id });
          }
          if (action === 'delete') {
            const body = await readBody(req);
            const userId = body.id || parsedUrl.searchParams.get('id');
            if (userId === session.userId) return sendError('Cannot delete your own user account', 400);
            db.users = db.users.filter((u) => !(u.id === userId && (session.role === 'Super Admin' || u.companyId === sessionCompanyId)));
            saveDb(db);
            return sendJson({ success: true });
          }
        }

        // --- COMPANIES ---
        if (pathname.endsWith('companies.php')) {
          if (action === 'list') {
            const list = session.role === 'Super Admin'
              ? db.companies
              : db.companies.filter((c) => c.id === sessionCompanyId);
            return sendJson({ success: true, companies: list });
          }
          if (action === 'create') {
            if (session.role !== 'Super Admin') return sendError('Unauthorized', 403);
            const body = await readBody(req);
            const newComp = {
              id: body.id || 'CMP-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
              name: body.name,
              status: 'Active',
              createdAt: new Date().toISOString(),
            };
            db.companies.push(newComp);
            saveDb(db);
            return sendJson({ success: true, company: newComp });
          }
        }

        // --- AUDIT ---
        if (pathname.endsWith('audit.php')) {
          const body = await readBody(req);
          if (action === 'log') {
            const newAudit = {
              ...body,
              id: body.id || 'AUD-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
              companyId: sessionCompanyId,
              userId: session.userId,
              userName: session.name,
              userRole: session.role,
              timestamp: new Date().toISOString(),
            };
            db.auditLogs.unshift(newAudit);
            saveDb(db);
            return sendJson({ success: true, id: newAudit.id });
          }
          if (action === 'clear') {
            db.auditLogs = db.auditLogs.filter((a) => a.companyId !== sessionCompanyId);
            saveDb(db);
            return sendJson({ success: true });
          }
        }

        // --- MIGRATE ---
        if (pathname.endsWith('migrate.php')) {
          const body = await readBody(req);
          let count = { chits: 0, members: 0, transactions: 0, payouts: 0 };
          if (Array.isArray(body.chits)) {
            body.chits.forEach((c: any) => {
              if (!db.chits.some((x) => x.id === c.id && x.companyId === sessionCompanyId)) {
                db.chits.push({ ...c, companyId: sessionCompanyId });
                count.chits++;
              }
            });
          }
          if (Array.isArray(body.members)) {
            body.members.forEach((m: any) => {
              if (!db.members.some((x) => x.id === m.id && x.companyId === sessionCompanyId)) {
                db.members.push({ ...m, companyId: sessionCompanyId });
                count.members++;
              }
            });
          }
          if (Array.isArray(body.transactions)) {
            body.transactions.forEach((t: any) => {
              if (!db.transactions.some((x) => x.id === t.id && x.companyId === sessionCompanyId)) {
                db.transactions.push({ ...t, companyId: sessionCompanyId });
                count.transactions++;
              }
            });
          }
          if (Array.isArray(body.payouts)) {
            body.payouts.forEach((p: any) => {
              if (!db.payouts.some((x) => x.id === p.id && x.companyId === sessionCompanyId)) {
                db.payouts.push({ ...p, companyId: sessionCompanyId });
                count.payouts++;
              }
            });
          }
          if (body.companySettings) {
            db.companySettings[sessionCompanyId] = body.companySettings;
          }
          saveDb(db);
          return sendJson({ success: true, message: 'LocalStorage migrated successfully', imported: count });
        }

        return sendError('Unknown API endpoint', 404);
      });
    },
  };
}
