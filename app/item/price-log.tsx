import React, { useState } from 'react';
import { 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput, 
  View 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useWishlistStore } from '@/store/wishlistStore';
import { Button } from '@/components/Button';
import { colors } from '@/constants/colors';
import { TrendingDown } from 'lucide-react-native';

export default function PriceLogScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { getItemById, addPriceChange } = useWishlistStore();
  
  const item = getItemById(itemId);
  
  const [newPrice, setNewPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  if (!item) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Item not found</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="primary" />
      </View>
    );
  }
  
  const handleSubmit = () => {
    if (!newPrice) {
      Alert.alert('Error', 'Please enter a new price');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      addPriceChange({
        itemId,
        date: Date.now(),
        newPrice: parseFloat(newPrice),
      });
      
      // Reset form
      setNewPrice('');
      
      // Navigate back to item details
      router.back();
    } catch (error) {
      console.error('Error adding price change:', error);
      Alert.alert('Error', 'Failed to add price change. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <TrendingDown size={28} color={colors.primary} />
            </View>
            <Text style={styles.title}>Log Price Change</Text>
          </View>
          
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>Current Price: ${item.originalPrice.toFixed(2)}</Text>
          </View>
          
          <View style={styles.formSection}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>New Price</Text>
              <TextInput
                style={styles.input}
                value={newPrice}
                onChangeText={setNewPrice}
                placeholder="Enter new price"
                placeholderTextColor={colors.textLight}
                keyboardType="decimal-pad"
              />
            </View>
            
            <Text style={styles.helpText}>
              This will record the current price of the item without changing the original price used for calculations.
            </Text>
          </View>
          
          <View style={styles.buttonContainer}>
            <Button
              title="Save Price Change"
              onPress={handleSubmit}
              variant="primary"
              fullWidth
              loading={isSubmitting}
            />
            
            <View style={styles.buttonSpacer} />
            
            <Button
              title="Cancel"
              onPress={() => router.back()}
              variant="outline"
              fullWidth
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
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
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${colors.primary}05`, // Much more transparent
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  itemInfo: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  itemPrice: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  formSection: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    fontSize: 14,
    color: colors.text,
  },
  helpText: {
    fontSize: 12,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginTop: 6,
    marginBottom: 20,
  },
  buttonSpacer: {
    height: 10,
  },
});