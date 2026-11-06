import React from 'react';

export default function WindfireLogo({ size = 'medium' }) {
  const configs = {
    small:  { width: 140, height: 32, fontSize: 22, iconSize: 22 },
    medium: { width: 260, height: 60, fontSize: 42, iconSize: 40 },
    large:  { width: 420, height: 100, fontSize: 68, iconSize: 64 },
  };

  const { width, height, fontSize, iconSize } = configs[size] || configs.medium;
  const gap = 8;
  const textX = iconSize + gap;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Windfire logo"
    >
      <defs>
        <linearGradient id="wf-flame-grad" x1="0%" y1="100%" x2="60%" y2="0%">
          <stop offset="0%"   stopColor="#ff6b35" />
          <stop offset="50%"  stopColor="#f7c59f" />
          <stop offset="100%" stopColor="#61dafb" />
        </linearGradient>
        <linearGradient id="wf-text-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#61dafb" />
          <stop offset="100%" stopColor="#90ee90" />
        </linearGradient>
      </defs>

      {/* Flame icon */}
      <g transform={`scale(${iconSize / 64})`}>
        {/* Outer flame */}
        <path
          d="M32 58 C18 50 10 38 14 24 C16 16 22 10 28 6 C26 14 30 20 34 22 C30 14 36 4 44 2 C40 10 42 18 46 24 C50 18 50 10 48 4 C56 12 58 24 54 34 C52 42 46 50 40 56 C38 58 34 60 32 58Z"
          fill="url(#wf-flame-grad)"
          opacity="0.95"
        />
        {/* Inner core */}
        <path
          d="M32 52 C24 46 20 36 24 28 C26 24 30 20 32 22 C30 28 34 34 38 36 C36 30 38 22 42 18 C42 26 44 32 46 36 C48 30 46 22 44 16 C50 22 52 32 48 40 C46 46 40 52 36 54 C34 55 32 53 32 52Z"
          fill="#fff"
          opacity="0.25"
        />
      </g>

      {/* Wordmark */}
      <text
        x={textX}
        y={height * 0.76}
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontWeight="700"
        fontSize={fontSize}
        letterSpacing="-0.5"
        fill="url(#wf-text-grad)"
      >
        Windfire
      </text>
    </svg>
  );
}
