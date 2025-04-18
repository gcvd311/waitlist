import React from 'react';
import { FlatList, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useWishlistStore } from '@/store/wishlistStore';
import { colors } from '@/constants/colors';
import { EmptyState } from '@/components/EmptyState';
import { GirlMathEntryItem } from '@/components/GirlMathEntryItem';
import { Button } from '@/components/Button';
import { Coins, Plus } from 'lucide-react-native';
import { GirlMathEntry } from '@/types';

export default function GirlMathTrackerScreen() {
  const { girlMathEntries, items } = useWishlistStore();
  
  // Sort by date (newest first)
  const sortedEntries = [...girlMathEntries].sort((a, b) => b.date - a.date);
  
  // Calculate total "saved"
  const totalSaved = girlMathEntries.reduce((sum, entry) => sum + entry.amountSaved, 0);
  
  // Get item names for display
  const getItemName = (itemId: string) => {
    const item = items.find(item => item.id === itemId);
    return item ? item.name : 'Unknown Item';
  };
  
  const renderItem = ({ item }: { item: GirlMathEntry }) => {
    const itemName = getItemName(item.itemId);
    return (
      <Link href={`/item/${item.itemId}`} asChild>
        <Pressable style={({ pressed }) => [
          styles.entryContainer,
          pressed && styles.entryContainerPressed
        ]}>
          <Text style={styles.itemName}>{itemName}</Text>
          <GirlMathEntryItem entry={item} />
        </Pressable>
      </Link>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Girl Math Tracker</Text>
          <Text style={styles.subtitle}>
            Total "saved": <Text style={styles.savedAmount}>${totalSaved.toFixed(2)}</Text>
          </Text>
        </View>
        
        <Button
          title="Add"
          onPress={() => router.push('/girl-math/add')}
          variant="secondary"
          size="small"
          icon={<Plus size={16} color="#ffffff" />}
        />
      </View>

      {sortedEntries.length === 0 ? (
        <EmptyState
          title="No justifications yet"
          description="Add Girl Math justifications to track how much you've 'saved'."
          icon={<Coins size={40} color={colors.secondary} />}
          actionLabel="Add Justification"
          actionLink="/girl-math/add"
        />
      ) : (
        <FlatList
          data={sortedEntries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 2,
  },
  savedAmount: {
    color: colors.success,
    fontWeight: '600',
  },
  listContent: {
    padding: 14,
    paddingBottom: 30,
  },
  entryContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryContainerPressed: {
    opacity: 0.8,
    backgroundColor: `${colors.background}F0`,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
});