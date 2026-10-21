/**
 * Noticing that a page has come back (0062): shown again after being hidden long
 * enough, or back online, but not after a short switch between tabs, and nothing
 * outside a browser.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { onResume, type Page } from '../../src/resume.js';

/** A page whose visibility, network and clock the test sets */
const fakePage = () => {
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const window = new EventTarget();
  let time = 0;
  return {
    page: { document, window } as unknown as Page,
    now: () => time,
    hide: (at: number) => {
      time = at;
      document.visibilityState = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    },
    show: (at: number) => {
      time = at;
      document.visibilityState = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    },
    online: () => window.dispatchEvent(new Event('online')),
  };
};

describe('onResume', () => {
  it('resumes when the page is shown after being hidden long enough', () => {
    const fake = fakePage();
    let resumed = 0;
    onResume(fake.page, 10_000, () => resumed++, fake.now);
    fake.hide(1_000);
    fake.show(5_000);
    assert.equal(resumed, 0, 'a short switch between tabs');
    fake.hide(6_000);
    fake.show(16_000);
    assert.equal(resumed, 1);
  });

  it('resumes when the network comes back', () => {
    const fake = fakePage();
    let resumed = 0;
    onResume(fake.page, 10_000, () => resumed++, fake.now);
    fake.online();
    assert.equal(resumed, 1);
  });

  it('counts from when a page that starts hidden is first seen', () => {
    const fake = fakePage();
    fake.hide(0);
    let resumed = 0;
    onResume(fake.page, 10_000, () => resumed++, fake.now);
    fake.show(20_000);
    assert.equal(resumed, 1);
  });

  it('stops watching, and watches nothing outside a browser', () => {
    const fake = fakePage();
    let resumed = 0;
    const stop = onResume(fake.page, 10_000, () => resumed++, fake.now);
    stop();
    fake.hide(0);
    fake.show(20_000);
    fake.online();
    assert.equal(resumed, 0);
    assert.doesNotThrow(() => onResume(undefined, 10_000, () => resumed++)());
  });
});
