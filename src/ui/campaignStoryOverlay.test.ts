import { installDomStub } from './domStub.test-helper';
installDomStub();
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLiveConfig, setLiveConfig } from '../services/liveConfig';
import { DEFAULT_CAMPAIGN_STORIES } from '../game/campaignStory';
import { renderCampaignChapter } from './campaignStoryOverlay';

test('chapter reveal shows uploaded art and clears it for chapters without art', () => {
  const original = getLiveConfig();
  const root = document.createElement('section');
  for (const id of ['image', 'chapter', 'title', 'text', 'continue']) {
    const node = document.createElement(id === 'image' ? 'img' : id === 'continue' ? 'button' : 'p');
    node.id = `campaign-story-${id}`;
    root.appendChild(node);
  }
  document.body.appendChild(root);
  try {
    const stories = DEFAULT_CAMPAIGN_STORIES.map((story) => ({ ...story }));
    stories[0].revealImage = 'data:image/webp;base64,UklGRg==';
    setLiveConfig({ ...original, campaignStories: stories });
    renderCampaignChapter(5);
    const image = root.querySelector('#campaign-story-image') as HTMLImageElement;
    assert.equal(image.src, stories[0].revealImage);
    assert.equal(image.classList.contains('hidden'), false);
    renderCampaignChapter(10);
    assert.equal(image.classList.contains('hidden'), true);
    assert.equal(root.querySelector('#campaign-story-title')?.textContent, stories[1].title);
    renderCampaignChapter(100);
    assert.equal(root.querySelector('#campaign-story-continue')?.textContent, 'VIEW VICTORY');
  } finally { root.remove(); setLiveConfig(original); }
});
