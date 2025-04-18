import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, shadows } from '@/constants/colors';

type FeatureCardProps = {
  icon: React.ReactNode;
  iconBgColor: string;
  title: string;
  description: string;
};

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  iconBgColor,
  title,
  description,
}) => {
  return (
    <View style={[styles.container, shadows.small]}>
      <View style={[styles.iconContainer, { backgroundColor: iconBgColor + '05' }]}>
        {icon}
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 18,
  },
});