import { GirlMathLabel, PriorityLabel, WishlistItem } from '@/types';

export const calculatePriorityScore = (
  practicality: number,
  desire: number,
  need: number,
  priceSensibility: number
): number => {
  const score = (practicality * 1) + (desire * 1.5) + (need * 2) - (priceSensibility * 1.25);
  return Math.round(score * 10) / 10; // Round to 1 decimal place
};

export const getPriorityLabel = (score: number): PriorityLabel => {
  if (score >= 15) return 'Buy Now';
  if (score >= 11) return 'Watch for Sale';
  if (score >= 8) return 'Wishlist Only';
  return 'Forget It';
};

export const calculateTotalWears = (wearsPerMonth: number, yearsOfUse: number): number => {
  return wearsPerMonth * 12 * yearsOfUse;
};

export const calculateCostPerWear = (originalPrice: number, totalWears: number): number => {
  if (totalWears === 0) return originalPrice;
  return Math.round((originalPrice / totalWears) * 100) / 100; // Round to 2 decimal places
};

export const getGirlMathLabel = (costPerWear: number): GirlMathLabel => {
  if (costPerWear <= 2) return 'Steal';
  if (costPerWear <= 5) return 'Justified';
  return 'Luxury Logic';
};

export const getItemCalculations = (item: WishlistItem) => {
  const totalWears = calculateTotalWears(item.wearsPerMonth, Number(item.yearsOfUse));
  const costPerWear = calculateCostPerWear(item.originalPrice, totalWears);
  const priorityScore = calculatePriorityScore(
    item.practicality,
    item.desire,
    item.need,
    item.priceSensibility
  );
  const priorityLabel = getPriorityLabel(priorityScore);
  const girlMathLabel = getGirlMathLabel(costPerWear);

  return {
    totalWears,
    costPerWear,
    priorityScore,
    priorityLabel,
    girlMathLabel
  };
};

export const getPriorityColor = (label: PriorityLabel): string => {
  switch (label) {
    case 'Buy Now':
      return 'rgba(16, 185, 129, 0.8)'; // Success color with opacity
    case 'Watch for Sale':
      return 'rgba(245, 158, 11, 0.8)'; // Warning color with opacity
    case 'Wishlist Only':
      return 'rgba(59, 130, 246, 0.8)'; // Info color with opacity
    case 'Forget It':
      return 'rgba(107, 114, 128, 0.8)'; // Gray color with opacity
    default:
      return 'rgba(107, 114, 128, 0.8)';
  }
};

export const getGirlMathColor = (label: GirlMathLabel): string => {
  switch (label) {
    case 'Steal':
      return 'rgba(16, 185, 129, 0.8)'; // Success color with opacity
    case 'Justified':
      return 'rgba(245, 158, 11, 0.8)'; // Warning color with opacity
    case 'Luxury Logic':
      return 'rgba(239, 68, 68, 0.8)'; // Danger color with opacity
    default:
      return 'rgba(107, 114, 128, 0.8)';
  }
};