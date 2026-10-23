import { campaignStory } from '../game/campaignStory';
import { getLiveConfig } from '../services/liveConfig';

export function renderCampaignChapter(clearedStage: number): void {
  const story = campaignStory(clearedStage, getLiveConfig().campaignStories);
  if (!story) return;
  const image = document.getElementById('campaign-story-image') as HTMLImageElement | null;
  if (image) {
    if (story.revealImage) image.src = story.revealImage;
    else image.removeAttribute('src');
    image.classList.toggle('hidden', !story.revealImage);
    image.onerror = () => { image.classList.add('hidden'); };
  }
  const chapter = document.getElementById('campaign-story-chapter');
  const title = document.getElementById('campaign-story-title');
  const text = document.getElementById('campaign-story-text');
  const button = document.getElementById('campaign-story-continue');
  if (chapter) chapter.textContent = `CHAPTER ${String(story.chapter).padStart(2, '0')} · STAGE ${clearedStage} CLEARED`;
  if (title) title.textContent = story.title;
  if (text) text.textContent = story.text;
  if (button) button.textContent = clearedStage === 100 ? 'VIEW VICTORY' : 'RETURN TO CAMPAIGN';
  button?.focus();
}
