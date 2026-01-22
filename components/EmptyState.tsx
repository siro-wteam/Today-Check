import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import { colors } from '@/constants/colors';

interface EmptyStateProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

export function EmptyState({
  size = 'sm',
  message = 'No tasks scheduled',
}: EmptyStateProps) {
  const sizeConfig = {
    sm: { container: 0, icon: 32, fontSize: 11 }, // Larger, more visible icon
    md: { container: 0, icon: 40, fontSize: 12 },
    lg: { container: 0, icon: 48, fontSize: 14 },
  };

  const config = sizeConfig[size];

  return (
    <View style={[styles.container, { minHeight: config.container }]}>
      {/* Clipboard Icon */}
      <Svg
        width={config.icon}
        height={config.icon}
        viewBox="0 0 72 72"
        style={{ opacity: 0.7 }}
      >
        {/* Clipboard body */}
        <Rect
          x="16"
          y="12"
          width="40"
          height="52"
          rx="4"
          fill={colors.gray300}
          stroke={colors.gray500}
          strokeWidth="2"
          fillOpacity="0.4"
        />
        
        {/* Clipboard clip */}
        <Rect
          x="26"
          y="8"
          width="20"
          height="10"
          rx="2"
          fill={colors.card}
          stroke={colors.gray500}
          strokeWidth="2"
        />
        
        {/* Dashed lines (checklist items) */}
        <Line
          x1="24"
          y1="28"
          x2="48"
          y2="28"
          stroke={colors.gray500}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 4"
          opacity="0.4"
        />
        <Line
          x1="24"
          y1="38"
          x2="42"
          y2="38"
          stroke={colors.gray500}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 4"
          opacity="0.4"
        />
        <Line
          x1="24"
          y1="48"
          x2="45"
          y2="48"
          stroke={colors.gray500}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 4"
          opacity="0.4"
        />
        
        {/* Empty checkboxes */}
        <Rect
          x="24"
          y="24"
          width="6"
          height="6"
          rx="1"
          stroke={colors.gray500}
          strokeWidth="1.5"
          fill="none"
          opacity="0.5"
        />
        <Rect
          x="24"
          y="34"
          width="6"
          height="6"
          rx="1"
          stroke={colors.gray500}
          strokeWidth="1.5"
          fill="none"
          opacity="0.5"
        />
        <Rect
          x="24"
          y="44"
          width="6"
          height="6"
          rx="1"
          stroke={colors.gray500}
          strokeWidth="1.5"
          fill="none"
          opacity="0.5"
        />
      </Svg>
      
      {/* Message */}
      <Text style={[styles.message, { fontSize: config.fontSize }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2, // Further reduced gap
    paddingVertical: 2, // Further reduced padding
  },
  message: {
    color: colors.textSub,
    opacity: 0.6,
  },
});
