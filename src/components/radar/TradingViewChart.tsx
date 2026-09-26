'use client';

import React, { useEffect, useRef, memo } from 'react';

interface TradingViewChartProps {
  symbol: string; // e.g. "BAJAJHFL" or "NSE:BAJAJHFL"
  theme?: 'dark' | 'light';
  height?: number | string;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = memo(({
  symbol,
  theme = 'dark',
  height = 520,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const numHeight = typeof height === 'number' ? `${height}px` : height;
  const rawNum = typeof height === 'number' ? height : parseInt(String(height), 10) || 520;

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const clean = (symbol || '').toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();
    // Use NIFTY benchmark if symbol is empty, placeholder, or generic
    const targetSymbol = clean && clean !== 'TBD' && clean !== 'IPO' ? clean : 'NIFTY';
    const tvSymbol = targetSymbol.includes(':') ? targetSymbol : `NSE:${targetSymbol}`;

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.style.height = numHeight;
    widgetContainer.style.minHeight = numHeight;
    widgetContainer.style.width = '100%';
    containerRef.current.appendChild(widgetContainer);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: false,
      width: '100%',
      height: rawNum,
      symbol: tvSymbol,
      interval: 'D',
      timezone: 'Asia/Kolkata',
      theme: theme,
      style: '1',
      locale: 'in',
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      hide_side_toolbar: false,
      withdateranges: true,
      details: true,
      hotlist: false,
      support_host: 'https://www.tradingview.com',
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, theme, numHeight, rawNum]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full rounded-2xl overflow-hidden bg-[#060913] border border-white/10 shadow-2xl relative"
      style={{ height: numHeight, minHeight: numHeight }}
    />
  );
});

TradingViewChart.displayName = 'TradingViewChart';
