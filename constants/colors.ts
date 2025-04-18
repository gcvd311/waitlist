export const colors = {
  // Softer, more faint primary colors
  primary: 'rgba(99, 102, 241, 0.8)', // Softer Indigo
  primaryLight: 'rgba(129, 140, 248, 0.7)',
  primaryDark: 'rgba(79, 70, 229, 0.85)',
  
  // Softer, more faint secondary colors
  secondary: 'rgba(244, 114, 182, 0.75)', // Softer Pink
  secondaryLight: 'rgba(249, 168, 212, 0.65)',
  secondaryDark: 'rgba(236, 72, 153, 0.8)',
  
  // Base UI colors
  background: '#ffffff',
  card: '#f9fafb',
  text: '#1f2937',
  textLight: '#6b7280',
  border: '#e5e7eb',
  
  // Softer status colors
  success: 'rgba(16, 185, 129, 0.8)', // Softer green
  warning: 'rgba(245, 158, 11, 0.75)', // Softer amber
  danger: 'rgba(239, 68, 68, 0.75)', // Softer red
  info: 'rgba(59, 130, 246, 0.75)', // Softer blue
  
  // Softer priority colors
  priorityHigh: 'rgba(239, 68, 68, 0.75)',
  priorityMedium: 'rgba(245, 158, 11, 0.75)',
  priorityLow: 'rgba(16, 185, 129, 0.75)',
  priorityVeryLow: 'rgba(107, 114, 128, 0.75)',
};

export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, // Lighter shadow
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, // Lighter shadow
    shadowRadius: 3,
    elevation: 2,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, // Lighter shadow
    shadowRadius: 4,
    elevation: 3,
  },
};