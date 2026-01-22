import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface LogoIconProps {
  size?: number;
  color?: string;
}

export function LogoIcon({ size = 32, color = '#3B82F6' }: LogoIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Back card */}
      <Rect x="8" y="5" width="28" height="28" rx="8" fill={color} fillOpacity="0.3" />
      {/* Front card */}
      <Rect x="4" y="9" width="28" height="28" rx="8" fill={color} />
      {/* Check mark */}
      <Path
        d="M12 23L17 28L26 15"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
