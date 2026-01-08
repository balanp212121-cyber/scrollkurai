import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FeatureFlags {
    enable_ai_coach: boolean;
    enable_focus_protection: boolean;
    enable_teams: boolean;
    enable_identity_system: boolean;
    enable_leagues: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
    enable_ai_coach: false,
    enable_focus_protection: false,
    enable_teams: false,
    enable_identity_system: false,
    enable_leagues: false,
};

/**
 * Hook to check feature flags
 * FAIL-SAFE: Returns default (disabled) on any error
 */
export function useFeatureFlags() {
    const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFlags();
    }, []);

    const fetchFlags = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('feature_flags')
                .select('flag_key, is_enabled, rollout_percent');

            if (error) throw error;

            if (data) {
                const flagMap = data.reduce((acc, flag) => {
                    acc[flag.flag_key as keyof FeatureFlags] = flag.is_enabled;
                    return acc;
                }, {} as Partial<FeatureFlags>);

                setFlags({ ...DEFAULT_FLAGS, ...flagMap });
            }
        } catch (error) {
            // FAIL-SAFE: Use defaults on error
            console.warn('[FeatureFlags] Failed to fetch, using defaults:', error);
            setFlags(DEFAULT_FLAGS);
        } finally {
            setLoading(false);
        }
    }, []);

    const isEnabled = useCallback((flagKey: keyof FeatureFlags): boolean => {
        return flags[flagKey] ?? false;
    }, [flags]);

    return {
        flags,
        loading,
        isEnabled,
        refresh: fetchFlags,
    };
}

/**
 * Hook for individual feature check with RPC-based rollout
 * Uses server-side percentage calculation
 */
export function useFeature(flagKey: string) {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkFeature();
    }, [flagKey]);

    const checkFeature = async () => {
        try {
            const { data, error } = await supabase.rpc('is_feature_enabled', {
                p_flag_key: flagKey
            });

            if (error) throw error;
            setEnabled(data === true);
        } catch (error) {
            // FAIL-SAFE: Disable feature on error
            console.warn(`[Feature:${flagKey}] Check failed, disabling:`, error);
            setEnabled(false);
        } finally {
            setLoading(false);
        }
    };

    return { enabled, loading };
}

/**
 * Log feature error to backend (silent)
 */
export async function logFeatureError(
    featureKey: string,
    errorMessage: string,
    context?: Record<string, any>
): Promise<void> {
    try {
        await supabase.rpc('log_feature_error', {
            p_feature_key: featureKey,
            p_error_message: errorMessage,
            p_context: context || null
        });
    } catch {
        // Double fail-safe: Never throw on error logging
        console.error(`[FeatureError] Failed to log error for ${featureKey}`);
    }
}
