import React from 'react';
import { ScrollView, StyleSheet, Text, View, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWishlistStore } from '@/store/wishlistStore';
import { colors, shadows } from '@/constants/colors';
import { getItemCalculations } from '@/utils/calculations';
import { Button } from '@/components/Button';
import { PriorityBadge } from '@/components/PriorityBadge';
import { GirlMathBadge } from '@/components/GirlMathBadge';
import { PriceHistoryItem } from '@/components/PriceHistoryItem';
import { GirlMathEntryItem } from '@/components/GirlMathEntryItem';
import { Coins, Edit, Heart, TrendingDown } from 'lucide-react-native';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getItemById, getPriceChangesForItem, getGirlMathEntriesForItem, updateItem } = useWishlistStore();
  
  const item = getItemById(id);
  const priceChanges = getPriceChangesForItem(id);
  const girlMathEntries = getGirlMathEntriesForItem(id);
  
  if (!item) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Item not found</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="primary" />
      </View>
    );
  }
  
  const {
    totalWears,
    costPerWear,
    priorityScore,
    priorityLabel,
    girlMathLabel
  } = getItemCalculations(item);
  
  // Calculate total "saved" through Girl Math
  const totalSaved = girlMathEntries.reduce((sum, entry) => sum + entry.amountSaved, 0);
  const adjustedPrice = Math.max(0, item.originalPrice - totalSaved);
  
  const handleTogglePurchased = () => {
    updateItem(id, { purchased: !item.purchased });
  };
  
  const defaultImage = 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c2hvcHBpbmd8ZW58MHx8MHx8fDA%3D';
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: item.image || defaultImage }} 
            style={styles.image} 
            resizeMode="cover"
          />
        </View>
        
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.nameContainer}>
              <Heart size={16} color={colors.secondary} />
              <Text style={styles.name}>{item.name}</Text>
            </View>
            
            <Text style={styles.price}>${item.originalPrice.toFixed(2)}</Text>
          </View>
          
          <View style={styles.badgesContainer}>
            <PriorityBadge label={priorityLabel} score={priorityScore} />
            <Text style={styles.category}>{item.category}</Text>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cost Analysis</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Estimated Use:</Text>
              <Text style={styles.infoValue}>
                {totalWears} wears over {item.yearsOfUse} {parseInt(String(item.yearsOfUse)) === 1 ? 'year' : 'years'}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Cost Per Wear:</Text>
              <GirlMathBadge label={girlMathLabel} costPerWear={costPerWear} />
            </View>
            
            {totalSaved > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Girl Math Savings:</Text>
                  <Text style={styles.savedAmount}>-${totalSaved.toFixed(2)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Adjusted Price:</Text>
                  <Text style={[styles.infoValue, styles.adjustedPrice]}>
                    ${adjustedPrice.toFixed(2)}
                  </Text>
                </View>
              </>
            )}
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Priority Factors</Text>
            
            <View style={styles.factorsGrid}>
              <View style={styles.factorItem}>
                <Text style={styles.factorValue}>{item.practicality}</Text>
                <Text style={styles.factorLabel}>Practicality</Text>
              </View>
              
              <View style={styles.factorItem}>
                <Text style={styles.factorValue}>{item.desire}</Text>
                <Text style={styles.factorLabel}>Desire</Text>
              </View>
              
              <View style={styles.factorItem}>
                <Text style={styles.factorValue}>{item.need}</Text>
                <Text style={styles.factorLabel}>Need</Text>
              </View>
              
              <View style={styles.factorItem}>
                <Text style={styles.factorValue}>{item.priceSensibility}</Text>
                <Text style={styles.factorLabel}>Price Concern</Text>
              </View>
            </View>
          </View>
          
          {item.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notes}>{item.notes}</Text>
            </View>
          )}
          
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Girl Math Savings
              </Text>
              
              <Button
                title="Log Justification"
                onPress={() => router.push({ pathname: '/item/girl-math', params: { itemId: id } })}
                variant="secondary"
                size="small"
                icon={<Coins size={14} color={colors.background} />}
              />
            </View>
            
            {totalSaved > 0 && (
              <View style={styles.savedSummary}>
                <Text style={styles.savedSummaryText}>
                  Saved So Far: <Text style={styles.savedSummaryAmount}>${totalSaved.toFixed(2)}</Text>
                </Text>
              </View>
            )}
            
            {girlMathEntries.length === 0 ? (
              <Text style={styles.emptyText}>No justifications added yet.</Text>
            ) : (
              girlMathEntries
                .sort((a, b) => b.date - a.date)
                .map((entry) => (
                  <GirlMathEntryItem key={entry.id} entry={entry} />
                ))
            )}
          </View>
          
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Price History</Text>
              
              <Button
                title="Log Price"
                onPress={() => router.push({ pathname: '/item/price-log', params: { itemId: id } })}
                variant="outline"
                size="small"
                icon={<TrendingDown size={14} color={colors.text} />}
              />
            </View>
            
            {priceChanges.length === 0 ? (
              <Text style={styles.emptyText}>No price changes recorded yet.</Text>
            ) : (
              priceChanges
                .sort((a, b) => b.date - a.date)
                .map((priceChange) => (
                  <PriceHistoryItem
                    key={priceChange.id}
                    priceChange={priceChange}
                    originalPrice={item.originalPrice}
                  />
                ))
            )}
          </View>
          
          <View style={styles.actionsContainer}>
            <Button
              title={item.purchased ? "Mark as Not Purchased" : "Mark as Purchased"}
              onPress={handleTogglePurchased}
              variant={item.purchased ? "outline" : "primary"}
              fullWidth
            />
            
            <View style={styles.buttonSpacer} />
            
            <Button
              title="Edit Item"
              onPress={() => router.push({ pathname: '/item/edit', params: { itemId: id } })}
              variant="secondary"
              icon={<Edit size={16} color={colors.background} />}
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  scrollView: {
    flex: 1,
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  notFoundText: {
    fontSize: 16,
    marginBottom: 16,
    color: colors.text,
  },
  imageContainer: {
    height: 220,
    width: '100%',
    backgroundColor: colors.background,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 14,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  badgesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  category: {
    fontSize: 13,
    color: colors.textLight,
    fontWeight: '500',
  },
  section: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    ...shadows.small,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.text,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
  },
  savedAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  adjustedPrice: {
    color: colors.secondary,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  factorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  factorItem: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  factorValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  factorLabel: {
    fontSize: 12,
    color: colors.textLight,
  },
  notes: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  actionsContainer: {
    marginBottom: 24,
  },
  buttonSpacer: {
    height: 10,
  },
  savedSummary: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  savedSummaryText: {
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
  },
  savedSummaryAmount: {
    fontWeight: '700',
    color: colors.success,
  },
});