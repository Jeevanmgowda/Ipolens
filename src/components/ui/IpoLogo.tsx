'use client';

import React, { useState } from 'react';

interface IpoLogoProps {
  symbol: string;
  companyName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<IpoLogoProps['size']>, string> = {
  xs: 'w-5 h-5 rounded-md',
  sm: 'w-7 h-7 rounded-lg',
  md: 'w-9 h-9 rounded-xl',
  lg: 'w-11 h-11 rounded-xl',
};

export const IpoLogo: React.FC<IpoLogoProps> = ({
  symbol,
  companyName,
  size = 'md',
  className = '',
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return null;
  }

  const src = `/api/ipo-logo?symbol=${encodeURIComponent(symbol)}&name=${encodeURIComponent(companyName || '')}`;

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-white/95 border border-white/15 p-0.5 flex items-center justify-center transition-opacity duration-200 ${
        loaded ? 'opacity-100' : 'opacity-0 w-0 border-0 p-0'
      } ${loaded ? SIZE_CLASSES[size] : 'h-0'} ${className}`}
      title={companyName || symbol}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={companyName || symbol}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className="w-full h-full object-contain"
      />
    </div>
  );
};
