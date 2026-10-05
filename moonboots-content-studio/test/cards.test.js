import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { renderTouchlineCard, fallbackHeadline, makePostImage, CARD_SIZES } from '../server/cards.js';

test('renders a Touchline card at the right size for each platform', async () => {
  for (const platform of Object.keys(CARD_SIZES)) {
    const url = await renderTouchlineCard({ headline: 'Every child has a plan at Wicklewood Wanderers', platform });
    assert.ok(url.startsWith('data:image/png;base64,'));
    const meta = await sharp(Buffer.from(url.split(',')[1], 'base64')).metadata();
    assert.deepEqual({ width: meta.width, height: meta.height }, CARD_SIZES[platform]);
  }
});

test('the fallback headline is the first sentence without links or hashtags', () => {
  assert.equal(
    fallbackHeadline('Parents see the plan in the Player Lounge. Sign up at touchline.xyz/register #grassroots'),
    'Parents see the plan in the Player Lounge.',
  );
});

test('cards are made for Touchline only, and work without a Claude key', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.CLAUDE_API_KEY;
  await assert.rejects(makePostImage({ slug: 'moonboots' }, { platform: 'linkedin', content: 'x' }), /Touchline only/);
  const url = await makePostImage({ slug: 'touchline' }, { platform: 'instagram', content: 'Rainy Tuesday session ideas.', image_style: 'white mark' });
  assert.ok(url.startsWith('data:image/png'));
});
