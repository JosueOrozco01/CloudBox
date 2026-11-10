import test from 'node:test';
import assert from 'node:assert/strict';
import { positionTourCard, spotlightBounds } from '../src/components/PageGuide/tourGeometry.js';
import { getPageGuide, getTourSteps } from '../src/components/PageGuide/guideContent.js';

test('the spotlight clips partially hidden targets to the viewport', () => {
  assert.deepEqual(spotlightBounds({ left: -20, top: -50, right: 350, bottom: 90 }, { width: 320, height: 700 }), { left: 6, top: 6, right: 314, bottom: 98, width: 308, height: 92 });
  assert.equal(spotlightBounds({ left: 40, top: 900, right: 90, bottom: 1000 }, { width: 320, height: 700 }), null);
});

test('tour cards stay inside mobile and desktop viewports, even in landscape', () => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 800 }, { width: 768, height: 375 }, { width: 1440, height: 900 }]) {
    for (const target of [null, { left: 6, top: 6, right: 200, bottom: 80, width: 194, height: 74 }, { left: 6, top: 10, right: viewport.width - 6, bottom: viewport.height - 6, width: viewport.width - 12, height: viewport.height - 16 }]) {
      const card = positionTourCard(target, { height: 330 }, viewport);
      assert.ok(card.left >= 16);
      assert.ok(card.top >= 16);
      assert.ok(card.left + card.width <= viewport.width - 16);
      assert.ok(card.top + card.height <= viewport.height - 16);
    }
  }
});

test('a card below a target points toward its center and does not cover it', () => {
  const target = { left: 200, top: 90, right: 400, bottom: 140, width: 200, height: 50 };
  const card = positionTourCard(target, { height: 300 }, { width: 1280, height: 800 });
  assert.equal(card.side, 'bottom');
  assert.ok(card.top > target.bottom);
  assert.equal(card.left + card.arrow, 300);
});

test('contextual tour steps keep their instructions and point at the intended controls', () => {
  const shared = getTourSteps(getPageGuide('/compartidos'));
  assert.equal(shared.length, 4);
  assert.equal(shared[0].targets[0], '.sc-scope-tabs');
  assert.equal(shared[2].targets[0], '.sc-navigation-actions .sc-primary');
  const preferences = getTourSteps(getPageGuide('/perfil', '?tab=preferencias'));
  assert.equal(preferences[1].targets[0], '.pref-save-btn');
  assert.ok(preferences.every(step => step.text && step.title && step.targets.length));
});
