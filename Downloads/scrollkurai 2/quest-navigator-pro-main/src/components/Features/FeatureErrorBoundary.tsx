import { Component, ErrorInfo, ReactNode } from "react";
import { logFeatureError } from "@/hooks/useFeatureFlags";

interface Props {
    children: ReactNode;
    featureKey: string;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
}

/**
 * Error Boundary for Advanced Features
 * FAIL-SAFE: On any error, silently disables the feature
 * Core loop continues uninterrupted
 */
export class FeatureErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error silently to backend
        logFeatureError(
            this.props.featureKey,
            error.message,
            {
                stack: error.stack,
                componentStack: errorInfo.componentStack
            }
        );

        console.warn(
            `[Feature:${this.props.featureKey}] Error caught and isolated:`,
            error.message
        );
    }

    render() {
        if (this.state.hasError) {
            // Return nothing or fallback - never break parent
            return this.props.fallback || null;
        }

        return this.props.children;
    }
}

/**
 * Higher-order component for feature isolation
 * Wraps any feature component with error boundary
 */
export function withFeatureProtection<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    featureKey: string,
    fallback?: ReactNode
) {
    return function ProtectedComponent(props: P) {
        return (
            <FeatureErrorBoundary featureKey={featureKey} fallback={fallback}>
                <WrappedComponent {...props} />
            </FeatureErrorBoundary>
        );
    };
}
