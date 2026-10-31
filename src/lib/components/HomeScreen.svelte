<script lang="ts">
  import { LEARN_HASH, IDEATE_HASH } from '../routing/hash';
</script>

<div class="home">
  <h1>Guitar</h1>
  <div class="sections">
    <a class="section" href={LEARN_HASH} data-section="learn">
      <strong>Learn</strong>
      <span>Fretboard and mode exercises: notes, intervals, shapes, ear.</span>
    </a>
    <a class="section" href={IDEATE_HASH} data-section="ideate">
      <strong>Ideate</strong>
      <span>Whistle, hum, sing or play an idea and turn it into tab.</span>
    </a>
  </div>
</div>

<style>
  .home {
    max-width: 600px;
    margin: 40px auto 0;
    padding: 0 16px 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .sections { display: grid; grid-template-columns: 1fr; gap: 12px; }
  @media (min-width: 520px) {
    .sections { grid-template-columns: 1fr 1fr; }
  }
  .section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 20px;
    border: 1px solid #888;
    border-radius: 8px;
    color: inherit;
    text-decoration: none;
  }
  .section:hover { border-color: #ff8c42; box-shadow: inset 0 0 0 1px #ff8c42; }
  .section strong { font-size: 20px; }
  .section span { opacity: 0.7; font-size: 14px; }
</style>
