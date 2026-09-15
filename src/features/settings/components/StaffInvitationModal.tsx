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
  ChevronDown,
} from 'lucide-react';
import {
  downloadChitUserFile,
  ChitUserFile,
  generateShortActivationCode,
  saveActivationCodeMapping,
} from '@/features/auth/utils/cryptoIdentityService';
import { ROOT_SUPERADMIN_ID, ADMIN_CREDENTIALS } from '@/features/auth/permissions';

interface StaffInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount | null;
  token?: string;
  chitUserFile?: ChitUserFile;
  onGenerateToken?: (
    userId: string,
    passwordPlaintext?: string
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
  const [copied, setCopied] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
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
      // Generate and register short code for legacy user
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

  const handleCopyCode = async () => {
    if (!displayCode) return;
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = displayCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyRawToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      alert('Raw cryptographic token copied to clipboard.');
    } catch {}
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
      const res = await onGenerateToken(user.id, passwordInput.trim() || undefined);
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
      setError(err.message || 'Failed to regenerate activation code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Staff Account Cross-Device Setup"
      subtitle={`Portable credential invitation for ${user.name} (${user.role})`}
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
              <span className="text-purple-400 font-semibold">{user.role === 'Custom Role' && user.customRoleName ? user.customRoleName : user.role}</span>
            </div>
          </div>
        </div>

        {/* Security & Integrity Guarantee Alert */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5 text-blue-300">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold">Cryptographically Protected:</span> This portable credential uses
            Web Crypto API (HMAC-SHA256 & PBKDF2) to guarantee integrity. Passwords are never sent in plaintext,
            and any tampering with Company ID, role, or permissions will cause validation to fail.
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Activation Code Display Card & Actions */}
        {token ? (
          <div className="space-y-3">
            {/* Clean, short Staff Activation Credential Card */}
            <div className="p-4 bg-[#0B0F17] border border-[#1F293D] rounded-xl space-y-4 shadow-xl shadow-black/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">Staff Activation Code</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Ready
                </span>
              </div>

              {/* Prominent Short Code Display */}
              <div className="py-4 px-3 bg-[#070A10] border border-[#1E293B] rounded-xl text-center flex flex-col items-center justify-center">
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-emerald-400 select-all cursor-pointer">
                  {displayCode}
                </span>
                <span className="text-[10px] text-slate-400 mt-1">
                  Share this short code with the staff member to activate their account on another device
                </span>
              </div>

              {/* Primary Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="h-11 min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs inline-flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer select-none leading-none border border-blue-500/30"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
                  <span>{copied ? 'Activation code copied!' : 'Copy Activation Code'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="h-11 min-h-[44px] px-4 rounded-xl bg-[#1F293D] hover:bg-[#2A3752] text-slate-100 font-semibold text-xs inline-flex items-center justify-center gap-2 border border-slate-700/60 hover:border-slate-600 transition-all cursor-pointer select-none leading-none"
                >
                  <Download className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Download .chituser File</span>
                </button>
              </div>
            </div>

            {/* Admin Controls: Regenerate Activation Code & Technical Details Toggle */}
            <div className="flex items-center justify-between px-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (user.salt && user.passwordVerifier) {
                    handleRegenerateClick();
                  } else {
                    setShowPasswordPrompt(!showPasswordPrompt);
                  }
                }}
                disabled={loading}
                className="text-xs font-semibold text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
                <span>{loading ? 'Regenerating Code...' : 'Regenerate Activation Code'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-[11px] text-slate-500 hover:text-slate-400 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>{showDetails ? 'Hide technical token' : 'View technical token'}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Password Prompt for Regeneration if user has no stored verifier */}
            {showPasswordPrompt && (
              <form onSubmit={handleRegenerateClick} className="p-3 bg-[#0B0F17] border border-[#1F293D] rounded-xl space-y-2 animate-fadeIn">
                <p className="text-[11px] text-slate-400">
                  Enter password to regenerate code for {user.name}:
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Enter staff password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-[#121827] border border-[#1F293D] rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={loading || !passwordInput.trim()}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-1"
                  >
                    Confirm
                  </button>
                </div>
              </form>
            )}

            {/* Collapsed Technical Token Details */}
            {showDetails && (
              <div className="p-3 bg-[#0B0F17] border border-[#1F293D] rounded-xl space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-mono">Full Cryptographic Token (for offline verification):</span>
                  <button
                    type="button"
                    onClick={handleCopyRawToken}
                    className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                  >
                    Copy raw token
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={2}
                  value={token}
                  className="w-full p-2 bg-[#070A10] border border-slate-800 rounded-lg text-slate-400 font-mono text-[10px] select-all focus:outline-none resize-none break-all"
                />
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleRegenerateClick} className="p-4 bg-[#0B0F17] border border-[#1F293D] rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <Info className="w-4 h-4 shrink-0" />
              <span>Generate Activation Credential</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Enter the staff account password to generate a fresh, tamper-proof portable credential token for cross-device login.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Enter staff password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#121827] border border-[#1F293D] rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="submit"
                disabled={loading || !passwordInput.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
              >
                {loading ? 'Generating...' : 'Generate Code'}
              </button>
            </div>
          </form>
        )}

        {/* Cross-Device Instructions for Staff */}
        <div className="p-3.5 bg-[#0B0F17]/70 border border-[#1F293D] rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span>How Staff Members Use This on Device B:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400 leading-relaxed pl-1">
            <li>Open the hosted Chit Fund website on Computer B / Phone.</li>
            <li>On the login screen, click <span className="text-blue-400 font-semibold">"Activate Existing Staff Account"</span>.</li>
            <li>Enter the short Activation Code (<span className="text-emerald-400 font-mono">{displayCode}</span>) or import the <span className="text-indigo-300 font-mono">.chituser</span> file.</li>
            <li>The account and company profile will be securely verified and imported into Device B.</li>
            <li>Log in using email (<span className="text-slate-200 font-mono">{user.email}</span>) and password.</li>
          </ol>
        </div>

        {/* Close Button */}
        <div className="pt-2 flex justify-end">
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
