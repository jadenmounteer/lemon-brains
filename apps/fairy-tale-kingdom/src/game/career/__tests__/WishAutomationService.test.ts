import { describe, expect, it } from 'vitest';
import { shouldAutoGrant } from '../WishAutomationService';
import { DEFAULT_SANDBOX_SETTINGS } from '../../../kingdom/sandboxSettings';

describe('WishAutomationService.shouldAutoGrant', () => {
  it('defaults on in learning mode', () => {
    expect(shouldAutoGrant(DEFAULT_SANDBOX_SETTINGS, 'learning')).toBe(true);
  });

  it('defaults off in normal mode when sandbox toggle unset', () => {
    expect(shouldAutoGrant({}, 'normal')).toBe(false);
  });

  it('respects explicit sandbox toggle', () => {
    expect(
      shouldAutoGrant(
        { life: { fgmAutoGrant: true } },
        'normal'
      )
    ).toBe(true);
    expect(
      shouldAutoGrant(
        { life: { fgmAutoGrant: false } },
        'learning'
      )
    ).toBe(false);
  });
});
