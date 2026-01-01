/**
 * Feature Flags System
 * Central configuration for toggling features on/off
 * All flags default to true per spec requirements
 */

export const FEATURE_FLAGS = {
  // Team Challenges Module
  enable_team_challenges: true,
  
  // Premium Tier Module
  enable_premium_tier: true,
  
  // Power-Ups Store Module
  enable_power_ups: true,
  
  // Premium Feature Expansion
  enable_premium_expansion: true,
  
  // Analytics Dashboard
  enable_analytics_dashboard: true,
  
  // Onboarding Flow
  enable_onboarding_flow: true,
  
  // Manual Payment Review
  enable_manual_payment_review: true,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Check if a feature is enabled
 */
export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
  return FEATURE_FLAGS[flag] ?? false;
};
