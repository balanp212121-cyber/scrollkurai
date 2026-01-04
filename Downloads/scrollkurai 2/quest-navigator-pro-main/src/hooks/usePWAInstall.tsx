import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

interface PWAInstallState {
    isInstallable: boolean;
    isInstalled: boolean;
    isIOS: boolean;
    isAndroid: boolean;
    isMobile: boolean;
    isStandalone: boolean;
    showPrompt: boolean;
    wasDismissed: boolean;
    installPrompt: BeforeInstallPromptEvent | null;
}

const STORAGE_KEYS = {
    DISMISSED_AT: 'pwa_install_dismissed_at',
    INSTALLED: 'pwa_installed',
    DISMISS_COUNT: 'pwa_dismiss_count',
};

const DISMISS_COOLDOWN_DAYS = 7;
const MAX_DISMISS_COUNT = 3;

/**
 * Custom hook for PWA install functionality
 * Handles Android (beforeinstallprompt) and iOS (manual instructions)
 */
export function usePWAInstall() {
    const [state, setState] = useState<PWAInstallState>({
        isInstallable: false,
        isInstalled: false,
        isIOS: false,
        isAndroid: false,
        isMobile: false,
        isStandalone: false,
        showPrompt: false,
        wasDismissed: false,
        installPrompt: null,
    });

    // Detect platform and install state
    useEffect(() => {
        const userAgent = navigator.userAgent.toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
        const isAndroid = /android/.test(userAgent);
        const isMobile = isIOS || isAndroid || /mobile/.test(userAgent);

        // Check if running in standalone mode (already installed)
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true ||
            document.referrer.includes('android-app://');

        // Check localStorage for install state
        const wasInstalled = localStorage.getItem(STORAGE_KEYS.INSTALLED) === 'true';
        const isInstalled = isStandalone || wasInstalled;

        // Check if user dismissed recently
        const dismissedAt = localStorage.getItem(STORAGE_KEYS.DISMISSED_AT);
        const dismissCount = parseInt(localStorage.getItem(STORAGE_KEYS.DISMISS_COUNT) || '0', 10);

        let wasDismissed = false;
        if (dismissedAt) {
            const dismissDate = new Date(parseInt(dismissedAt, 10));
            const daysSinceDismiss = (Date.now() - dismissDate.getTime()) / (1000 * 60 * 60 * 24);
            wasDismissed = daysSinceDismiss < DISMISS_COOLDOWN_DAYS || dismissCount >= MAX_DISMISS_COUNT;
        }

        setState(prev => ({
            ...prev,
            isIOS,
            isAndroid,
            isMobile,
            isStandalone,
            isInstalled,
            wasDismissed,
        }));
    }, []);

    // Listen for beforeinstallprompt (Android Chrome/Edge)
    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            const promptEvent = e as BeforeInstallPromptEvent;

            setState(prev => ({
                ...prev,
                isInstallable: true,
                installPrompt: promptEvent,
            }));
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Listen for app installed event
        const installedHandler = () => {
            localStorage.setItem(STORAGE_KEYS.INSTALLED, 'true');
            setState(prev => ({
                ...prev,
                isInstalled: true,
                showPrompt: false,
                installPrompt: null,
            }));
        };

        window.addEventListener('appinstalled', installedHandler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installedHandler);
        };
    }, []);

    // Determine if we should show the prompt
    useEffect(() => {
        const shouldShow =
            state.isMobile &&
            !state.isInstalled &&
            !state.wasDismissed &&
            !state.isStandalone &&
            (state.isInstallable || state.isIOS);

        setState(prev => ({
            ...prev,
            showPrompt: shouldShow,
        }));
    }, [state.isMobile, state.isInstalled, state.wasDismissed, state.isStandalone, state.isInstallable, state.isIOS]);

    // Trigger native install prompt (Android only)
    const triggerInstall = useCallback(async () => {
        if (!state.installPrompt) {
            console.warn('No install prompt available');
            return false;
        }

        try {
            await state.installPrompt.prompt();
            const choice = await state.installPrompt.userChoice;

            if (choice.outcome === 'accepted') {
                localStorage.setItem(STORAGE_KEYS.INSTALLED, 'true');
                setState(prev => ({
                    ...prev,
                    isInstalled: true,
                    showPrompt: false,
                    installPrompt: null,
                }));
                return true;
            } else {
                // User dismissed native prompt
                handleDismiss();
                return false;
            }
        } catch (error) {
            console.error('Install prompt failed:', error);
            return false;
        }
    }, [state.installPrompt]);

    // Handle user dismissing the custom popup
    const handleDismiss = useCallback(() => {
        const dismissCount = parseInt(localStorage.getItem(STORAGE_KEYS.DISMISS_COUNT) || '0', 10);
        localStorage.setItem(STORAGE_KEYS.DISMISSED_AT, Date.now().toString());
        localStorage.setItem(STORAGE_KEYS.DISMISS_COUNT, (dismissCount + 1).toString());

        setState(prev => ({
            ...prev,
            showPrompt: false,
            wasDismissed: true,
        }));
    }, []);

    // Force close popup (for manual control)
    const closePrompt = useCallback(() => {
        setState(prev => ({
            ...prev,
            showPrompt: false,
        }));
    }, []);

    // Reset dismiss state (for testing)
    const resetDismissState = useCallback(() => {
        localStorage.removeItem(STORAGE_KEYS.DISMISSED_AT);
        localStorage.removeItem(STORAGE_KEYS.DISMISS_COUNT);
        localStorage.removeItem(STORAGE_KEYS.INSTALLED);
        window.location.reload();
    }, []);

    return {
        ...state,
        triggerInstall,
        handleDismiss,
        closePrompt,
        resetDismissState,
    };
}
