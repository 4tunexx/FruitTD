import { updateMissionProgress } from './api';

export async function reportMissionEvent(event: {
  type: 'fruit_slice' | 'combo' | 'wave_clear';
  fruitKind?: string;
  comboCount?: number;
  wave?: number;
  totalSliced?: number;
}): Promise<void> {
  const updates: Array<{ missionId: string; progressDelta?: number; setProgress?: number }> = [];

  if (event.type === 'fruit_slice') {
    // Weekly fruits counter
    updates.push({ missionId: 'weekly_fruits', progressDelta: 1 });

    // Daily lemons/strawberries
    if (event.fruitKind === 'lemon' || event.fruitKind === 'strawberry') {
      updates.push({ missionId: 'daily_lemons', progressDelta: 1 });
    }
  } else if (event.type === 'combo') {
    if (event.comboCount && event.comboCount >= 3) {
      updates.push({ missionId: 'daily_combos', progressDelta: 1 });
    }
  } else if (event.type === 'wave_clear') {
    if (event.wave) {
      updates.push({ missionId: 'daily_wave', setProgress: event.wave });
    }
  }

  if (updates.length > 0) {
    await updateMissionProgress(updates);
  }
}
