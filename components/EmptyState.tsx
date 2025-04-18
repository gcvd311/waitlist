import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { colors } from '@/constants/colors';
import { Link } from 'expo-router';
import { ShoppingBag } from 'lucide-react-native';

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  actionLink?: string;
  icon?: React.ReactNode;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  actionLink,
  icon,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        {icon || <ShoppingBag size={40} color={colors.primary} />}
      </View>
      
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      
      {actionLabel && actionLink && (
        <Link href={actionLink} asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>{actionLabel}</Text>
          </Pressable>
        </Link>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
});