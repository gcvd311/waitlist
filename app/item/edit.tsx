import React, { useEffect, useState } from 'react';
import { 
  Alert, 
  Image, 
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
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useWishlistStore } from '@/store/wishlistStore';
import { Button } from '@/components/Button';
import { RatingInput } from '@/components/RatingInput';
import { colors } from '@/constants/colors';
import { CATEGORIES, YEARS_OF_USE_OPTIONS } from '@/constants/categories';
import { 
  calculateCostPerWear, 
  calculatePriorityScore, 
  calculateTotalWears, 
  getGirlMathLabel, 
  getPriorityLabel 
} from '@/utils/calculations';
import { Camera, ChevronDown, ImagePlus, Trash2, X } from 'lucide-react-native';
import { PriorityBadge } from '@/components/PriorityBadge';
import { GirlMathBadge } from '@/components/GirlMathBadge';

export default function EditItemScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { getItemById, updateItem, deleteItem } = useWishlistStore();
  
  const item = getItemById(itemId);
  
  const [name, setName] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [originalPrice, setOriginalPrice] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [practicality, setPracticality] = useState(3);
  const [desire, setDesire] = useState(3);
  const [need, setNeed] = useState(3);
  const [priceSensibility, setPriceSensibility] = useState(3);
  const [wearsPerMonth, setWearsPerMonth] = useState('');
  const [yearsOfUse, setYearsOfUse] = useState(YEARS_OF_USE_OPTIONS[1]);
  const [notes, setNotes] = useState('');
  const [purchased, setPurchased] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showYearsModal, setShowYearsModal] = useState(false);
  const [showPurchasedModal, setShowPurchasedModal] = useState(false);
  
  useEffect(() => {
    if (item) {
      setName(item.name);
      setImage(item.image);
      setOriginalPrice(item.originalPrice.toString());
      setCategory(item.category);
      setPracticality(item.practicality);
      setDesire(item.desire);
      setNeed(item.need);
      setPriceSensibility(item.priceSensibility);
      setWearsPerMonth(item.wearsPerMonth.toString());
      setYearsOfUse(item.yearsOfUse.toString());
      setNotes(item.notes);
      setPurchased(item.purchased);
    }
  }, [item]);
  
  if (!item) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Item not found</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="primary" />
      </View>
    );
  }
  
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };
  
  const handleSubmit = () => {
    if (!name) {
      Alert.alert('Error', 'Please enter a name for the item');
      return;
    }
    
    if (!originalPrice) {
      Alert.alert('Error', 'Please enter a price for the item');
      return;
    }
    
    if (!wearsPerMonth) {
      Alert.alert('Error', 'Please enter estimated wears per month');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const updatedItem = {
        name,
        image,
        originalPrice: parseFloat(originalPrice),
        category: category as any,
        practicality,
        desire,
        need,
        priceSensibility,
        wearsPerMonth: parseFloat(wearsPerMonth),
        yearsOfUse: parseInt(yearsOfUse),
        notes,
        purchased,
      };
      
      updateItem(itemId, updatedItem);
      
      // Navigate back to item details
      router.back();
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Error', 'Failed to update item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            setIsDeleting(true);
            deleteItem(itemId);
            router.replace('/');
          }
        },
      ]
    );
  };
  
  // Calculate preview values
  const price = parseFloat(originalPrice) || 0;
  const wears = parseFloat(wearsPerMonth) || 0;
  const years = parseInt(yearsOfUse) || 0;
  
  const totalWears = calculateTotalWears(wears, years);
  const costPerWear = calculateCostPerWear(price, totalWears);
  const priorityScore = calculatePriorityScore(practicality, desire, need, priceSensibility);
  const priorityLabel = getPriorityLabel(priorityScore);
  const girlMathLabel = getGirlMathLabel(costPerWear);
  
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
          <Text style={styles.title}>Edit Item</Text>
          
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Item Details</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter item name"
                placeholderTextColor={colors.textLight}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Image</Text>
              <View style={styles.imagePickerContainer}>
                {image ? (
                  <Image source={{ uri: image }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <ImagePlus size={24} color={colors.textLight} />
                  </View>
                )}
                <Button
                  title="Choose Image"
                  onPress={pickImage}
                  variant="outline"
                  size="small"
                  icon={<Camera size={14} color={colors.text} />}
                />
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Price</Text>
              <TextInput
                style={styles.input}
                value={originalPrice}
                onChangeText={setOriginalPrice}
                placeholder="Enter price"
                placeholderTextColor={colors.textLight}
                keyboardType="decimal-pad"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Category</Text>
              <TouchableOpacity 
                style={styles.selectButton}
                onPress={() => setShowCategoryModal(true)}
              >
                <Text style={styles.selectButtonText}>{category}</Text>
                <ChevronDown size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Purchased</Text>
              <TouchableOpacity 
                style={styles.selectButton}
                onPress={() => setShowPurchasedModal(true)}
              >
                <Text style={styles.selectButtonText}>{purchased ? 'Yes' : 'No'}</Text>
                <ChevronDown size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Priority Inputs</Text>
            
            <RatingInput
              label="Practicality"
              value={practicality}
              onChange={setPracticality}
              description="How practical is this item for your lifestyle?"
            />
            
            <RatingInput
              label="Desire"
              value={desire}
              onChange={setDesire}
              description="How much do you want this item?"
            />
            
            <RatingInput
              label="Need"
              value={need}
              onChange={setNeed}
              description="How much do you need this item?"
            />
            
            <RatingInput
              label="Price Sensibility"
              value={priceSensibility}
              onChange={setPriceSensibility}
              description="How much does the price concern you? (Higher = more concern)"
            />
          </View>
          
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Wear Estimate</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Wears Per Month</Text>
              <TextInput
                style={styles.input}
                value={wearsPerMonth}
                onChangeText={setWearsPerMonth}
                placeholder="Enter estimated wears per month"
                placeholderTextColor={colors.textLight}
                keyboardType="decimal-pad"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Years of Use</Text>
              <TouchableOpacity 
                style={styles.selectButton}
                onPress={() => setShowYearsModal(true)}
              >
                <Text style={styles.selectButtonText}>
                  {yearsOfUse} {parseInt(yearsOfUse) === 1 ? 'year' : 'years'}
                </Text>
                <ChevronDown size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Notes</Text>
            
            <View style={styles.formGroup}>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any notes about this item"
                placeholderTextColor={colors.textLight}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
          
          {(price > 0 && wears > 0 && years > 0) && (
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>Preview</Text>
              
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Priority Score:</Text>
                <PriorityBadge label={priorityLabel} score={priorityScore} />
              </View>
              
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Total Wears:</Text>
                <Text style={styles.previewValue}>{totalWears} wears</Text>
              </View>
              
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Cost Per Wear:</Text>
                <GirlMathBadge label={girlMathLabel} costPerWear={costPerWear} />
              </View>
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            <Button
              title="Save Changes"
              onPress={handleSubmit}
              variant="primary"
              fullWidth
              loading={isSubmitting}
            />
            
            <View style={styles.buttonSpacer} />
            
            <Button
              title="Delete Item"
              onPress={handleDelete}
              variant="danger"
              fullWidth
              loading={isDeleting}
              icon={<Trash2 size={16} color={colors.background} />}
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

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.modalOption,
                    cat === category && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setCategory(cat);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text 
                    style={[
                      styles.modalOptionText,
                      cat === category && styles.modalOptionTextSelected
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Years Selection Modal */}
      <Modal
        visible={showYearsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowYearsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Years of Use</Text>
              <TouchableOpacity onPress={() => setShowYearsModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              {YEARS_OF_USE_OPTIONS.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.modalOption,
                    year === yearsOfUse && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setYearsOfUse(year);
                    setShowYearsModal(false);
                  }}
                >
                  <Text 
                    style={[
                      styles.modalOptionText,
                      year === yearsOfUse && styles.modalOptionTextSelected
                    ]}
                  >
                    {year} {parseInt(year) === 1 ? 'year' : 'years'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Purchased Selection Modal */}
      <Modal
        visible={showPurchasedModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPurchasedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Purchased Status</Text>
              <TouchableOpacity onPress={() => setShowPurchasedModal(false)}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  !purchased && styles.modalOptionSelected
                ]}
                onPress={() => {
                  setPurchased(false);
                  setShowPurchasedModal(false);
                }}
              >
                <Text 
                  style={[
                    styles.modalOptionText,
                    !purchased && styles.modalOptionTextSelected
                  ]}
                >
                  No
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  purchased && styles.modalOptionSelected
                ]}
                onPress={() => {
                  setPurchased(true);
                  setShowPurchasedModal(false);
                }}
              >
                <Text 
                  style={[
                    styles.modalOptionText,
                    purchased && styles.modalOptionTextSelected
                  ]}
                >
                  Yes
                </Text>
              </TouchableOpacity>
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
    paddingBottom: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
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
  formSection: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
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
  textArea: {
    minHeight: 80,
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
  imagePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 12,
  },
  imagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  previewSection: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewLabel: {
    fontSize: 14,
    color: colors.text,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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
    backgroundColor: `${colors.primary}15`,
  },
  modalOptionText: {
    fontSize: 16,
    color: colors.text,
  },
  modalOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});