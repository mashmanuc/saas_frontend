/**
 * One-time script: add missing winterboard keys to en.json
 * Run: node scripts/fix-en-i18n.cjs
 */
const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '..', 'src', 'i18n', 'locales', 'en.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const missing = {
  toolbar: {
    title: 'Toolbar',
    drawingTools: 'Drawing tools',
    colorPalette: 'Color palette',
    strokeSize: 'Stroke size',
    actions: 'Actions',
    selectColor: 'Select color',
    customColor: 'Custom color',
  },
  tools: {
    pen: 'Pen',
    highlighter: 'Highlighter',
    eraser: 'Eraser',
    line: 'Line',
    rectangle: 'Rectangle',
    circle: 'Circle',
    text: 'Text',
    select: 'Select',
    undo: 'Undo',
    redo: 'Redo',
    clear: 'Clear',
  },
  pages: {
    title: 'Pages',
    addPage: 'Add page',
    maxReached: 'Maximum {max} pages reached',
    pageN: 'Page {n}',
  },
  status: {
    idle: 'Idle',
    syncing: 'Syncing...',
    saved: 'Saved',
    savedJustNow: 'Saved just now',
    error: 'Save error',
    errorRetry: 'Error \u2014 retrying...',
    offline: 'Offline',
    retry: 'Retry',
  },
  sessions: {
    title: 'My Boards',
    newSession: 'New Board',
    comingSoon: 'Coming soon',
    hint: 'Create your first board to get started',
    emptyTitle: 'No boards yet',
    emptyMessage: 'Create your first board to start drawing',
    createFirst: 'Create Board',
    loading: 'Loading boards...',
    pages: '{n} pages',
    edited: 'Edited {time}',
    actions: {
      open: 'Open',
      duplicate: 'Duplicate',
      share: 'Share',
      export: 'Export',
      delete: 'Delete',
      rename: 'Rename',
    },
    confirmDelete: {
      title: 'Delete board?',
      message: 'This will permanently delete "{name}". This action cannot be undone.',
      confirm: 'Delete',
      cancel: 'Cancel',
    },
    duplicated: 'Board duplicated',
    deleted: 'Board deleted',
    deleteError: 'Failed to delete board',
    loadError: 'Failed to load boards',
    duplicateError: 'Failed to duplicate board',
  },
  share: {
    title: 'Share Board',
    description: 'Anyone with the link can view this board',
    generateLink: 'Generate Link',
    shareLink: 'Link',
    copy: 'Copy',
    copied: 'Copied!',
    copyError: 'Failed to copy',
    revoke: 'Revoke Link',
    revokeConfirm: 'Are you sure? Everyone with the link will lose access.',
    revoked: 'Link revoked',
    revokeError: 'Failed to revoke link',
    generateError: 'Failed to generate link',
    options: 'Options',
    expires: 'Expires',
    expiresOptions: {
      '1h': '1 hour',
      '24h': '24 hours',
      '7d': '7 days',
      never: 'Never',
    },
    maxViews: 'Max views',
    maxViewsOptions: {
      '10': '10 views',
      '100': '100 views',
      unlimited: 'Unlimited',
    },
    allowDownload: 'Allow download',
    status: {
      active: 'Active',
      expired: 'Expired',
      revoked: 'Revoked',
    },
    viewCount: '{count} view | {count} views',
    close: 'Close',
  },
  export: {
    description: 'Choose a format to export',
    formats: {
      png: 'PNG Image',
      pngDesc: 'Export current page as image',
      pdf: 'PDF Document',
      pdfDesc: 'Export all pages as PDF',
      json: 'JSON Data',
      jsonDesc: 'Export raw board data',
    },
    startExport: 'Export',
    processing: 'Exporting...',
    ready: 'Export ready!',
    download: 'Download',
    retry: 'Retry',
    close: 'Close',
    exportError: 'Failed to start export',
    pollError: 'Failed to check export status',
  },
  error: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred on the board. Your work has been saved.',
    retry: 'Try again',
    showDetails: 'Show error details',
  },
  a11y: {
    toolSelected: '{tool} tool selected',
    undoAction: 'Undo: {action}',
    redoAction: 'Redo: {action}',
    strokeRemoved: 'stroke removed',
    strokeRestored: 'stroke restored',
    skipToCanvas: 'Skip to canvas',
    notifications: 'Notifications',
    dismiss: 'Dismiss',
  },
  room: {
    untitled: 'Untitled',
    undoShortcut: 'Undo (Ctrl+Z)',
    redoShortcut: 'Redo (Ctrl+Shift+Z)',
    exit: 'Exit',
    saving: 'Saving',
    saved: 'Saved',
    saveError: 'Save error',
    offline: 'Offline',
    unsavedChanges: 'Unsaved changes',
    ready: 'Ready',
    prevPage: 'Previous page (PageUp)',
    nextPage: 'Next page (PageDown)',
    addPage: 'Add page',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    zoomReset: 'Reset zoom (Ctrl+0)',
    fitToPage: 'Fit to page',
    pageIndicator: '{current} / {total}',
    followTeacher: 'Follow teacher',
    following: 'Following {name}',
    stopFollowing: 'Stop following',
  },
  sizePresets: {
    thin: 'Thin',
    medium: 'Medium',
    thick: 'Thick',
    extra: 'Extra thick',
  },
  loading: {
    canvas: 'Loading board...',
    canvasSubtitle: 'Preparing workspace',
  },
  emptyCanvas: {
    hint: 'Start drawing here',
  },
  emptySession: {
    title: 'No boards yet',
    message: 'Create your first board to start drawing',
    cta: 'Create Board',
  },
  errorSession: {
    title: 'Failed to load boards',
    retry: 'Try again',
  },
  errorRoom: {
    notFound: 'Session not found',
    loadFailed: 'Failed to load session',
    goBack: 'Back to list',
  },
  time: {
    justNow: 'just now',
    secondsAgo: '{n}s ago',
    minutesAgo: '{n}m ago',
    hoursAgo: '{n}h ago',
    daysAgo: '{n}d ago',
  },
  sessionCard: {
    untitled: 'Untitled',
    pageCount: '{n} pages',
    viewCount: '{count} view | {count} views',
  },
  colorPicker: {
    recent: 'Recent',
    custom: 'Custom',
  },
};

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], source[key]);
    } else if (!(key in target)) {
      target[key] = source[key];
    }
  }
}

if (!en.winterboard) en.winterboard = {};
deepMerge(en.winterboard, missing);

fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');

// Verify
const enAfter = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const uk = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'locales', 'uk.json'), 'utf8'));

function flat(obj, p) {
  p = p || '';
  let r = {};
  for (let k in obj) {
    let np = p ? p + '.' + k : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(r, flat(obj[k], np));
    } else {
      r[np] = obj[k];
    }
  }
  return r;
}

const ukF = flat(uk);
const enF = flat(enAfter);
const stillMissing = Object.keys(ukF).filter(k => !(k in enF) && k.startsWith('winterboard.'));
console.log('Still missing winterboard keys in en.json:', stillMissing.length);
if (stillMissing.length > 0) {
  console.log(stillMissing);
}
