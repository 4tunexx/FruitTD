import { campaignStory } from '../game/campaignStory';
import { getLiveConfig } from '../services/liveConfig';

export function renderCampaignChapter(clearedStage: number): void {
  const story = campaignStory(clearedStage, getLiveConfig().campaignStories);
  if (!story) return;
  const chapter = document.getElementById('campaign-story-chapter');
  const title = document.getElementById('campaign-story-title');
  const text = document.getElementById('campaign-story-text');
  const button = document.getElementById('campaign-story-continue');
  if (chapter) chapter.textContent = `CHAPTER ${String(story.chapter).padStart(2, '0')} · STAGE ${clearedStage} CLEARED`;
  if (title) title.textContent = story.title;
  if (text) text.textContent = story.text;
  if (button) button.textContent = clearedStage === 100 ? 'VIEW VICTORY' : `ENTER STAGE ${clearedStage + 1}`;
  button?.focus();
}
