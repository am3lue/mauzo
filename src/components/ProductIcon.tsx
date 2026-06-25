import React from 'react';
import { 
  CupSoda, 
  Coffee, 
  ShoppingBag, 
  Droplet, 
  Sparkles, 
  Wheat, 
  FileBox, 
  Dices,
  UtensilsCrossed
} from 'lucide-react';

interface ProductIconProps {
  type: string;
  className?: string;
  size?: number;
  fullSize?: boolean;
}

export default function ProductIcon({ type, className = "w-6 h-6", size = 24, fullSize = false }: ProductIconProps) {
  if (type && (type.startsWith('http') || type.startsWith('data:') || type.startsWith('/api/'))) {
    const containerClasses = fullSize 
      ? "w-full h-full rounded-2xl overflow-hidden flex items-center justify-center bg-slate-100 shadow-inner border border-slate-200/80 flex-shrink-0"
      : "w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center bg-slate-100 shadow-inner border border-slate-200/80 flex-shrink-0";
    return (
      <div className={containerClasses}>
        <img 
          src={type} 
          alt="bidhaa icon" 
          className="w-full h-full object-cover" 
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.onerror = null; 
            e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='18' height='18' rx='2' ry='2'/><circle cx='9' cy='9' r='2'/><path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/></svg>";
          }}
        />
      </div>
    );
  }

  const wrapperClass = fullSize 
    ? "w-full h-full rounded-2xl flex items-center justify-center shadow-inner" 
    : "p-3 rounded-2xl flex items-center justify-center shadow-inner";

  switch (type) {
    case 'cola':
      return (
        <div className={`${wrapperClass} ${fullSize ? 'bg-red-50 text-red-600' : 'bg-red-100 text-red-600'}`}>
          <CupSoda className={className} size={size} />
        </div>
      );
    case 'maize':
      return (
        <div className={`${wrapperClass} ${fullSize ? 'bg-amber-50 text-amber-700' : 'bg-amber-100 text-amber-700'}`}>
          <Wheat className={className} size={size} />
        </div>
      );
    case 'tea':
      return (
        <div className={`${wrapperClass} ${fullSize ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-100 text-emerald-700'}`}>
          <Coffee className={className} size={size} />
        </div>
      );
    case 'margarine':
      return (
        <div className={`${wrapperClass} ${fullSize ? 'bg-yellow-50 text-yellow-600' : 'bg-yellow-100 text-yellow-600'}`}>
          <UtensilsCrossed className={className} size={size} />
        </div>
      );
    case 'soap':
      return (
        <div className={`${wrapperClass} ${fullSize ? 'bg-blue-50 text-blue-600' : 'bg-blue-100 text-blue-600'}`}>
          <Sparkles className={className} size={size} />
        </div>
      );
    case 'rice':
      return (
        <div className={`${wrapperClass} ${fullSize ? 'bg-orange-50 text-orange-700' : 'bg-orange-100 text-orange-700'}`}>
          <ShoppingBag className={className} size={size} />
        </div>
      );
    case 'water':
      return (
        <div className={`${wrapperClass} ${fullSize ? 'bg-sky-50 text-sky-600' : 'bg-sky-100 text-sky-600'}`}>
          <Droplet className={className} size={size} />
        </div>
      );
    case 'sugar':
      return (
        <div className={`${wrapperClass} ${fullSize ? 'bg-purple-50 text-purple-600' : 'bg-purple-100 text-purple-600'}`}>
          <Dices className={className} size={size} />
        </div>
      );
    default:
      return (
        <div className={`${wrapperClass} ${fullSize ? 'bg-slate-50 text-slate-600' : 'bg-slate-200 text-slate-600'}`}>
          <FileBox className={className} size={size} />
        </div>
      );
  }
}
