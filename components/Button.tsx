import React, { forwardRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
};

// Use forwardRef to make Button accept refs from parent components
export const Button = forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
}, ref) => {
  const getBackgroundColor = () => {
    if (disabled) return 'rgba(107, 114, 128, 0.4)'; // More faint disabled state
    
    switch (variant) {
      case 'primary':
        return colors.primary;
      case 'secondary':
        return colors.secondary;
      case 'outline':
        return 'transparent';
      case 'danger':
        return colors.danger;
      default:
        return colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return '#ffffff';
    
    switch (variant) {
      case 'outline':
        return colors.text;
      default:
        return '#ffffff'; // Always white text for colored buttons
    }
  };

  const getBorderColor = () => {
    if (disabled) return 'rgba(107, 114, 128, 0.4)';
    
    switch (variant) {
      case 'outline':
        return colors.border;
      default:
        return 'transparent';
    }
  };

  return (
    <Pressable
      ref={ref}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: getBackgroundColor() },
        { borderColor: getBorderColor() },
        size === 'small' && styles.buttonSmall,
        size === 'large' && styles.buttonLarge,
        fullWidth && styles.buttonFullWidth,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.contentContainer}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.text,
              { color: getTextColor() },
              size === 'small' && styles.textSmall,
              size === 'large' && styles.textLarge,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  buttonSmall: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  buttonLarge: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  buttonFullWidth: {
    width: '100%',
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  textSmall: {
    fontSize: 12,
  },
  textLarge: {
    fontSize: 16,
  },
});