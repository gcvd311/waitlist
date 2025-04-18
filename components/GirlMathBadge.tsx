import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GirlMathLabel } from '@/types';
import { getGirlMathColor } from '@/utils/calculations';

type GirlMathBadgeProps = {
  label: GirlMathLabel;
  costPerWear?: number;
  size?: 'small' | 'medium' | 'large';
};

export const GirlMathBadge: React.FC<GirlMathBadgeProps> = ({ 
  label, 
  costPerWear, 
  size = 'medium' 
}) => {
  const color = getGirlMathColor(label);
  
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
        {costPerWear !== undefined && ` • $${costPerWear}/wear`}
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