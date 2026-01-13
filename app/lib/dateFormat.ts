/**
 * Global date formatting utility
 * Formats dates consistently across the application
 * 
 * Format: "Jan 14, 2026"
 * 
 * To change the date format globally, modify the options in this function
 */

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'Not set';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }
    
    // Format: "Jan 14, 2026"
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Format date without year (for compact display)
 * Format: "Jan 14"
 */
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return 'Not set';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }
    
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'Invalid date';
  }
}
