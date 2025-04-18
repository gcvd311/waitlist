import React, { useState } from 'react';
import { 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput, 
  View,
  TouchableOpacity,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useWishlistStore } from '@/store/wishlistStore';
import { Button } from '@/components/Button';
import { colors } from '@/constants/colors';
import { Coins, ChevronDown, X } from 'lucide-react-native';
import { WishlistItem } from '@/types';

export default function AddGirlMathScreen() {
  const { items, addGirlMathEntry } = useWishlistStore();
  
  // Filter out purchased items
  const availableItems = items.filter(item => !item.purchased);
  
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null);
  const [justificationLabel, setJustificationLabel] = useState('');
  const [amountSaved, setAmountSaved] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  
  const handleSubmit = () => {
    if (!selectedItem) {
      Alert.alert('Error', 'Please select an item');
      return;
    }
    
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
        itemId: selectedItem.id,
        date: Date.now(),
        justificationLabel,
        amountSaved: parseFloat(amountSaved),
      });
      
      // Reset form
      setSelectedItem(null);
      setJustificationLabel('');
      setAmountSaved('');
      
      // Navigate back to girl math tracker
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
          <View style={styles.header}>
            <Text style={styles.title}>Add Girl Math Justification</Text>
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
              <Text style={styles.label}>Select Item</Text>
              <TouchableOpacity 
                style={styles.selectButton}
                onPress={() => setShowItemModal(true)}
              >
                <Text style={styles.selectButtonText}>
                  {selectedItem ? selectedItem.name : 'Select an item'}
                </Text>
                <ChevronDown size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {selectedItem && (
              <View style={styles.selectedItemInfo}>
                <Text style={styles.itemPrice}>Price: ${selectedItem.originalPrice.toFixed(2)}</Text>
              </View>
            )}
            
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
              disabled={!selectedItem || !justificationLabel || !amountSaved}
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

      {/* Item Selection Modal */}
      <Modal
        visible={showItemModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowItemModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Item</Text>
              <TouchableOpacity onPress={() => setShowItemModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              {availableItems.length === 0 ? (
                <Text style={styles.noItemsText}>
                  No items available. Add items to your waitlist first.
                </Text>
              ) : (
                availableItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.modalOption,
                      selectedItem?.id === item.id && styles.modalOptionSelected
                    ]}
                    onPress={() => {
                      setSelectedItem(item);
                      setShowItemModal(false);
                    }}
                  >
                    <View>
                      <Text 
                        style={[
                          styles.modalOptionText,
                          selectedItem?.id === item.id && styles.modalOptionTextSelected
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.modalOptionPrice}>
                        ${item.originalPrice.toFixed(2)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
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
  selectButton: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  selectedItemInfo: {
    marginTop: -6,
    marginBottom: 12,
    paddingLeft: 2,
  },
  itemPrice: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  buttonContainer: {
    marginTop: 6,
    marginBottom: 20,
  },
  buttonSpacer: {
    height: 10,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modalScrollView: {
    padding: 10,
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(244, 114, 182, 0.15)',
  },
  modalOptionText: {
    fontSize: 16,
    color: colors.text,
  },
  modalOptionTextSelected: {
    color: colors.secondary,
    fontWeight: '600',
  },
  modalOptionPrice: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 2,
  },
  noItemsText: {
    fontSize: 14,
    color: colors.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
});