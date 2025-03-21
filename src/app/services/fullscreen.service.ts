import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FullscreenService {
  private isEnabled = false;

  enableFullscreen() {
    if (this.isEnabled) return;

    // Add a small delay to ensure the DOM is ready
    setTimeout(() => {
      if (
        document.documentElement.requestFullscreen &&
        !document.fullscreenElement
      ) {
        document.documentElement
          .requestFullscreen()
          .catch((err) =>
            console.log('Error attempting to enable full-screen mode:', err)
          );
      }

      // iOS specific full-screen handling
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('ios-app://');

      if (isStandalone) {
        // Apply full-screen styles
        document.documentElement.style.position = 'fixed';
        document.documentElement.style.width = '100%';
        document.documentElement.style.height = '100%';
        document.documentElement.style.top = '0';
        document.documentElement.style.left = '0';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        document.body.style.top = '0';
        document.body.style.left = '0';
        document.body.style.overflow = 'hidden';

        // Prevent scrolling
        document.body.style.touchAction = 'none';
        document.documentElement.style.touchAction = 'none';

        // Handle safe areas
        document.body.style.padding =
          'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
      }

      this.isEnabled = true;
    }, 100);
  }
}
