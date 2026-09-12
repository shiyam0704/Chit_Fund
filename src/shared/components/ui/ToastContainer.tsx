import React from 'react';
import { useChit } from '@/shared/context/ChitContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useChit();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const { bg, icon } = (() => {
          switch (toast.type) {
            case 'success':
              return {
                bg: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200',
                icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
              };
            case 'error':
              return {
                bg: 'bg-rose-950/90 border-rose-500/40 text-rose-200',
                icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
              };
            case 'warning':
              return {
                bg: 'bg-amber-950/90 border-amber-500/40 text-amber-200',
                icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
              };
            default:
              return {
                bg: 'bg-blue-950/90 border-blue-500/40 text-blue-200',
                icon: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
              };
          }
        })();

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-xl transition-all animate-slideUp ${bg}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold tracking-tight">{toast.title}</h4>
              <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-md opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
