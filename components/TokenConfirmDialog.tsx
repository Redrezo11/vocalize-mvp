import React from 'react';

interface TokenConfirmDialogProps {
  isOpen: boolean;
  tokenCost: number;
  currentBalance: number;
  isAdmin?: boolean;
  operationLabel: string;
  operationDetail?: string;
  isDark?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TokenConfirmDialog: React.FC<TokenConfirmDialogProps> = ({
  isOpen,
  tokenCost,
  currentBalance,
  isAdmin = false,
  operationLabel,
  operationDetail,
  isDark = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const remaining = currentBalance - tokenCost;
  const insufficient = !isAdmin && remaining < 0;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl max-w-md w-full p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div>
            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{operationLabel}</h2>
            {operationDetail && (
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{operationDetail}</p>
            )}
          </div>
        </div>

        {/* Token info */}
        <div className={`rounded-xl p-4 mb-5 space-y-2 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Cost</span>
            <span className="text-sm font-semibold text-amber-600">{tokenCost} token{tokenCost !== 1 ? 's' : ''}</span>
          </div>

          {isAdmin ? (
            <div className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Tokens used so far</span>
              <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{currentBalance}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Your balance</span>
                <span className="text-sm font-semibold text-emerald-600">{currentBalance} token{currentBalance !== 1 ? 's' : ''}</span>
              </div>
              <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Remaining after</span>
                <span className={`text-sm font-semibold ${insufficient ? 'text-red-500' : isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {remaining} token{remaining !== 1 && remaining !== -1 ? 's' : ''}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Insufficient warning */}
        {insufficient && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            Insufficient tokens. Contact your admin for more.
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={insufficient}
            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
              insufficient
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default TokenConfirmDialog;
