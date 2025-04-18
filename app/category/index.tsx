import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWishlistStore } from '@/store/wishlistStore';
import { ItemCard } from '@/components/ItemCard';
import { colors } from '@/constants/colors';
import { EmptyState } from '@/components/EmptyState';
import { CATEGORIES } from '@/constants/categories';
import { ChevronDown, ListFilter, X } from 'lucide-react-native';

export default function CategoryScreen() {
  const { items } = useWishlistStore();
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  // Filter by category and not purchased
  const filteredItems = items.filter(
    item => item.category === selectedCategory && !item.purchased
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Browse by Category</Text>
        
        <TouchableOpacity 
          style={styles.selectButton}
          onPress={() => setShowCategoryModal(true)}
        >
          <Text style={styles.selectButtonText}>{selectedCategory}</Text>
          <ChevronDown size={16} color={colors.text} />
        </TouchableOpacity>
      </View>

      {filteredItems.length === 0 ? (
        <EmptyState
          title={`No items in ${selectedCategory}`}
          description="Try selecting a different category or add new items."
          actionLabel="Add New Item"
          actionLink="/add"
          icon={<ListFilter size={40} color={colors.primary} />}
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ItemCard item={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

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
                    cat === selectedCategory && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text 
                    style={[
                      styles.modalOptionText,
                      cat === selectedCategory && styles.modalOptionTextSelected
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
    marginBottom: 12,
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
  listContent: {
    padding: 14,
    paddingBottom: 30,
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