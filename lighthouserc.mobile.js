// [WB:B7.1] Lighthouse CI — Mobile configuration
// Ref: TASK_BOARD_PHASES.md B7.1, Production Hardening
//
// Mobile preset: throttled CPU (4x slowdown) + network (slow 4G)
// Slightly relaxed thresholds vs desktop

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
        // Mobile preset: CPU throttling + simulated slow 4G
        preset: 'perf',
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 812,
          deviceScaleFactor: 3,
        },
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
        },
        chromeFlags: '--no-sandbox --disable-gpu --disable-dev-shm-usage',
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
        // Category scores (relaxed for mobile)
        'categories:performance': ['warn', { minScore: 0.70 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.90 }],
        'categories:seo': ['warn', { minScore: 0.80 }],
        // Core Web Vitals (relaxed for mobile throttling)
        'first-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 5000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.15 }],
        'total-blocking-time': ['warn', { maxNumericValue: 600 }],
        // Accessibility (same as desktop — no compromise)
        'color-contrast': 'error',
        'image-alt': 'error',
        'label': 'error',
        'button-name': 'error',
        'link-name': 'error',
        'document-title': 'error',
        'html-has-lang': 'error',
        'meta-viewport': 'error',
        // Mobile-specific
        'tap-targets': ['warn', { minScore: 0.90 }],
        'font-size': ['warn', { minScore: 0.90 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
