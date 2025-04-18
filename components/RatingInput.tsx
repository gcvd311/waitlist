import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { colors } from '@/constants/colors';

type RatingInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
  description?: string;
};

export const RatingInput: React.FC<RatingInputProps> = ({
  label,
  value,
  onChange,
  max = 5,
  description,
}) => {
  const ratings = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      
      <View style={styles.ratingContainer}>
        {ratings.map((rating) => (
          <Pressable
            key={rating}
            style={[
              styles.ratingButton,
              rating <= value && styles.ratingButtonActive,
            ]}
            onPress={() => onChange(rating)}
          >
            <Text
              style={[
                styles.ratingText,
                rating <= value && styles.ratingTextActive,
              ]}
            >
              {rating}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 3,
  },
  description: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.7)', // Softer primary color
    borderColor: 'rgba(99, 102, 241, 0.8)',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textLight,
  },
  ratingTextActive: {
    color: colors.background,
  },
});