import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { GirlMathEntry } from '@/types';
import { colors } from '@/constants/colors';
import { Trash2 } from 'lucide-react-native';
import { useWishlistStore } from '@/store/wishlistStore';

type GirlMathEntryItemProps = {
  entry: GirlMathEntry;
};

export const GirlMathEntryItem: React.FC<GirlMathEntryItemProps> = ({ entry }) => {
  const { deleteGirlMathEntry } = useWishlistStore();
  
  const date = new Date(entry.date);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  
  const handleDelete = () => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this justification?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteGirlMathEntry(entry.id)
        },
      ]
    );
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.leftContent}>
        <Text style={styles.date}>{formattedDate}:</Text>
        <View style={styles.justificationContainer}>
          <Text style={styles.savedAmount}>Saved ${entry.amountSaved.toFixed(2)}</Text>
          <Text style={styles.separator}>—</Text>
          <Text style={styles.justification}>{entry.justificationLabel}</Text>
        </View>
      </View>
      
      <Pressable 
        style={({ pressed }) => [
          styles.deleteButton,
          pressed && styles.deleteButtonPressed
        ]}
        onPress={handleDelete}
        accessibilityLabel="Delete entry"
        accessibilityHint="Deletes this Girl Math justification"
      >
        <Trash2 size={16} color={colors.danger} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leftContent: {
    flex: 1,
  },
  date: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 2,
  },
  justificationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  savedAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  separator: {
    fontSize: 13,
    color: colors.textLight,
    marginHorizontal: 4,
  },
  justification: {
    fontSize: 13,
    color: colors.text,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: `${colors.danger}10`,
  },
  deleteButtonPressed: {
    opacity: 0.7,
    backgroundColor: `${colors.danger}20`,
  },
});