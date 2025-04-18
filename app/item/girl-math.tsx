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
import { Coins } from 'lucide-react-native';

export default function GirlMathScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { getItemById, addGirlMathEntry } = useWishlistStore();
  
  const item = getItemById(itemId);
  
  const [justificationLabel, setJustificationLabel] = useState('');
  const [amountSaved, setAmountSaved] = useState('');
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
    if (!justificationLabel) {
      Alert.alert('Error', 'Please enter a justification');
      return;
    }
    
    if (!amountSaved) {
      Alert.alert('Error', 'Please enter an amount saved');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      addGirlMathEntry({
        itemId,
        date: Date.now(),
        justificationLabel,
        amountSaved: parseFloat(amountSaved),
      });
      
      // Reset form
      setJustificationLabel('');
      setAmountSaved('');
      
      // Navigate back to item details
      router.back();
    } catch (error) {
      console.error('Error adding girl math entry:', error);
      Alert.alert('Error', 'Failed to add entry. Please try again.');
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
          <Text style={styles.title}>Add Girl Math Justification</Text>
          
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>Price: ${item.originalPrice.toFixed(2)}</Text>
          </View>
          
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>What is Girl Math?</Text>
            <Text style={styles.infoText}>
              Girl Math is the art of justifying purchases by calculating money "saved" elsewhere. 
              For example, "I skipped my daily coffee for a week, saving $25, so these shoes are practically free!"
            </Text>
          </View>
          
          <View style={styles.formSection}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>What expense did you skip?</Text>
              <TextInput
                style={styles.input}
                value={justificationLabel}
                onChangeText={setJustificationLabel}
                placeholder="e.g., Skipped coffee for a week"
                placeholderTextColor={colors.textLight}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Amount Saved ($)</Text>
              <TextInput
                style={styles.input}
                value={amountSaved}
                onChangeText={setAmountSaved}
                placeholder="Enter amount saved"
                placeholderTextColor={colors.textLight}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          
          <View style={styles.buttonContainer}>
            <Button
              title="Save Entry"
              onPress={handleSubmit}
              variant="secondary"
              fullWidth
              loading={isSubmitting}
              icon={<Coins size={16} color="#ffffff" />}
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
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
  infoBox: {
    backgroundColor: 'rgba(244, 114, 182, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.3)',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
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
  buttonContainer: {
    marginTop: 6,
    marginBottom: 20,
  },
  buttonSpacer: {
    height: 10,
  },
});