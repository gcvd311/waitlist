import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWishlistStore } from '@/store/wishlistStore';
import { ItemCard } from '@/components/ItemCard';
import { colors } from '@/constants/colors';
import { EmptyState } from '@/components/EmptyState';
import { getItemCalculations } from '@/utils/calculations';
import { Archive } from 'lucide-react-native';

export default function PurchasedScreen() {
  const { items } = useWishlistStore();
  
  // Filter purchased items
  const purchasedItems = items.filter(item => item.purchased);
  
  // Sort by priority score (highest first)
  const sortedItems = [...purchasedItems].sort((a, b) => {
    const aCalc = getItemCalculations(a);
    const bCalc = getItemCalculations(b);
    return bCalc.priorityScore - aCalc.priorityScore;
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Purchased Items</Text>
        <Text style={styles.subtitle}>
          {sortedItems.length} {sortedItems.length === 1 ? 'item' : 'items'} purchased
        </Text>
      </View>

      {sortedItems.length === 0 ? (
        <EmptyState
          title="No purchased items"
          description="Items you mark as purchased will appear here."
          actionLabel="Go to Waitlist"
          actionLink="/"
          icon={<Archive size={40} color={colors.primary} />}
        />
      ) : (
        <FlatList
          data={sortedItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ItemCard item={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 2,
  },
  listContent: {
    padding: 14,
  },
});