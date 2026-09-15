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
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        const parsedUrl = new URL(urlStr, 'http://localhost:5173');
        const pathname = parsedUrl.pathname;
        const action = parsedUrl.searchParams.get('action') || '';
        const rawAuth = (req.headers['authorization'] as string) || (req.headers['x-auth-token'] as string) || '';
        const token = rawAuth.replace(/^Bearer\s+/i, '').trim();

        const db = loadDb();

        const sendJson = (data: any, code = 200) => {
          res.statusCode = code;
          res.end(JSON.stringify(data));
        };

        const sendError = (msg: string, code = 400) => {
          res.statusCode = code;
          res.end(JSON.stringify({ error: true, message: msg }));
        };

        const PERM_ALIASES: Record<string, string[]> = {
          'dashboard.view': ['dashboard.view', 'VIEW_DASHBOARD', 'DASHBOARD_VIEW'],
          'chits.view': ['chits.view', 'VIEW_CHITS', 'CHITS_VIEW'],
          'chits.create': ['chits.create', 'CHITS_CREATE', 'CREATE_CHITS'],
          'chits.edit': ['chits.edit', 'CHITS_EDIT', 'EDIT_CHITS'],
          'chits.delete': ['chits.delete', 'CHITS_DELETE', 'DELETE_CHITS'],
          'members.view': ['members.view', 'VIEW_MEMBERS', 'MEMBERS_VIEW'],
          'members.create': ['members.create', 'MEMBERS_CREATE', 'CREATE_MEMBERS'],
          'members.edit': ['members.edit', 'MEMBERS_EDIT', 'EDIT_MEMBERS'],
          'members.delete': ['members.delete', 'MEMBERS_DELETE', 'DELETE_MEMBERS'],
          'payments.view': ['payments.view', 'VIEW_PAYMENTS', 'PAYMENTS_VIEW', 'collections.view', 'COLLECTIONS_VIEW', 'VIEW_COLLECTIONS'],
          'payments.create': ['payments.create', 'PAYMENTS_CREATE', 'CREATE_PAYMENTS', 'collections.create', 'COLLECTIONS_CREATE', 'CREATE_COLLECTIONS', 'collections.collect'],
          'payments.edit': ['payments.edit', 'PAYMENTS_EDIT', 'EDIT_PAYMENTS', 'collections.edit', 'COLLECTIONS_EDIT', 'EDIT_COLLECTIONS'],
          'payments.delete': ['payments.delete', 'PAYMENTS_DELETE', 'DELETE_PAYMENTS', 'collections.delete', 'COLLECTIONS_DELETE', 'DELETE_COLLECTIONS'],
          'reports.view': ['reports.view', 'VIEW_REPORTS', 'REPORTS_VIEW'],
          'reports.export': ['reports.export', 'REPORTS_EXPORT', 'EXPORT_REPORTS'],
          'settings.view': ['settings.view', 'VIEW_SETTINGS', 'SETTINGS_VIEW'],
          'settings.edit': ['settings.edit', 'SETTINGS_EDIT', 'EDIT_SETTINGS'],
          'users.view': ['users.view', 'VIEW_USERS', 'USERS_VIEW'],
          'users.create': ['users.create', 'USERS_CREATE', 'CREATE_USERS'],
          'users.edit': ['users.edit', 'USERS_EDIT', 'EDIT_USERS'],
          'users.delete': ['users.delete', 'USERS_DELETE', 'DELETE_USERS'],
          'audit_trail.view': ['audit_trail.view', 'VIEW_AUDIT_TRAIL', 'AUDIT_TRAIL_VIEW'],
          'backup.view': ['backup.view', 'VIEW_BACKUP', 'BACKUP_VIEW'],
        };

        const hasPerm = (sess: any, perm: string): boolean => {
          if (sess.role === 'Super Admin' || sess.email === SUPERADMIN_EMAIL) return true;
          const perms = sess.permissions || [];
          if (!Array.isArray(perms)) return false;
          if (perms.includes(perm)) return true;
          for (const [canonical, list] of Object.entries(PERM_ALIASES)) {
            if (perm === canonical || list.includes(perm)) {
              if (list.some((a) => perms.includes(a))) return true;
            }
          }
          for (const p of perms) {
            if (PERM_ALIASES[p] && PERM_ALIASES[p].includes(perm)) return true;
          }
          return false;
        };

        // --- AUTH ---
        if (pathname.endsWith('auth.php')) {
          if (action === 'login' && req.method === 'POST') {
            const body = await readBody(req);
            const email = (body.email || body.username || '').toLowerCase().trim();
            const password = (body.password || '').trim();

            // Super Admin
            if ((email === SUPERADMIN_EMAIL || email === 'chitfundadmin@123' || email === 'admin@chitfund.com' || email === 'admin') && password === SUPERADMIN_PASS) {
              const comp = db.companies.find((c) => c.id === 'CMP-001') || { id: 'CMP-001', name: 'Chit Fund Management', status: 'Active' };
              const allPerms = [
                'dashboard.view', 'chits.view', 'chits.create', 'chits.edit', 'chits.delete',
                'members.view', 'members.create', 'members.edit', 'members.delete',
                'payments.view', 'payments.create', 'payments.edit', 'payments.delete',
                'reports.view', 'reports.export', 'settings.view', 'settings.edit',
                'users.view', 'users.create', 'users.edit', 'users.delete',
                'audit_trail.view', 'backup.view'
              ];
              const user = db.users.find((u) => u.email === SUPERADMIN_EMAIL) || {
                id: 'USR-ROOT-001',
                companyId: 'CMP-001',
                name: 'Super Administrator',
                email: SUPERADMIN_EMAIL,
                role: 'Super Admin',
                permissions: allPerms,
              };
              const tokenStr = createToken({
                userId: user.id,
                companyId: 'CMP-001',
                email: SUPERADMIN_EMAIL,
                name: user.name,
                role: 'Super Admin',
                permissions: allPerms,
              });
              return sendJson({
                success: true,
                token: tokenStr,
                user: {
                  ...user,
                  email: SUPERADMIN_EMAIL,
                  role: 'Super Admin',
                  permissions: allPerms,
                  companyName: comp.name
                },
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
            const dbUser = db.users.find((u) => u.id === session.userId || u.email.toLowerCase() === session.email.toLowerCase());
            const comp = db.companies.find((c) => c.id === session.companyId);
            return sendJson({
              success: true,
              user: {
                id: session.userId,
                companyId: session.companyId,
                companyName: comp?.name || 'Chit Fund Management',
                name: dbUser?.name || session.name,
                email: session.email,
                role: dbUser?.role || session.role,
                status: dbUser?.status || 'Active',
                permissions: dbUser ? dbUser.permissions : session.permissions,
                createdAt: dbUser ? dbUser.createdAt : new Date().toISOString(),
              },
              company: comp,
            });
          }
        }

        // --- PUBLIC / ADMIN COMPANY REGISTRATION ---
        if (pathname.endsWith('companies.php') && action === 'register' && req.method === 'POST') {
          const body = await readBody(req);
          const companyName = (body.companyName || body.name || '').trim();
          const adminName = (body.adminName || body.name || 'Company Admin').trim();
          const adminEmail = (body.adminEmail || body.email || '').toLowerCase().trim();
          const adminPassword = (body.adminPassword || body.password || '').trim();

          if (!companyName) return sendError('Company name is required', 400);
          if (!adminEmail || !adminPassword) return sendError('Admin email and password are required', 400);
          if (adminPassword.length < 4) return sendError('Password must be at least 4 characters long', 400);

          if (db.users.some((u) => u.email.toLowerCase() === adminEmail) || adminEmail === SUPERADMIN_EMAIL) {
            return sendError('A user with this email address already exists. Please choose a different email.', 409);
          }

          const companyId = body.companyId || ('CMP-' + Math.random().toString(36).substring(2, 8).toUpperCase());
          const userId = 'USR-' + Math.random().toString(36).substring(2, 10).toUpperCase();
          const passwordHash = crypto.createHash('sha256').update(adminPassword).digest('hex');

          const allAdminPerms = [
            'dashboard.view', 'VIEW_DASHBOARD',
            'chits.view', 'VIEW_CHITS', 'chits.create', 'CHITS_CREATE', 'chits.edit', 'CHITS_EDIT', 'chits.delete', 'CHITS_DELETE',
            'members.view', 'VIEW_MEMBERS', 'members.create', 'MEMBERS_CREATE', 'members.edit', 'MEMBERS_EDIT', 'members.delete', 'MEMBERS_DELETE',
            'payments.view', 'VIEW_PAYMENTS', 'payments.create', 'PAYMENTS_CREATE', 'payments.edit', 'PAYMENTS_EDIT', 'payments.delete', 'PAYMENTS_DELETE',
            'reports.view', 'VIEW_REPORTS', 'reports.export', 'REPORTS_EXPORT',
            'settings.view', 'VIEW_SETTINGS', 'settings.edit', 'SETTINGS_EDIT',
            'users.view', 'VIEW_USERS', 'users.create', 'USERS_CREATE', 'users.edit', 'USERS_EDIT', 'users.delete', 'USERS_DELETE',
            'audit_trail.view', 'VIEW_AUDIT_TRAIL', 'audit_trail.export', 'AUDIT_EXPORT',
          ];

          const newComp = { id: companyId, name: companyName, status: 'Active', createdAt: new Date().toISOString() };
          const newAdmin = {
            id: userId,
            companyId: companyId,
            name: adminName,
            email: adminEmail,
            passwordHash: passwordHash,
            role: 'Admin / Manager',
            status: 'Active',
            permissions: allAdminPerms,
            createdAt: new Date().toISOString(),
          };

          db.companies.push(newComp);
          db.users.unshift(newAdmin);
          saveDb(db);

          return sendJson({
            success: true,
            message: 'Company and Admin registered successfully',
            company: newComp,
            admin: {
              id: userId,
              companyId: companyId,
              name: adminName,
              email: adminEmail,
              role: 'Admin / Manager',
            },
          }, 201);
        }

        // Require authentication for all endpoints below
        const session = verifyToken(token);
        if (!session) {
          return sendError('Unauthorized: Missing or invalid token', 401);
        }
        const sessionCompanyId = session.companyId;

        // --- SYNC ---
        if (pathname.endsWith('sync.php')) {
          const canViewChits = hasPerm(session, 'chits.view');
          const canViewMembers = hasPerm(session, 'members.view');
          const canViewPayments = hasPerm(session, 'payments.view');
          const canViewAudit = hasPerm(session, 'audit_trail.view');

          const companyChits = canViewChits ? db.chits.filter((c) => c.companyId === sessionCompanyId) : [];
          const companyMembers = canViewMembers ? db.members.filter((m) => m.companyId === sessionCompanyId) : [];
          const companyTxns = canViewPayments ? db.transactions.filter((t) => t.companyId === sessionCompanyId) : [];
          const companyPayouts = (canViewPayments || canViewChits) ? db.payouts.filter((p) => p.companyId === sessionCompanyId) : [];
          const settings = db.companySettings[sessionCompanyId] || null;
          const audit = canViewAudit ? db.auditLogs.filter((a) => a.companyId === sessionCompanyId).slice(-200) : [];

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
            if (!hasPerm(session, 'CHITS_CREATE')) return sendError('Forbidden: Insufficient permissions for CHITS_CREATE', 403);
            const chitId = body.id || 'CHIT-' + Math.random().toString(36).substring(2, 9).toUpperCase();
            const existingChit = db.chits.find((c) => c.id === chitId);
            if (existingChit) {
              if (existingChit.companyId !== sessionCompanyId) {
                return sendError('Forbidden: Chit exists under another company', 403);
              }
              const idx = db.chits.indexOf(existingChit);
              db.chits[idx] = { ...existingChit, ...body, companyId: sessionCompanyId };
              saveDb(db);
              return sendJson({ success: true, id: chitId });
            }
            const newChit = {
              ...body,
              id: chitId,
              companyId: sessionCompanyId,
              createdAt: new Date().toISOString(),
            };
            db.chits.unshift(newChit);
            saveDb(db);
            return sendJson({ success: true, id: newChit.id });
          }
          if (action === 'update') {
            if (!hasPerm(session, 'CHITS_EDIT')) return sendError('Forbidden: Insufficient permissions for CHITS_EDIT', 403);
            const idx = db.chits.findIndex((c) => c.id === body.id && c.companyId === sessionCompanyId);
            if (idx === -1) return sendError('Chit not found or does not belong to your company', 404);
            db.chits[idx] = { ...db.chits[idx], ...body, companyId: sessionCompanyId };
            saveDb(db);
            return sendJson({ success: true, id: body.id });
          }
          if (action === 'delete') {
            if (!hasPerm(session, 'CHITS_DELETE')) return sendError('Forbidden: Insufficient permissions for CHITS_DELETE', 403);
            const chitId = body.id || parsedUrl.searchParams.get('id');
            const targetChit = db.chits.find((c) => c.id === chitId && c.companyId === sessionCompanyId);
            if (!targetChit) return sendError('Chit not found or does not belong to your company', 404);
            db.chits = db.chits.filter((c) => !(c.id === chitId && c.companyId === sessionCompanyId));
            saveDb(db);
            return sendJson({ success: true, message: 'Chit deleted successfully' });
          }
        }

        // --- MEMBERS ---
        if (pathname.endsWith('members.php')) {
          const body = await readBody(req);
          if (action === 'create') {
            if (!hasPerm(session, 'MEMBERS_CREATE')) return sendError('Forbidden: Insufficient permissions for MEMBERS_CREATE', 403);
            const memId = body.id || 'MEM-' + Math.random().toString(36).substring(2, 9).toUpperCase();

            // Cross-company validation: Chit must belong to the same company
            if (body.chitId) {
              const chitMatch = db.chits.find((c) => c.id === body.chitId && c.companyId === sessionCompanyId);
              if (!chitMatch) {
                return sendError('Invalid chit assignment: Chit does not exist or belongs to another company', 400);
              }
            }

            const existingMem = db.members.find((m) => m.id === memId);
            if (existingMem) {
              if (existingMem.companyId !== sessionCompanyId) {
                return sendError('Forbidden: Member exists under another company', 403);
              }
              const idx = db.members.indexOf(existingMem);
              db.members[idx] = { ...existingMem, ...body, companyId: sessionCompanyId };
              saveDb(db);
              return sendJson({ success: true, id: memId });
            }
            const newMember = {
              ...body,
              id: memId,
              companyId: sessionCompanyId,
              createdAt: new Date().toISOString(),
            };
            db.members.unshift(newMember);
            saveDb(db);
            return sendJson({ success: true, id: newMember.id });
          }
          if (action === 'update') {
            if (!hasPerm(session, 'MEMBERS_EDIT')) return sendError('Forbidden: Insufficient permissions for MEMBERS_EDIT', 403);
            const idx = db.members.findIndex((m) => m.id === body.id && m.companyId === sessionCompanyId);
            if (idx === -1) return sendError('Member not found or does not belong to your company', 404);

            if (body.chitId) {
              const chitMatch = db.chits.find((c) => c.id === body.chitId && c.companyId === sessionCompanyId);
              if (!chitMatch) {
                return sendError('Invalid chit assignment: Chit does not exist or belongs to another company', 400);
              }
            }

            db.members[idx] = { ...db.members[idx], ...body, companyId: sessionCompanyId };
            saveDb(db);
            return sendJson({ success: true, id: body.id });
          }
          if (action === 'delete') {
            if (!hasPerm(session, 'MEMBERS_DELETE')) return sendError('Forbidden: Insufficient permissions for MEMBERS_DELETE', 403);
            const memId = body.id || parsedUrl.searchParams.get('id');
            const targetMem = db.members.find((m) => m.id === memId && m.companyId === sessionCompanyId);
            if (!targetMem) return sendError('Member not found or does not belong to your company', 404);
            db.members = db.members.filter((m) => !(m.id === memId && m.companyId === sessionCompanyId));
            saveDb(db);
            return sendJson({ success: true, message: 'Member deleted successfully' });
          }
        }

        // --- TRANSACTIONS ---
        if (pathname.endsWith('transactions.php')) {
          const body = await readBody(req);
          if (action === 'create') {
            if (!hasPerm(session, 'PAYMENTS_CREATE')) return sendError('Forbidden: Insufficient permissions for PAYMENTS_CREATE', 403);
            const txnId = body.id || 'TXN-' + Math.random().toString(36).substring(2, 9).toUpperCase();

            // Cross-company validation: Chit & Member must belong to this company
            if (!db.chits.some((c) => c.id === body.chitId && c.companyId === sessionCompanyId)) {
              return sendError('Invalid transaction: Chit does not exist or belongs to another company', 400);
            }
            if (!db.members.some((m) => m.id === body.memberId && m.companyId === sessionCompanyId)) {
              return sendError('Invalid transaction: Member does not exist or belongs to another company', 400);
            }

            const existingIdx = db.transactions.findIndex((t) => t.id === txnId);
            if (existingIdx !== -1) {
              return sendJson({ success: true, id: txnId });
            }
            const newTxn = {
              ...body,
              id: txnId,
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
            if (!hasPerm(session, 'PAYMENTS_EDIT')) return sendError('Forbidden: Insufficient permissions for PAYMENTS_EDIT', 403);
            const idx = db.transactions.findIndex((t) => t.id === body.id && t.companyId === sessionCompanyId);
            if (idx === -1) return sendError('Transaction not found or does not belong to your company', 404);
            db.transactions[idx] = { ...db.transactions[idx], ...body, companyId: sessionCompanyId };
            saveDb(db);
            return sendJson({ success: true, id: body.id });
          }
          if (action === 'delete') {
            if (!hasPerm(session, 'PAYMENTS_DELETE')) return sendError('Forbidden: Insufficient permissions for PAYMENTS_DELETE', 403);
            const txnId = body.id || parsedUrl.searchParams.get('id');
            const targetTxn = db.transactions.find((t) => t.id === txnId && t.companyId === sessionCompanyId);
            if (!targetTxn) return sendError('Transaction not found or does not belong to your company', 404);
            db.transactions = db.transactions.filter((t) => !(t.id === txnId && t.companyId === sessionCompanyId));
            saveDb(db);
            return sendJson({ success: true, message: 'Transaction deleted successfully' });
          }
        }

        // --- PAYOUTS ---
        if (pathname.endsWith('payouts.php')) {
          const body = await readBody(req);
          if (action === 'create') {
            if (!hasPerm(session, 'PAYMENTS_CREATE')) return sendError('Forbidden: Insufficient permissions for PAYMENTS_CREATE', 403);

            // Cross-company validation
            if (!db.chits.some((c) => c.id === body.chitId && c.companyId === sessionCompanyId)) {
              return sendError('Invalid payout: Chit does not exist or belongs to another company', 400);
            }
            if (!db.members.some((m) => m.id === body.memberId && m.companyId === sessionCompanyId)) {
              return sendError('Invalid payout: Member does not exist or belongs to another company', 400);
            }

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
            if (!hasPerm(session, 'PAYMENTS_DELETE')) return sendError('Forbidden: Insufficient permissions for PAYMENTS_DELETE', 403);
            const chitId = body.chitId || parsedUrl.searchParams.get('chitId');
            const monthNumber = Number(body.monthNumber || parsedUrl.searchParams.get('monthNumber'));
            const targetPayout = db.payouts.find((p) => p.chitId === chitId && p.monthNumber === monthNumber && p.companyId === sessionCompanyId);
            if (!targetPayout) return sendError('Payout not found or does not belong to your company', 404);
            db.payouts = db.payouts.filter((p) => !(p.chitId === chitId && p.monthNumber === monthNumber && p.companyId === sessionCompanyId));
            saveDb(db);
            return sendJson({ success: true, message: 'Payout removed successfully' });
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
            if (!hasPerm(session, 'users.view')) return sendError('Forbidden: Insufficient permissions for users.view', 403);
            // STRICTLY scoped to sessionCompanyId - zero cross-tenant leakage!
            const list = db.users.filter((u) => u.companyId === sessionCompanyId);
            return sendJson({ success: true, companyId: sessionCompanyId, users: list });
          }
          if (action === 'create') {
            if (!hasPerm(session, 'users.create')) return sendError('Forbidden: Insufficient permissions for users.create', 403);
            const body = await readBody(req);
            const email = (body.email || '').toLowerCase().trim();
            if (db.users.some((u) => u.email.toLowerCase() === email) || email === SUPERADMIN_EMAIL) {
              return sendError('A user with this email address already exists', 409);
            }
            const newUser = {
              id: body.id || 'USR-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
              // Inherit authenticated admin companyId strictly!
              companyId: sessionCompanyId,
              name: body.name,
              email: email,
              passwordHash: crypto.createHash('sha256').update(body.password).digest('hex'),
              role: body.role || 'Staff',
              customRoleName: body.customRoleName || undefined,
              status: body.status || 'Active',
              permissions: body.permissions || ['dashboard.view', 'members.view', 'payments.view', 'payments.create', 'reports.view'],
              createdAt: new Date().toISOString(),
            };
            db.users.unshift(newUser);
            saveDb(db);
            return sendJson({ success: true, id: newUser.id, user: newUser });
          }
          if (action === 'update' || action === 'update_permissions') {
            if (!hasPerm(session, 'users.edit')) return sendError('Forbidden: Insufficient permissions for users.edit', 403);
            const body = await readBody(req);
            const idx = db.users.findIndex((u) => u.id === body.id && u.companyId === sessionCompanyId);
            if (idx === -1) return sendError('User not found or does not belong to your company', 404);
            const u = db.users[idx];
            if (body.id === 'USR-ROOT-001' || u.email === SUPERADMIN_EMAIL) {
              if (body.status === 'Disabled') return sendError('Super Admin account cannot be disabled', 400);
            }
            if (body.password) {
              u.passwordHash = crypto.createHash('sha256').update(body.password).digest('hex');
            }
            if (body.name !== undefined) u.name = body.name;
            if (body.role !== undefined && u.id !== 'USR-ROOT-001') u.role = body.role;
            if (body.status !== undefined && u.id !== 'USR-ROOT-001') u.status = body.status;
            if (body.permissions !== undefined) u.permissions = body.permissions;
            if (body.customRoleName !== undefined) u.customRoleName = body.customRoleName;
            saveDb(db);
            return sendJson({ success: true, id: u.id, message: 'User updated successfully' });
          }
          if (action === 'reset_password') {
            if (!hasPerm(session, 'users.edit')) return sendError('Forbidden: Insufficient permissions for users.edit', 403);
            const body = await readBody(req);
            const u = db.users.find((user) => user.id === body.id && user.companyId === sessionCompanyId);
            if (!u) return sendError('User not found or does not belong to your company', 404);
            if (!body.password) return sendError('Password required', 400);
            u.passwordHash = crypto.createHash('sha256').update(body.password).digest('hex');
            saveDb(db);
            return sendJson({ success: true, message: 'Password reset successfully' });
          }
          if (action === 'toggle_status') {
            if (!hasPerm(session, 'users.edit')) return sendError('Forbidden: Insufficient permissions for users.edit', 403);
            const body = await readBody(req);
            const u = db.users.find((user) => user.id === body.id && user.companyId === sessionCompanyId);
            if (!u) return sendError('User not found or does not belong to your company', 404);
            if (u.id === 'USR-ROOT-001' || u.email === SUPERADMIN_EMAIL || u.id === session.userId) {
              return sendError('Cannot change status of Super Admin or own account', 400);
            }
            u.status = u.status === 'Active' ? 'Disabled' : 'Active';
            saveDb(db);
            return sendJson({ success: true, newStatus: u.status, message: `User status updated to ${u.status}` });
          }
          if (action === 'delete') {
            if (!hasPerm(session, 'users.delete')) return sendError('Forbidden: Insufficient permissions for users.delete', 403);
            const body = await readBody(req);
            const userId = body.id || parsedUrl.searchParams.get('id');
            if (userId === session.userId || userId === 'USR-ROOT-001') return sendError('Cannot delete Super Admin or your own account', 400);
            const targetUser = db.users.find((u) => u.id === userId && u.companyId === sessionCompanyId);
            if (!targetUser) return sendError('User not found or does not belong to your company', 404);
            db.users = db.users.filter((u) => !(u.id === userId && u.companyId === sessionCompanyId));
            saveDb(db);
            return sendJson({ success: true, message: 'User deleted successfully' });
          }
        }

        // --- REPORTS ---
        if (pathname.endsWith('reports.php')) {
          if (!hasPerm(session, 'reports.view')) {
            return sendError('Forbidden: Insufficient permissions for reports.view', 403);
          }
          if (action === 'export') {
            if (!hasPerm(session, 'reports.export')) {
              return sendError('Forbidden: Insufficient permissions for reports.export', 403);
            }
            return sendJson({ success: true, message: 'Export authorized' });
          }
          const chits = db.chits.filter((c) => c.companyId === sessionCompanyId);
          const members = db.members.filter((m) => m.companyId === sessionCompanyId);
          const txns = db.transactions.filter((t) => t.companyId === sessionCompanyId);
          return sendJson({
            success: true,
            companyId: sessionCompanyId,
            summary: {
              totalChits: chits.length,
              totalChitValue: chits.reduce((sum, c) => sum + (Number(c.chitAmount) || 0), 0),
              totalCollected: chits.reduce((sum, c) => sum + (Number(c.collectedAmount) || 0), 0),
              totalMembers: members.length,
              totalTransactions: txns.length,
              totalRevenue: txns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
            }
          });
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
