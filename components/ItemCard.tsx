import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { WishlistItem } from '@/types';
import { colors, shadows } from '@/constants/colors';
import { getItemCalculations } from '@/utils/calculations';
import { PriorityBadge } from './PriorityBadge';
import { Heart } from 'lucide-react-native';

type ItemCardProps = {
  item: WishlistItem;
  compact?: boolean;
};

export const ItemCard: React.FC<ItemCardProps> = ({ 
  item, 
  compact = false
}) => {
  const { priorityScore, priorityLabel } = getItemCalculations(item);
  
  const defaultImage = 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c2hvcHBpbmd8ZW58MHx8MHx8fDA%3D';
  
  return (
    <View style={[styles.wrapper, compact && styles.compactWrapper]}>
      <Link href={`/item/${item.id}`} asChild>
        <Pressable style={({ pressed }) => [
          styles.container,
          shadows.small,
          pressed && styles.pressed,
          compact && styles.compactContainer
        ]}>
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
                <Heart size={14} color={colors.secondary} />
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
              
              <Text style={styles.price}>
                ${item.originalPrice.toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.details}>
              <PriorityBadge 
                label={priorityLabel} 
                score={priorityScore}
                size="small"
              />
              
              <Text style={styles.category}>
                {item.category}
              </Text>
            </View>
          </View>
        </Pressable>
      </Link>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  compactWrapper: {
    height: 90,
  },
  container: {
    backgroundColor: colors.background,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactContainer: {
    flexDirection: 'row',
    height: 90,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  imageContainer: {
    height: 160,
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  category: {
    fontSize: 12,
    color: colors.textLight,
  }
});