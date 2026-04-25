'use client';

type Listener = (data: any) => void;

/**
 * A simple client-side event emitter for propagating Firebase errors
 * to UI listeners and developer overlays.
 */
class Emitter {
  private listeners: Record<string, Listener[]> = {};

  /**
   * Register a listener for a specific event.
   * Returns an unsubscribe function.
   */
  on(event: string, listener: Listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
    
    return () => {
      this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
    };
  }

  /**
   * Emit an event with data to all registered listeners.
   */
  emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((listener) => listener(data));
    }
  }
}

export const errorEmitter = new Emitter();
