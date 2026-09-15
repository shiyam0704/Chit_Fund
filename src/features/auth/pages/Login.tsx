import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Layers,
  Eye,
  EyeOff,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  FileCode,
  CheckCircle2,
  Building2,
  KeyRound,
  Upload,
  X,
} from 'lucide-react';
import { normalizeActivationCode } from '../utils/cryptoIdentityService';

export const Login: React.FC = () => {
  const { isAuthenticated, login, activateStaffAccount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Tab mode: 'login' | 'activate'
  const [mode, setMode] = useState<'login' | 'activate'>('login');

  // Sign in state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Cross-device account activation state
  const [activationToken, setActivationToken] = useState('');
  const [loadedFileName, setLoadedFileName] = useState('');
  const [activationError, setActivationError] = useState('');
  const [activationSuccess, setActivationSuccess] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  // If already logged in, redirect to attempted destination or home root
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [isAuthenticated, navigate, location]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    if (!cleanEmail || !cleanPassword || isLoading) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await login(cleanEmail, cleanPassword);
      if (result.success) {
        const from = (location.state as any)?.from?.pathname;
        if (from && from !== '/login') {
          navigate(from, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setErrorMessage(result.message || 'Invalid email or password');
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatSegmentedCode = (raw: string): string => {
    // If user is pasting full token or JSON, preserve it intact
    if (raw.startsWith('{') || raw.startsWith('CHIT1.')) return raw.trim();

    const upper = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!upper) return '';

    // If user typed "CHIT", strip prefix first to get payload characters
    let chars = upper;
    if (chars.startsWith('CHIT')) {
      chars = chars.slice(4);
    }

    // Cap at 8 code characters
    chars = chars.slice(0, 8);

    if (chars.length === 0) {
      return 'CHIT-';
    } else if (chars.length <= 4) {
      return `CHIT-${chars}`;
    } else {
      return `CHIT-${chars.slice(0, 4)}-${chars.slice(4)}`;
    }
  };

  const handleActivationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = normalizeActivationCode(activationToken.trim());
    if (!cleanToken || isActivating) return;

    setIsActivating(true);
    setActivationError('');
    setActivationSuccess(null);

    try {
      const result = await activateStaffAccount(cleanToken);
      if (result.success && result.user) {
        setActivationSuccess(result.message);
        setEmail(result.user.email);
        setActivationToken('');
        setLoadedFileName('');
        // Switch back to login mode after brief confirmation
        setTimeout(() => {
          setMode('login');
          setActivationSuccess(null);
          setTimeout(() => passwordInputRef.current?.focus(), 150);
        }, 1200);
      } else {
        setActivationError(result.message || 'Failed to activate staff account.');
      }
    } catch (err: any) {
      setActivationError(err.message || 'Error occurred during activation.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setActivationToken(content.trim());
        setActivationError('');
      }
    };
    reader.onerror = () => {
      setActivationError('Failed to read selected invitation file.');
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = '';
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0F17] flex items-center justify-center p-4 selection:bg-blue-500 selection:text-white relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fadeIn">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-600/30 mb-4 ring-4 ring-blue-500/20 transition-transform hover:scale-105">
            <Layers className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">
            Chit<span className="text-blue-400">Fund</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Multi-Company Financial Administration Portal
          </p>
        </div>

        {/* Login / Activation Card */}
        <div className="bg-[#121827] border border-[#1F293D] rounded-2xl p-7 sm:p-8 shadow-2xl shadow-black/60 backdrop-blur-xl">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center p-1 bg-[#0B0F17] border border-[#1F293D] rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('activate');
                setActivationError('');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'activate'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Activate Account</span>
            </button>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* MODE 1: NORMAL SIGN IN                                       */}
          {/* ------------------------------------------------------------- */}
          {mode === 'login' ? (
            <div>
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-100">Sign In</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enter your credentials to access your company dashboard.
                </p>
              </div>

              {/* Error Message Alert Banner */}
              {errorMessage && (
                <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-rose-400 text-xs animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span className="font-semibold">{errorMessage}</span>
                </div>
              )}

              {/* Success Notification after Activation */}
              {activationSuccess && (
                <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-emerald-400 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="font-semibold">{activationSuccess}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
                {/* Email ID Field */}
                <div>
                  <label htmlFor="login-username" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email ID / Username <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-username"
                      type="text"
                      required
                      autoFocus={!email}
                      placeholder="Enter email address or username"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-600 font-medium"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      className="w-full pl-10 pr-10 py-2.5 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-100 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-600 font-mono tracking-wide"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-slate-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || !email.trim() || !password}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Validating...</span>
                      </>
                    ) : (
                      <>
                        <span>Login</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Cross-Device Account Activation Prompt */}
              <div className="mt-6 pt-5 border-t border-[#1F293D] text-center">
                <p className="text-[11px] text-slate-400">
                  First time on this device or created by an Admin?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMode('activate');
                    setActivationError('');
                  }}
                  className="mt-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Activate Existing Staff Account &rarr;</span>
                </button>
              </div>
            </div>
          ) : (
            /* ------------------------------------------------------------- */
            /* MODE 2: ACTIVATE EXISTING STAFF ACCOUNT (CROSS-DEVICE)         */
            /* ------------------------------------------------------------- */
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-400" />
                  <span>Activate Staff Account</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Paste the activation credential or upload the <span className="text-indigo-400 font-mono">.chituser</span> file provided by your company admin.
                </p>
              </div>

              {activationError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-rose-400 text-xs animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span className="font-semibold">{activationError}</span>
                </div>
              )}

              {activationSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-emerald-400 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="font-semibold">{activationSuccess}</span>
                </div>
              )}

              <form onSubmit={handleActivationSubmit} className="space-y-4">
                {/* File Upload Option */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".chituser,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {loadedFileName ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="font-mono truncate">{loadedFileName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLoadedFileName('');
                        setActivationToken('');
                      }}
                      className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Clear loaded file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 border border-dashed border-slate-700 hover:border-blue-500/60 rounded-xl bg-[#0B0F17]/70 flex items-center justify-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer transition-all group"
                    >
                      <Upload className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                      <span>Upload or drop <span className="font-mono text-indigo-400 font-semibold">.chituser</span> invitation file</span>
                    </div>

                    <div className="relative flex items-center justify-center">
                      <div className="border-t border-[#1F293D] w-full" />
                      <span className="bg-[#121827] px-2 text-[10px] text-slate-500 uppercase font-semibold">
                        OR ENTER SHORT CODE
                      </span>
                      <div className="border-t border-[#1F293D] w-full" />
                    </div>
                  </>
                )}

                {/* Short Activation Code Input */}
                <div>
                  <label htmlFor="activation-code" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Staff Activation Code <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="activation-code"
                      type="text"
                      required
                      placeholder="CHIT-XXXX-XXXX"
                      value={activationToken}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.startsWith('{') || val.startsWith('CHIT1.')) {
                          setActivationToken(val.trim());
                        } else {
                          setActivationToken(formatSegmentedCode(val));
                        }
                        if (activationError) setActivationError('');
                      }}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-100 text-sm font-mono tracking-wider focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-slate-600 uppercase"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Enter the code provided by your admin (e.g. <span className="font-mono text-emerald-400">CHIT-A7K9-M2Q4</span>)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isActivating || !activationToken.trim()}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isActivating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying Cryptographic Identity...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify & Activate Local Account</span>
                    </>
                  )}
                </button>
              </form>

              {/* Back to Sign In Link */}
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setActivationError('');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 font-semibold cursor-pointer transition-colors"
                >
                  &larr; Return to Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
