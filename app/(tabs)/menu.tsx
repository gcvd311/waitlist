import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { Archive, Coins, Heart, Info, ListFilter, ListPlus, ShoppingBag, Tag } from 'lucide-react-native';
import { useWishlistStore } from '@/store/wishlistStore';
import { FeatureCard } from '@/components/FeatureCard';

export default function MenuScreen() {
  const { girlMathEntries } = useWishlistStore();
  
  // Calculate total "saved"
  const totalSaved = girlMathEntries.reduce((sum, entry) => sum + entry.amountSaved, 0);
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Menu</Text>
        </View>
        
        <View style={styles.content}>
          {/* Actions Section - Now First */}
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>Actions</Text>
            
            <Link href="/" asChild>
              <Button
                title="Home"
                onPress={() => {}}
                variant="outline"
                fullWidth
                icon={<ShoppingBag size={16} color={colors.text} />}
              />
            </Link>
            
            <View style={styles.buttonSpacer} />
            
            <Link href="/category" asChild>
              <Button
                title="View by Category"
                onPress={() => {}}
                variant="outline"
                fullWidth
                icon={<ListFilter size={16} color={colors.text} />}
              />
            </Link>
            
            <View style={styles.buttonSpacer} />
            
            <Link href="/purchased" asChild>
              <Button
                title="Purchased Items"
                onPress={() => {}}
                variant="outline"
                fullWidth
                icon={<Archive size={16} color={colors.text} />}
              />
            </Link>
            
            <View style={styles.buttonSpacer} />
            
            <Link href="/girl-math" asChild>
              <Button
                title="Girl Math Tracker"
                onPress={() => {}}
                variant="secondary"
                fullWidth
                icon={<Coins size={16} color={colors.background} />}
              />
            </Link>
            {totalSaved > 0 && (
              <Text style={styles.savedText}>
                You've "saved" ${totalSaved.toFixed(2)} with Girl Math!
              </Text>
            )}
            
            <View style={styles.buttonSpacer} />
            
            <Link href="/add" asChild>
              <Button
                title="Add New Item"
                onPress={() => {}}
                variant="primary"
                fullWidth
                icon={<ListPlus size={16} color={colors.background} />}
              />
            </Link>
          </View>
          
          {/* About Waitlist Section - Now Second */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>ABOUT WAITLIST</Text>
          </View>
          
          <FeatureCard
            icon={<Heart size={24} color={colors.secondary} />}
            iconBgColor="#f9a8d4"
            title="Track Your Wishlist"
            description="Keep track of items you want to buy and prioritize them based on your needs and desires."
          />
          
          <FeatureCard
            icon={<Coins size={24} color="#8b5cf6" />}
            iconBgColor="#f3f0ff"
            title="Girl Math Calculator"
            description="Calculate cost per wear and see if your purchase is justified using 'girl math' principles."
          />
          
          <FeatureCard
            icon={<Tag size={24} color="#10b981" />}
            iconBgColor="#ecfdf5"
            title="Organize by Category"
            description="Categorize your items to keep your wishlist organized and easy to browse."
          />
          
          <FeatureCard
            icon={<Info size={24} color="#f59e0b" />}
            iconBgColor="#fffbeb"
            title="Priority Scoring"
            description="Each item gets a priority score based on practicality, desire, need, and price sensibility."
          />
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  content: {
    padding: 14,
    paddingBottom: 30,
  },
  sectionHeader: {
    marginVertical: 16,
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    alignItems: 'center',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textLight,
    letterSpacing: 1,
  },
  menuSection: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  buttonSpacer: {
    height: 10,
  },
  savedText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
  },
});