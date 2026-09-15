import React, { useState } from 'react';
import { UserAccount } from '@/types';
import { Modal } from '@/shared/components/ui';
import {
  KeyRound,
  Copy,
  Check,
  Download,
  Building2,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Info,
  RefreshCw,
  Globe,
  Share2,
} from 'lucide-react';
import {
  downloadChitUserFile,
  ChitUserFile,
  generateShortActivationCode,
  saveActivationCodeMapping,
} from '@/features/auth/utils/cryptoIdentityService';

interface StaffInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount | null;
  token?: string;
  chitUserFile?: ChitUserFile;
  onGenerateToken?: (
    userId: string,
    passwordPlaintext?: string,
    fallbackUser?: UserAccount
  ) => Promise<{ token?: string; chitUserFile?: ChitUserFile; activationCode?: string; error?: string }>;
}

export const StaffInvitationModal: React.FC<StaffInvitationModalProps> = ({
  isOpen,
  onClose,
  user,
  token: initialToken,
  chitUserFile: initialChitUserFile,
  onGenerateToken,
}) => {
  const [token, setToken] = useState<string>(initialToken || user?.activationToken || '');
  const [chitUserFile, setChitUserFile] = useState<ChitUserFile | undefined>(initialChitUserFile);
  const [activationCode, setActivationCode] = useState<string>(
    initialChitUserFile?.payload?.activationCode || user?.activationCode || ''
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [showOfflineOptions, setShowOfflineOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync state if props change
  React.useEffect(() => {
    if (initialToken) setToken(initialToken);
    else if (user?.activationToken) setToken(user.activationToken);
    if (initialChitUserFile) setChitUserFile(initialChitUserFile);

    const existingCode = initialChitUserFile?.payload?.activationCode || user?.activationCode;
    if (existingCode) {
      setActivationCode(existingCode);
    } else if (user && (initialToken || user.activationToken)) {
      const freshCode = generateShortActivationCode();
      setActivationCode(freshCode);
      const activeToken = initialToken || user.activationToken || '';
      const payloadFile: ChitUserFile = initialChitUserFile || {
        app: 'CHIT_FUND_MANAGEMENT',
        format: 'CHIT_USER_INVITATION_V1',
        payload: {
          version: 1,
          type: 'CHIT_STAFF_INVITATION',
          userId: user.id,
          companyId: user.companyId,
          companyName: user.companyName || 'Company',
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          permissions: user.permissions,
          salt: user.salt || '',
          verifier: user.passwordVerifier || '',
          issuedAt: new Date().toISOString(),
          activationCode: freshCode,
        },
        signature: (activeToken && typeof activeToken === 'string' && activeToken.includes('.')) ? activeToken.split('.')[2] || '' : '',
        token: activeToken,
      };
      saveActivationCodeMapping({
        code: freshCode,
        userId: user.id,
        companyId: user.companyId,
        token: activeToken,
        chitUserFile: payloadFile,
        createdAt: new Date().toISOString(),
      });
    }
    setError('');
  }, [initialToken, initialChitUserFile, user]);

  if (!user) return null;

  const displayCode = activationCode || user.activationCode || 'CHIT-XXXX-XXXX';
  const loginUrl = `${window.location.origin}/login`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    }
  };

  const handleCopyLoginUrl = async () => {
    await copyToClipboard(loginUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyEmail = async () => {
    await copyToClipboard(user.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopyInvitationMessage = async () => {
    const message = [
      `🏢 *Chit Fund Management Portal Login*`,
      ``,
      `Hello ${user.name}, you have been assigned an account:`,
      `🌐 *Login URL:* ${loginUrl}`,
      `📧 *Email:* ${user.email}`,
      `🔑 *Role:* ${user.role}`,
      `🔒 *Password:* (Use the password provided by your Administrator)`,
      ``,
      `Open the link on any computer, tablet, or smartphone to sign in directly.`,
    ].join('\n');

    await copyToClipboard(message);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 3000);
  };

  const handleCopyCode = async () => {
    if (!displayCode) return;
    await copyToClipboard(displayCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleDownloadFile = () => {
    if (!user) return;
    const staffPassword = passwordInput.trim() || '';

    downloadChitUserFile({
      name: user.name,
      role: user.role === 'Custom Role' && user.customRoleName ? user.customRoleName : user.role,
      companyName: user.companyName || 'Chit Fund Management',
      email: user.email,
      password: staffPassword,
      token: displayCode,
    });
  };

  const handleRegenerateClick = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!onGenerateToken || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await onGenerateToken(user.id, passwordInput.trim() || undefined, user);
      if (res.error) {
        if (res.error.toLowerCase().includes('password') && !passwordInput) {
          setShowPasswordPrompt(true);
        } else {
          setError(res.error);
        }
      } else if (res.token) {
        setToken(res.token);
        setChitUserFile(res.chitUserFile);
        if (res.activationCode) {
          setActivationCode(res.activationCode);
        } else if (res.chitUserFile?.payload?.activationCode) {
          setActivationCode(res.chitUserFile.payload.activationCode);
        }
        setShowPasswordPrompt(false);
        setPasswordInput('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate activation code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Staff Account Cross-Device Access"
      subtitle={`Login credentials and cross-device setup for ${user.name} (${user.role})`}
      maxWidth="lg"
    >
      <div className="space-y-5 py-1 text-slate-200 text-xs">
        {/* Company & Account Identity Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#0B0F17] border border-[#1F293D] rounded-xl">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
              Assigned Company
            </span>
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="font-bold text-slate-100 text-xs truncate">
                {user.companyName || 'Primary Company'}
              </span>
            </div>
            <span className="font-mono text-[10px] text-blue-400/90 block mt-0.5">
              ID: {user.companyId}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
              Staff Member Identity
            </span>
            <div className="font-bold text-slate-100 text-xs mt-1 truncate">
              {user.name}
            </div>
            <div className="font-mono text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
              <span>{user.email}</span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-purple-400 font-semibold">
                {user.role === 'Custom Role' && user.customRoleName ? user.customRoleName : user.role}
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* PRIMARY METHOD: DIRECT CLOUD LOGIN (CENTRAL MYSQL / HOSTINGER)         */}
        {/* ======================================================================= */}
        <div className="p-4 bg-gradient-to-br from-[#0B1426] via-[#09101D] to-[#070B14] border border-emerald-500/40 rounded-2xl shadow-xl space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-slate-100 text-sm">Direct Central Login (Hostinger Cloud)</span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Active in Database
            </span>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            This account is registered in your central Hostinger database. Staff members do <strong className="text-emerald-400 font-semibold">NOT need an activation code or file</strong>. They can log in directly on any computer, phone, or tablet using their Email and Password.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div className="p-2.5 bg-[#070A10] border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="overflow-hidden pr-2">
                <span className="text-[10px] text-slate-400 block font-semibold">PORTAL LOGIN URL</span>
                <span className="font-mono text-xs text-blue-400 truncate block">{loginUrl}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyLoginUrl}
                className="px-2.5 py-1 text-[11px] font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg shrink-0 transition-colors cursor-pointer"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : 'Copy'}
              </button>
            </div>

            <div className="p-2.5 bg-[#070A10] border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="overflow-hidden pr-2">
                <span className="text-[10px] text-slate-400 block font-semibold">USER EMAIL / USERNAME</span>
                <span className="font-mono text-xs text-slate-200 truncate block">{user.email}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg shrink-0 transition-colors cursor-pointer"
              >
                {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : 'Copy'}
              </button>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={handleCopyInvitationMessage}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {copiedMessage ? <Check className="w-4 h-4 text-white" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedMessage ? 'Login Invitation Copied to Clipboard!' : 'Copy Invitation Message for WhatsApp / SMS'}</span>
            </button>
          </div>
        </div>

        {/* Error message banner */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ======================================================================= */}
        {/* SECONDARY / OFFLINE ACTIVATION CODE SECTION                            */}
        {/* ======================================================================= */}
        <div className="p-3 bg-[#0B0F17] border border-[#1F293D] rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowOfflineOptions(!showOfflineOptions)}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>{showOfflineOptions ? 'Hide Offline Activation Code Options' : 'Need Offline Code or .chituser File? Click to expand'}</span>
            </button>
          </div>

          {showOfflineOptions && (
            <div className="pt-2 space-y-3 border-t border-[#1F293D]/80">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                If the device does not have immediate internet access, you can generate an offline activation credential:
              </p>

              {token ? (
                <div className="space-y-3">
                  <div className="py-3 px-3 bg-[#070A10] border border-[#1E293B] rounded-xl text-center flex flex-col items-center justify-center">
                    <span className="text-xl sm:text-2xl font-black font-mono tracking-widest text-emerald-400 select-all cursor-pointer">
                      {displayCode}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">
                      Share this code with staff to import on Device B via "Activate Existing Staff Account"
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadFile}
                      className="py-2 px-3 rounded-lg bg-[#1F293D] hover:bg-[#2A3752] text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Download .chituser</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRegenerateClick} className="p-3 bg-[#070A10] border border-[#1F293D] rounded-xl space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>Generate Offline Token</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Enter staff account password..."
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-[#121827] border border-[#1F293D] rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={loading || !passwordInput.trim()}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                      <span>{loading ? 'Generating...' : 'Generate'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Quick Help Guide */}
        <div className="p-3 bg-[#0B0F17]/70 border border-[#1F293D] rounded-xl space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span>How Staff Members Log In on Another Device:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400 leading-relaxed pl-1">
            <li>Open <span className="text-blue-400 font-mono">{loginUrl}</span> on Computer B or mobile phone.</li>
            <li>On the login page, enter email (<span className="text-slate-200 font-mono">{user.email}</span>) and the password set by Admin.</li>
            <li>Click <strong className="text-white">Sign In</strong>. The staff member will immediately access the permitted Chits & Members from the central database!</li>
          </ol>
        </div>

        {/* Close Button */}
        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1F293D] hover:bg-[#2A3752] text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
