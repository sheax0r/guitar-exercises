<script lang="ts">
  import { HOME_HASH, LEARN_HASH, IDEATE_HASH } from '../routing/hash';
  import { currentTheme, setTheme } from '../storage/theme';

  // The section being shown, or null on the entry page.
  let { section }: { section: 'learn' | 'ideate' | null } = $props();

  let theme = $state(currentTheme());
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(theme);
  }
</script>

<nav class="section-nav" aria-label="Sections">
  <a class="brand" href={HOME_HASH}>Guitar</a>
  <div class="tabs">
    <a href={LEARN_HASH} class:active={section === 'learn'} aria-current={section === 'learn' ? 'page' : undefined}>Learn</a>
    <a href={IDEATE_HASH} class:active={section === 'ideate'} aria-current={section === 'ideate' ? 'page' : undefined}>Ideate</a>
    <button class="theme" onclick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>{theme === 'dark' ? '☀' : '☾'}</button>
  </div>
</nav>

<style>
  .section-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    max-width: 600px;
    margin: 0 auto;
    padding: 12px 16px;
    border-bottom: 1px solid #888;
  }
  a { color: inherit; text-decoration: none; }
  .brand { font-weight: 700; }
  .tabs { display: flex; gap: 4px; }
  .tabs a {
    padding: 6px 14px;
    border: 1px solid transparent;
    border-radius: 999px;
  }
  .tabs a.active {
    background: #ff8c42;
    color: #1a1a1a;
    font-weight: 700;
  }
  .tabs a:not(.active):hover, .theme:hover { border-color: #888; }
  .theme {
    padding: 6px 10px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
</style>
