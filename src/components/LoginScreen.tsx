import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Users, ShieldAlert, CheckCircle, KeyRound } from 'lucide-react';
import { User } from '../types';

interface LoginScreenProps {
  role: 'seller' | 'boss';
  activeSeller: User;
  sellers: User[];
  onLoginSuccess: (userId: string | 'boss') => void;
  onChangeRole: (role: 'seller' | 'boss') => void;
  currentSellerIndex: number;
  onSelectSeller: (index: number) => void;
}

export default function LoginScreen({
  role,
  activeSeller,
  sellers,
  onLoginSuccess,
  onChangeRole,
  currentSellerIndex,
  onSelectSeller,
}: LoginScreenProps) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  // Pre-configured fallback PINs
  const PIN_CODELIST: Record<string, string> = {
    'user-seller-1': '1111', // Amisi Mapesa
    'user-seller-2': '2222', // Farida Omari
    'boss': '9999',          // Boss Dashboard
  };

  const getTargetName = () => {
    return role === 'boss' ? 'Ripoti za Boss' : activeSeller.name;
  };

  const getTargetId = () => {
    return role === 'boss' ? 'boss' : activeSeller.id;
  };

  const getExpectedPin = () => {
    // 1. Check sellers array for the specific user matching ID
    const foundUser = sellers.find(u => u.id === getTargetId());
    if (foundUser && foundUser.pin) {
      return foundUser.pin;
    }
    // 2. Fallbacks for standard accounts
    if (role === 'boss') {
      const bossUser = sellers.find(u => u.role === 'boss');
      if (bossUser && bossUser.pin) return bossUser.pin;
    }
    return PIN_CODELIST[getTargetId()] || '9999';
  };

  const expectedPin = getExpectedPin();

  // Reset PIN when switching active seller in login screen
  useEffect(() => {
    setPin('');
    setError('');
    setSuccess(false);
  }, [activeSeller, role]);

  const handleKeyPress = (num: string) => {
    if (success) return;
    setError('');
    
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      
      // Auto-validate once 4 digits are completed
      if (nextPin.length === 4) {
        validatePin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    if (success) return;
    setError('');
    setPin(p => p.slice(0, -1));
  };

  const handleClear = () => {
    if (success) return;
    setError('');
    setPin('');
  };

  const validatePin = (codeToTest: string) => {
    if (codeToTest === expectedPin) {
      setSuccess(true);
      setError('');
      // Delay success trigger slightly for premium animation feedback
      setTimeout(() => {
        onLoginSuccess(getTargetId());
      }, 700);
    } else {
      setError('PIN Isiyo sahihi! Tafadhali jaribu tena.');
      // Auto-clear PIN back on error
      setTimeout(() => {
        setPin('');
      }, 1000);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] py-10 px-4">
      <div className="w-full max-w-md clay-card p-8 flex flex-col items-center relative overflow-hidden">
        
        {/* Glow ambient background element */}
        <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full filter blur-3xl opacity-35 ${
          role === 'boss' ? 'bg-amber-400' : 'bg-indigo-400'
        }`} />

        {/* Unified Role Segmented Switcher inside login card */}
        <div className="w-full bg-slate-200/80 p-1 rounded-2xl border border-slate-300/40 shadow-inner flex items-center mb-6 gap-1 font-sans">
          <button
            type="button"
            onClick={() => onChangeRole('seller')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              role === 'seller'
                ? 'bg-white text-indigo-700 shadow font-extrabold scale-[1.02]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users size={14} />
            <span>Muuzaji (POS)</span>
          </button>
          
          <button
            type="button"
            onClick={() => onChangeRole('boss')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              role === 'boss'
                ? 'bg-white text-amber-700 shadow font-extrabold scale-[1.02]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert size={14} />
            <span>Boss (Reports)</span>
          </button>
        </div>

        {/* Lock / Unlock Tactile Icon Orbs */}
        <div className="mb-6 relative">
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all ${
            success 
              ? 'clay-btn-emerald bg-emerald-50 text-emerald-600' 
              : error 
                ? 'clay-btn-rose bg-rose-50 text-rose-600 scale-105' 
                : role === 'boss'
                  ? 'clay-btn bg-amber-50 text-amber-600'
                  : 'clay-btn bg-indigo-50 text-indigo-600'
          }`}>
            {success ? (
              <Unlock size={28} className="animate-bounce" />
            ) : (
              <Lock size={28} className={error ? 'animate-shake' : ''} />
            )}
          </div>
          
          {success && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white">
              <CheckCircle size={10} className="stroke-[3]" />
            </div>
          )}
        </div>

        {/* Title Instructions */}
        <div className="text-center mb-6 w-full">
          <h2 className="font-sans font-black text-xl text-slate-800 tracking-tight">
            Tafadhali Ingiza PIN
          </h2>
          <p className="text-xs text-slate-500 font-medium font-sans mt-1">
            Uthibitisho unahitajika ili kufungua <strong className="text-slate-700">{getTargetName()}</strong>
          </p>

          {/* Quick Seller Switch inside POS login */}
          {role === 'seller' && (
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                <Users size={10} /> Chagua Akaunti ya Muuzaji:
              </p>
              <div className="flex items-center gap-1.5 p-1 bg-slate-200/90 rounded-2xl shadow-inner border border-slate-300/40">
                {sellers.filter(s => s.role === 'seller').map((sel, idx) => (
                  <button
                    key={sel.id}
                    onClick={() => onSelectSeller(idx)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                      currentSellerIndex === idx
                        ? 'bg-white shadow-sm text-indigo-700 font-bold scale-105'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {sel.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PIN Dot Indicator Display */}
        <div className="clay-concave w-full py-4 px-6 rounded-2xl mb-6 flex justify-center items-center gap-4">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-4 h-4 rounded-full transition-all duration-150 ${
                pin.length > index
                  ? success
                    ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]'
                    : 'bg-indigo-600 shadow-[0_0_10px_#4f46e5]'
                  : 'bg-slate-300/80 shadow-inner'
              }`}
            />
          ))}
        </div>

        {/* Error Feedback Banner */}
        {error ? (
          <div className="w-full flex items-center justify-center gap-2 mb-4 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold animate-pulse">
            <ShieldAlert size={14} />
            <span>{error}</span>
          </div>
        ) : (
          <div className="h-9 mb-4" /> // Spacing container to avoid layout shift
        )}

        {/* Neumorphic 10-Key Dial Pad */}
        <div className="grid grid-cols-3 gap-3.5 w-full max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="aspect-square rounded-2xl clay-btn flex items-center justify-center font-mono text-lg font-black text-slate-700 hover:text-indigo-600 active:scale-95 active:shadow-clay-btn-active"
            >
              {num}
            </button>
          ))}
          
          {/* Backspace Button */}
          <button
            onClick={handleBackspace}
            className="aspect-square rounded-2xl clay-btn flex items-center justify-center font-sans text-xs font-bold text-slate-500 active:scale-95 active:shadow-clay-btn-active uppercase"
          >
            ←
          </button>
          
          {/* Zero Button */}
          <button
            onClick={() => handleKeyPress('0')}
            className="aspect-square rounded-2xl clay-btn flex items-center justify-center font-mono text-lg font-black text-slate-700 active:scale-95 active:shadow-clay-btn-active"
          >
            0
          </button>
          
          {/* Clear Button */}
          <button
            onClick={handleClear}
            className="aspect-square rounded-2xl clay-btn flex items-center justify-center font-sans text-xs font-bold text-rose-500 active:scale-95 active:shadow-clay-btn-active uppercase"
          >
            C
          </button>
        </div>

        {/* Helpful Info Panel - Displays current PIN credentials clearly */}
        <div className="mt-8 p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl w-full text-center text-[10px] text-slate-500 font-sans shadow-sm">
          <p className="font-bold text-indigo-700 uppercase tracking-widest mb-1">
            Uthibitisho wa Sasa (PIN za Siri za Duka)
          </p>
          <div className="flex flex-col gap-0.5 justify-center font-mono text-slate-600">
            {role === 'seller' ? (
              sellers.filter(s => s.role === 'seller').map((sel) => (
                <div key={sel.id}>
                  Muuzaji <strong>{sel.name}</strong> PIN: <span className="bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">{sel.pin || (sel.id === 'user-seller-1' ? '1111' : '2222')}</span>
                </div>
              ))
            ) : (
              sellers.filter(s => s.role === 'boss' || s.id === 'boss').map((b) => (
                <div key={b.id}>
                  Msimamizi <strong>{b.name}</strong> PIN: <span className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">{b.pin || '9999'}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
