import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWishlistStore } from '@/store/wishlistStore';
import { ItemCard } from '@/components/ItemCard';
import { colors } from '@/constants/colors';
import { EmptyState } from '@/components/EmptyState';
import { getItemCalculations } from '@/utils/calculations';
import { ShoppingBag } from 'lucide-react-native';

export default function HomeScreen() {
  const { items } = useWishlistStore();
  
  // Filter out purchased items
  const wishlistItems = items.filter(item => !item.purchased);
  
  // Sort by priority score (highest first)
  const sortedItems = [...wishlistItems].sort((a, b) => {
    const aCalc = getItemCalculations(a);
    const bCalc = getItemCalculations(b);
    return bCalc.priorityScore - aCalc.priorityScore;
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          {sortedItems.length} {sortedItems.length === 1 ? 'item' : 'items'} on your list
        </Text>
      </View>

      {sortedItems.length === 0 ? (
        <EmptyState
          title="Your waitlist is empty"
          description="Add items to your waitlist to keep track of things you want to buy."
          actionLabel="Add Your First Item"
          actionLink="/add"
          icon={<ShoppingBag size={40} color={colors.primary} />}
        />
      ) : (
        <FlatList
          data={sortedItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ItemCard item={item} />
          )}
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
  subtitle: {
    fontSize: 14,
    color: colors.textLight,
  },
  listContent: {
    padding: 14,
  },
});