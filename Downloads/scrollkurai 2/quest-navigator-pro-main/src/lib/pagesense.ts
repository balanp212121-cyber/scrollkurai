/**
 * Zoho PageSense Analytics Utility (READ-ONLY, FAIL-SAFE)
 * 
 * This utility is for UI analytics and A/B testing ONLY.
 * It NEVER touches: Quest logic, Edge Functions, Power-ups, or Backend state.
 * 
 * Usage (in experimental pages only):
 *   import { trackPageSenseEvent } from '@/lib/pagesense';
 *   trackPageSenseEvent('button_clicked', { section: 'hero' });
 * 
 * @note If PageSense is unavailable, events are silently dropped.
 */

// Type declaration for window.pagesense
declare global {
    interface Window {
        pagesense?: Array<[string, ...unknown[]]>;
    }
}

/**
 * Check if PageSense is available (browser-only)
 */
export function isPageSenseAvailable(): boolean {
    return typeof window !== 'undefined' && Array.isArray(window.pagesense);
}

/**
 * Track a custom event in PageSense (fail-safe, non-blocking)
 * 
 * @param eventName - Name of the event (e.g., 'loading_time', 'button_click')
 * @param metadata - Optional metadata (DO NOT include user data, quest IDs, or power-up states)
 * 
 * @example
 * // ✅ ALLOWED: UI/UX metrics
 * trackPageSenseEvent('page_load_fast');
 * trackPageSenseEvent('cta_visible', { section: 'pricing' });
 * 
 * // ❌ FORBIDDEN: Business/quest data
 * // trackPageSenseEvent('quest_completed', { questId: '...' }); // NEVER DO THIS
 */
export function trackPageSenseEvent(eventName: string, metadata?: Record<string, string | number | boolean>): void {
    // Client-side only
    if (typeof window === 'undefined') return;

    // Fail-safe: If pagesense array doesn't exist, silently return
    if (!Array.isArray(window.pagesense)) {
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[PageSense] Not loaded - skipping event: ${eventName}`);
        }
        return;
    }

    try {
        // Push event to PageSense queue
        const eventData = metadata ? `${eventName}:${JSON.stringify(metadata)}` : eventName;
        window.pagesense.push(['trackEvent', eventData]);

        if (process.env.NODE_ENV === 'development') {
            console.debug(`[PageSense] Event tracked: ${eventName}`);
        }
    } catch {
        // Silently fail - NEVER block app execution
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[PageSense] Failed to track event: ${eventName}`);
        }
    }
}

/**
 * Log PageSense load status (for observability, development only)
 */
export function logPageSenseStatus(): void {
    if (typeof window === 'undefined') return;

    // Only log in development
    if (process.env.NODE_ENV !== 'development') return;

    const isLoaded = isPageSenseAvailable();
    console.debug(`[PageSense] Status: ${isLoaded ? 'Loaded ✅' : 'Not loaded (CDN may be blocked)'}`);
}
