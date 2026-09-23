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
  height = 500,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const cleanSymbol = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '');
    const tvSymbol = `NSE:${cleanSymbol}`;

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.style.height = 'calc(100% - 32px)';
    widgetContainer.style.width = '100%';
    containerRef.current.appendChild(widgetContainer);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
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
  }, [symbol, theme]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full rounded-2xl overflow-hidden bg-[#060913] border border-white/10 shadow-2xl"
      style={{ height }}
    />
  );
});

TradingViewChart.displayName = 'TradingViewChart';
