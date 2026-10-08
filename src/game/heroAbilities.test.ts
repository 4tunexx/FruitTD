import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HERO_ABILITIES, emptyHeroAbilityLoadouts, normaliseHeroAbilityLoadouts, MAX_HERO_ABILITIES_EQUIPPED } from './heroAbilities';
import { HEROES } from './heroes';

test('each hero has six unique active powers with bounded three-slot loadouts', () => {
  assert.equal(HERO_ABILITIES.length, HEROES.length * 6);
  assert.equal(new Set(HERO_ABILITIES.map((ability) => ability.id)).size, HERO_ABILITIES.length);
  for (const hero of HEROES) assert.equal(HERO_ABILITIES.filter((ability) => ability.hero === hero.id).length, 6);
  assert.equal(emptyHeroAbilityLoadouts().jiju[0], 'jiju-1');
  const loadouts = normaliseHeroAbilityLoadouts({ jiju: ['jiju-1', 'jiju-2', 'jiju-3', 'jiju-4', 'topfu-1'] });
  assert.equal(loadouts.jiju.length, MAX_HERO_ABILITIES_EQUIPPED);
  assert.ok(loadouts.jiju.every((id) => id.startsWith('jiju-')));
});
