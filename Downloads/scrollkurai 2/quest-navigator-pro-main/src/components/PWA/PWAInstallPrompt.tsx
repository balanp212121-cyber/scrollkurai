import { useEffect, useState } from 'react';
import { X, Download, Share, Plus, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';

/**
 * PWA Install Prompt Component
 * 
 * Features:
 * - Android: Uses beforeinstallprompt for native install
 * - iOS: Shows manual instructions (Share → Add to Home Screen)
 * - Respects user dismissal (7-day cooldown, max 3 dismissals)
 * - Never shows on desktop or when already installed
 * - Bottom sheet pattern for mobile UX
 * - Accessible (ARIA labels, focus management)
 * - Touch-friendly (48px min targets)
 */
export function PWAInstallPrompt() {
  const {
    showPrompt,
    isIOS,
    isAndroid,
    isInstallable,
    triggerInstall,
    handleDismiss,
  } = usePWAInstall();

  const [isVisible, setIsVisible] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Animate in after mount with delay
  useEffect(() => {
    if (showPrompt) {
      // Delay showing popup to not overwhelm on first visit
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [showPrompt]);

  // Don't render if shouldn't show
  if (!showPrompt && !showIOSInstructions) return null;

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else if (isAndroid && isInstallable) {
      await triggerInstall();
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => handleDismiss(), 300);
  };

  // iOS Instructions Modal
  if (showIOSInstructions) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && setShowIOSInstructions(false)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-install-title"
      >
        <div
          className="w-full max-w-lg bg-card border-t border-border rounded-t-3xl p-6 pb-8 shadow-2xl animate-slide-up"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 id="ios-install-title" className="text-xl font-bold">
              Install ScrollKurai
            </h2>
            <button
              onClick={() => {
                setShowIOSInstructions(false);
                handleClose();
              }}
              className="p-2 rounded-full hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close instructions"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* iOS Instructions */}
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Add ScrollKurai to your home screen for the full app experience:
            </p>

            {/* Step 1 */}
            <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-xl">
              <div className="flex-shrink-0 w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <span className="text-primary font-bold">1</span>
              </div>
              <div className="flex-1">
                <p className="font-medium mb-1">Tap the Share button</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="p-1.5 bg-primary/20 rounded">
                    <Share className="w-4 h-4 text-primary" />
                  </div>
                  <span>at the bottom of Safari</span>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-xl">
              <div className="flex-shrink-0 w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <span className="text-primary font-bold">2</span>
              </div>
              <div className="flex-1">
                <p className="font-medium mb-1">Tap "Add to Home Screen"</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="p-1.5 bg-primary/20 rounded">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                  <span>scroll down in the share menu</span>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-xl">
              <div className="flex-shrink-0 w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <span className="text-primary font-bold">3</span>
              </div>
              <div className="flex-1">
                <p className="font-medium mb-1">Tap "Add" to confirm</p>
                <p className="text-sm text-muted-foreground">
                  ScrollKurai will appear on your home screen!
                </p>
              </div>
            </div>
          </div>

          {/* Got it button */}
          <Button
            onClick={() => {
              setShowIOSInstructions(false);
              handleClose();
            }}
            className="w-full mt-6 min-h-[48px]"
            size="lg"
          >
            Got it!
          </Button>
        </div>
      </div>
    );
  }

  // Not visible yet - don't render
  if (!isVisible) return null;

  // Android/Default Install Popup (Bottom Sheet)
  return (
    <div
      className={`fixed bottom-20 left-4 right-4 z-[60] transform transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="install-title"
    >
      {/* Bottom Sheet Card */}
      <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Content */}
        <div className="p-4">
          {/* App info row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 id="install-title" className="text-base font-bold truncate">
                Install ScrollKurai
              </h2>
              <p className="text-xs text-muted-foreground">
                Works offline • Faster • Push notifications
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleClose}
              variant="outline"
              className="flex-1 min-h-[48px]"
              size="lg"
            >
              Not now
            </Button>
            <Button
              onClick={handleInstallClick}
              className="flex-1 min-h-[48px] bg-gradient-to-r from-primary to-accent hover:opacity-90"
              size="lg"
            >
              <Download className="w-5 h-5 mr-2" />
              Install
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
