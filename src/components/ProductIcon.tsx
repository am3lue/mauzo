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
}

export default function ProductIcon({ type, className = "w-6 h-6", size = 24 }: ProductIconProps) {
  if (type && (type.startsWith('http') || type.startsWith('data:') || type.startsWith('/api/'))) {
    return (
      <div className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center bg-slate-100 shadow-inner border border-slate-200/80 flex-shrink-0">
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

  switch (type) {
    case 'cola':
      return (
        <div className="p-3 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 shadow-inner">
          <CupSoda className={className} size={size} />
        </div>
      );
    case 'maize':
      return (
        <div className="p-3 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-700 shadow-inner">
          <Wheat className={className} size={size} />
        </div>
      );
    case 'tea':
      return (
        <div className="p-3 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-700 shadow-inner">
          <Coffee className={className} size={size} />
        </div>
      );
    case 'margarine':
      return (
        <div className="p-3 bg-yellow-100 rounded-2xl flex items-center justify-center text-yellow-600 shadow-inner">
          <UtensilsCrossed className={className} size={size} />
        </div>
      );
    case 'soap':
      return (
        <div className="p-3 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
          <Sparkles className={className} size={size} />
        </div>
      );
    case 'rice':
      return (
        <div className="p-3 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-700 shadow-inner">
          <ShoppingBag className={className} size={size} />
        </div>
      );
    case 'water':
      return (
        <div className="p-3 bg-sky-100 rounded-2xl flex items-center justify-center text-sky-600 shadow-inner">
          <Droplet className={className} size={size} />
        </div>
      );
    case 'sugar':
      return (
        <div className="p-3 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 shadow-inner">
          <Dices className={className} size={size} />
        </div>
      );
    default:
      return (
        <div className="p-3 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-600 shadow-inner">
          <FileBox className={className} size={size} />
        </div>
      );
  }
}
