import styles from './ComingSoon.module.css';

export default function ComingSoon() {
  return (
    <main className={styles.screen}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.orbit} aria-hidden="true">
          <span className={styles.ring} />
          <span className={styles.core}>
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
              <path d="M16 3L19.5 12.5L29 16L19.5 19.5L16 29L12.5 19.5L3 16L12.5 12.5L16 3Z" fill="currentColor" />
            </svg>
          </span>
        </div>
        <h1 className={styles.title}>Coming <span>Soon</span></h1>
        <div className={styles.dots} aria-hidden="true">
          <span /><span /><span />
        </div>
      </div>
    </main>
  );
}
