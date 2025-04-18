import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { PriceChange } from '@/types';
import { colors } from '@/constants/colors';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react-native';
import { useWishlistStore } from '@/store/wishlistStore';

type PriceHistoryItemProps = {
  priceChange: PriceChange;
  originalPrice: number;
};

export const PriceHistoryItem: React.FC<PriceHistoryItemProps> = ({ 
  priceChange, 
  originalPrice 
}) => {
  const { deletePriceChange } = useWishlistStore();
  
  const date = new Date(priceChange.date);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  
  const priceDifference = priceChange.newPrice - originalPrice;
  const isPriceIncrease = priceDifference > 0;
  const isPriceDecrease = priceDifference < 0;
  
  const handleDelete = () => {
    Alert.alert(
      'Delete Price Change',
      'Are you sure you want to delete this price change?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deletePriceChange(priceChange.id)
        },
      ]
    );
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.mainContent}>
        <Text style={styles.date}>{formattedDate}</Text>
        
        <View style={styles.priceContainer}>
          <Text style={styles.price}>${priceChange.newPrice.toFixed(2)}</Text>
          
          {isPriceIncrease && (
            <View style={[styles.changeContainer, styles.increaseContainer]}>
              <ArrowUp size={10} color={colors.danger} />
              <Text style={[styles.change, styles.increase]}>
                +${Math.abs(priceDifference).toFixed(2)}
              </Text>
            </View>
          )}
          
          {isPriceDecrease && (
            <View style={[styles.changeContainer, styles.decreaseContainer]}>
              <ArrowDown size={10} color={colors.success} />
              <Text style={[styles.change, styles.decrease]}>
                -${Math.abs(priceDifference).toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      </View>
      
      <Pressable 
        style={({ pressed }) => [
          styles.deleteButton,
          pressed && styles.deleteButtonPressed
        ]}
        onPress={handleDelete}
        accessibilityLabel="Delete price change"
        accessibilityHint="Deletes this price change record"
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
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    color: colors.textLight,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginRight: 6,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  increaseContainer: {
    backgroundColor: `${colors.danger}15`,
  },
  decreaseContainer: {
    backgroundColor: `${colors.success}15`,
  },
  change: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 2,
  },
  increase: {
    color: colors.danger,
  },
  decrease: {
    color: colors.success,
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