import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GirlMathEntry, PriceChange, WishlistItem } from '@/types';

interface WishlistState {
  items: WishlistItem[];
  priceChanges: PriceChange[];
  girlMathEntries: GirlMathEntry[];
  addItem: (item: Omit<WishlistItem, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateItem: (id: string, updates: Partial<Omit<WishlistItem, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteItem: (id: string) => void;
  addPriceChange: (priceChange: Omit<PriceChange, 'id'>) => string;
  deletePriceChange: (id: string) => void;
  addGirlMathEntry: (entry: Omit<GirlMathEntry, 'id'>) => string;
  deleteGirlMathEntry: (id: string) => void;
  getItemById: (id: string) => WishlistItem | undefined;
  getPriceChangesForItem: (itemId: string) => PriceChange[];
  getGirlMathEntriesForItem: (itemId: string) => GirlMathEntry[];
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      priceChanges: [],
      girlMathEntries: [],
      
      addItem: (item) => {
        const id = Date.now().toString();
        const timestamp = Date.now();
        
        const newItem: WishlistItem = {
          ...item,
          id,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        
        set((state) => ({
          items: [...state.items, newItem],
        }));
        
        return id;
      },
      
      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) => 
            item.id === id 
              ? { ...item, ...updates, updatedAt: Date.now() } 
              : item
          ),
        }));
      },
      
      deleteItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
          priceChanges: state.priceChanges.filter((change) => change.itemId !== id),
          girlMathEntries: state.girlMathEntries.filter((entry) => entry.itemId !== id),
        }));
      },
      
      addPriceChange: (priceChange) => {
        const id = Date.now().toString();
        
        const newPriceChange: PriceChange = {
          ...priceChange,
          id,
        };
        
        set((state) => ({
          priceChanges: [...state.priceChanges, newPriceChange],
        }));
        
        return id;
      },
      
      deletePriceChange: (id) => {
        set((state) => ({
          priceChanges: state.priceChanges.filter((change) => change.id !== id),
        }));
      },
      
      addGirlMathEntry: (entry) => {
        const id = Date.now().toString();
        
        const newEntry: GirlMathEntry = {
          ...entry,
          id,
        };
        
        set((state) => ({
          girlMathEntries: [...state.girlMathEntries, newEntry],
        }));
        
        return id;
      },
      
      deleteGirlMathEntry: (id) => {
        set((state) => ({
          girlMathEntries: state.girlMathEntries.filter((entry) => entry.id !== id),
        }));
      },
      
      getItemById: (id) => {
        return get().items.find((item) => item.id === id);
      },
      
      getPriceChangesForItem: (itemId) => {
        return get().priceChanges.filter((change) => change.itemId === itemId);
      },
      
      getGirlMathEntriesForItem: (itemId) => {
        return get().girlMathEntries.filter((entry) => entry.itemId === itemId);
      },
    }),
    {
      name: 'waitlist-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);