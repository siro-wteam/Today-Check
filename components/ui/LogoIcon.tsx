import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface LogoIconProps {
  size?: number;
  color?: string;
}

export function LogoIcon({ size = 32, color = '#0080F0' }: LogoIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Blue square background */}
      <Rect x="0" y="0" width="40" height="40" rx="8" fill={color} />
      {/* White square outline (checklist icon) */}
      <Rect 
        x="10" 
        y="10" 
        width="20" 
        height="20" 
        rx="4" 
        fill="none" 
        stroke="white" 
        strokeWidth="2.5"
      />
      {/* Check mark inside the square */}
      <Path
        d="M15 20L18 23L25 16"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
