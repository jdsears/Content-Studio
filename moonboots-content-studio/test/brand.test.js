import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkContent, addUtmTags, pillarSlug } from '../shared/brand.js';

const ids = (text) => checkContent('touchline', text).map(w => w.id);

test('flags dashes but not ordinary hyphens', () => {
  assert.deepEqual(ids('Sunday was great — really great'), ['dash']);
  assert.deepEqual(ids('Under 9s – under 10s'), ['dash']);
  assert.deepEqual(ids('Training was wet - but fun'), ['dash']);
  assert.deepEqual(ids('A well-run, under-9s session'), []);
});

test('flags only/first claims but not football phrases', () => {
  assert.deepEqual(ids('Touchline is the only app you need'), ['only-first']);
  assert.deepEqual(ids('We were the first to do this'), ['only-first']);
  assert.deepEqual(ids('Wicklewood Wanderers dominated the first half'), []);
  assert.deepEqual(ids('Our first session back after half term'), []);
});

test('flags endorsements, Atlas, native app and time savings', () => {
  assert.deepEqual(ids('Approved by the FA'), ['endorsement']);
  assert.deepEqual(ids('An England Football Accredited club'), ['endorsement']);
  assert.deepEqual(ids('Atlas tracks every player'), ['atlas']);
  assert.deepEqual(ids('Download our app on the App Store'), ['native-app']);
  assert.deepEqual(ids('Save 3 hours a week on admin'), ['time-saving']);
  assert.deepEqual(ids('Notes for every player, confirmed by the coach.'), []);
});

test('only Touchline posts are checked', () => {
  assert.deepEqual(checkContent('moonboots', 'The only strategy — really'), []);
});

test('adds UTM tags to register links without them', () => {
  const out = addUtmTags('Sign up at touchline.xyz/register.', { platform: 'linkedin', pillar: 'Parents', pillars: [{ id: 'parents', name: 'Parents' }] });
  assert.equal(out, 'Sign up at https://touchline.xyz/register?utm_source=linkedin&utm_medium=organic_social&utm_campaign=parents.');
});

test('keeps existing query strings and never overwrites UTM tags', () => {
  assert.equal(
    addUtmTags('https://touchline.xyz/register?ref=club', { platform: 'x', pillar: 'clubs' }),
    'https://touchline.xyz/register?ref=club&utm_source=x&utm_medium=organic_social&utm_campaign=clubs',
  );
  const tagged = 'https://touchline.xyz/register?utm_source=newsletter&utm_campaign=autumn';
  assert.equal(addUtmTags(tagged, { platform: 'x', pillar: 'clubs' }), tagged);
});

test('leaves other links alone', () => {
  const text = 'Read more at touchline.xyz/blog and moonbootsconsultancy.net';
  assert.equal(addUtmTags(text, { platform: 'x' }), text);
});

test('pillar slugs come from the pillar id when known', () => {
  const pillars = [{ id: 'coaches', name: 'Coaches & managers' }];
  assert.equal(pillarSlug('Coaches & managers', pillars), 'coaches');
  assert.equal(pillarSlug('Coaching tips & grassroots culture'), 'coaching-tips-grassroots-culture');
  assert.equal(pillarSlug(null), 'general');
});
