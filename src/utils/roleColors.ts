/**
 * Utility to map Matrix Power Levels to Discord-style role colors.
 */

export const getRoleColor = (powerLevel: number): string | undefined => {
  if (powerLevel >= 100) {
    return '#ed4245'; // Admin - Red
  }
  if (powerLevel >= 50) {
    return '#5865f2'; // Moderator - Blurple
  }
  // Standard users return undefined to use theme-defined colors
  return undefined;
};
