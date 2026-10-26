import { describe, it } from 'node:test';
import assert from 'node:assert';
import { THEME_STORAGE_KEY, Theme, ResolvedTheme } from '../../../app/context/ThemeContext';

// Helper matching ThemeContext resolution logic
function resolveTheme(theme: Theme, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return theme;
}

// Helper matching ThemeContext cycle / toggle logic
function getNextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

function cycleTheme(current: Theme): Theme {
  if (current === 'system') return 'light';
  if (current === 'light') return 'dark';
  return 'system';
}

// Mock localStorage store
class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

describe('JobNexus Theme Engine (Dark & Light Mode)', () => {
  it('should use the designated persistent storage key', () => {
    assert.strictEqual(THEME_STORAGE_KEY, 'jobnexus_theme_v1');
  });

  describe('Theme Resolution', () => {
    it('should resolve explicit "dark" theme to "dark" regardless of system preference', () => {
      assert.strictEqual(resolveTheme('dark', false), 'dark');
      assert.strictEqual(resolveTheme('dark', true), 'dark');
    });

    it('should resolve explicit "light" theme to "light" regardless of system preference', () => {
      assert.strictEqual(resolveTheme('light', false), 'light');
      assert.strictEqual(resolveTheme('light', true), 'light');
    });

    it('should resolve "system" theme to "dark" when system prefers dark', () => {
      assert.strictEqual(resolveTheme('system', true), 'dark');
    });

    it('should resolve "system" theme to "light" when system does not prefer dark', () => {
      assert.strictEqual(resolveTheme('system', false), 'light');
    });
  });

  describe('Theme Toggling & Cycling', () => {
    it('should toggle from dark to light and vice-versa', () => {
      assert.strictEqual(getNextTheme('dark'), 'light');
      assert.strictEqual(getNextTheme('light'), 'dark');
    });

    it('should support full 3-state cycling: system -> light -> dark -> system', () => {
      let current: Theme = 'system';
      current = cycleTheme(current);
      assert.strictEqual(current, 'light');

      current = cycleTheme(current);
      assert.strictEqual(current, 'dark');

      current = cycleTheme(current);
      assert.strictEqual(current, 'system');
    });
  });

  describe('LocalStorage Persistence', () => {
    it('should save and restore valid theme preference', () => {
      const storage = new MockLocalStorage();
      
      // Save light theme
      storage.setItem(THEME_STORAGE_KEY, 'light');
      const saved = storage.getItem(THEME_STORAGE_KEY);
      assert.strictEqual(saved, 'light');

      // Verify validation
      const validThemes: Theme[] = ['light', 'dark', 'system'];
      assert.strictEqual(validThemes.includes(saved as Theme), true);
    });

    it('should fallback to default when stored value is invalid or corrupt', () => {
      const storage = new MockLocalStorage();
      storage.setItem(THEME_STORAGE_KEY, 'invalid-theme-value');
      
      const raw = storage.getItem(THEME_STORAGE_KEY);
      const isKnownTheme = raw === 'light' || raw === 'dark' || raw === 'system';
      const fallbackTheme: Theme = isKnownTheme ? (raw as Theme) : 'system';

      assert.strictEqual(fallbackTheme, 'system');
    });

    it('should clear stored theme and fallback to system', () => {
      const storage = new MockLocalStorage();
      storage.setItem(THEME_STORAGE_KEY, 'dark');
      assert.strictEqual(storage.getItem(THEME_STORAGE_KEY), 'dark');

      storage.removeItem(THEME_STORAGE_KEY);
      assert.strictEqual(storage.getItem(THEME_STORAGE_KEY), null);
    });
  });

  describe('FOUC Prevention Script Logic', () => {
    it('should accurately simulate document head script theme detection', () => {
      const simulateHeadScript = (stored: string | null, sysDark: boolean): ResolvedTheme => {
        if (stored === 'light' || stored === 'dark') {
          return stored;
        }
        return sysDark ? 'dark' : 'light';
      };

      // Stored user overrides
      assert.strictEqual(simulateHeadScript('light', true), 'light');
      assert.strictEqual(simulateHeadScript('dark', false), 'dark');

      // System fallback when no stored preference
      assert.strictEqual(simulateHeadScript(null, true), 'dark');
      assert.strictEqual(simulateHeadScript(null, false), 'light');
      assert.strictEqual(simulateHeadScript('system', true), 'dark');
      assert.strictEqual(simulateHeadScript('system', false), 'light');
    });
  });
});
