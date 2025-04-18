import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PriorityLabel } from '@/types';
import { getPriorityColor } from '@/utils/calculations';

type PriorityBadgeProps = {
  label: PriorityLabel;
  score?: number;
  size?: 'small' | 'medium' | 'large';
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ 
  label, 
  score, 
  size = 'medium' 
}) => {
  const color = getPriorityColor(label);
  
  return (
    <View style={[
      styles.container, 
      { backgroundColor: color }, // Use solid background color
      size === 'small' && styles.containerSmall,
      size === 'large' && styles.containerLarge,
    ]}>
      <Text style={[
        styles.label, 
        styles.labelWhite, // Always use white text for contrast
        size === 'small' && styles.labelSmall,
        size === 'large' && styles.labelLarge,
      ]}>
        {label}
        {score !== undefined && ` • ${score}/20`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  containerSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  containerLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  labelWhite: {
    color: '#ffffff',
  },
  labelSmall: {
    fontSize: 11,
  },
  labelLarge: {
    fontSize: 14,
  },
});