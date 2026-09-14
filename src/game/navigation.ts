export type NavState = 'TITLE' | 'DASHBOARD' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'ADMIN';

export class NavigationController {
  private currentState: NavState = 'TITLE';
  private listeners: Array<(state: NavState) => void> = [];

  get state(): NavState {
    return this.currentState;
  }

  onChange(callback: (state: NavState) => void): void {
    this.listeners.push(callback);
  }

  setState(newState: NavState): void {
    if (this.currentState === newState) return;
    this.currentState = newState;
    this.listeners.forEach(cb => cb(newState));
  }

  isPlaying(): boolean {
    return this.currentState === 'PLAYING';
  }

  isPaused(): boolean {
    return this.currentState === 'PAUSED';
  }

  isInGame(): boolean {
    return this.currentState === 'PLAYING' || this.currentState === 'PAUSED' || this.currentState === 'GAME_OVER';
  }

  canInteract(): boolean {
    return this.currentState === 'PLAYING';
  }
}

export const navigation = new NavigationController();
