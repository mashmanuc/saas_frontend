// [WB:B7.1] Lighthouse CI — Desktop configuration
// Ref: TASK_BOARD_PHASES.md B7.1, Production Hardening
//
// Thresholds:
// - Performance ≥ 0.90
// - Accessibility ≥ 0.95
// - Best Practices ≥ 0.90
// - SEO ≥ 0.80 (warn only)

module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:4173/winterboard',
        'http://localhost:4173/winterboard/new',
      ],
      startServerCommand: 'npm run preview -- --port 4173',
      startServerReadyPattern: 'Local',
      startServerReadyTimeout: 30_000,
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        // Chrome flags for CI stability
        chromeFlags: '--no-sandbox --disable-gpu --disable-dev-shm-usage',
        // Skip network-dependent audits in CI
        skipAudits: [
          'uses-http2',
          'is-on-https',
          'redirects-http',
          'canonical',
        ],
      },
    },
    assert: {
      assertions: {
        // Category scores
        'categories:performance': ['error', { minScore: 0.90 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.90 }],
        'categories:seo': ['warn', { minScore: 0.80 }],
        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 3000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        // Accessibility specifics
        'color-contrast': 'error',
        'image-alt': 'error',
        'label': 'error',
        'button-name': 'error',
        'link-name': 'error',
        'document-title': 'error',
        'html-has-lang': 'error',
        'meta-viewport': 'error',
        // Performance specifics
        'unused-javascript': ['warn', { maxNumericValue: 200000 }],
        'dom-size': ['warn', { maxNumericValue: 1500 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
