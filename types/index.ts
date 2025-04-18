export type WishlistItem = {
  id: string;
  name: string;
  image: string | null;
  originalPrice: number;
  category: Category;
  practicality: number;
  desire: number;
  need: number;
  priceSensibility: number;
  wearsPerMonth: number;
  yearsOfUse: number;
  notes: string;
  purchased: boolean;
  createdAt: number;
  updatedAt: number;
};

export type PriceChange = {
  id: string;
  itemId: string;
  date: number;
  newPrice: number;
};

export type GirlMathEntry = {
  id: string;
  itemId: string;
  date: number;
  justificationLabel: string;
  amountSaved: number;
};

export type Category = 'Self' | 'Family' | 'Friends' | 'Holiday' | 'Other';

export type PriorityLabel = 'Buy Now' | 'Watch for Sale' | 'Wishlist Only' | 'Forget It';
export type GirlMathLabel = 'Steal' | 'Justified' | 'Luxury Logic';