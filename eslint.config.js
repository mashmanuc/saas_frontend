import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import * as parserVue from 'vue-eslint-parser'
import * as parserTypeScript from '@typescript-eslint/parser'

export default [
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: parserVue,
      parserOptions: {
        parser: parserTypeScript,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'no-hardcoded-translations': 'error',
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'axios',
          message: 'Import apiClient from @/utils/apiClient instead. Only apiClient.js and rethrowAsDomainError.ts can import axios directly.'
        }]
      }]
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: parserTypeScript,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'no-hardcoded-translations': 'error',
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'axios',
          message: 'Import apiClient from @/utils/apiClient instead. Only apiClient.js and rethrowAsDomainError.ts can import axios directly.'
        }]
      }]
    },
  },
  {
    files: [
      '**/utils/apiClient.js',
      '**/utils/rethrowAsDomainError.ts'
    ],
    rules: {
      'no-restricted-imports': 'off'
    }
  },
  // INV-RESP-3 — Winterboard must NOT import layoutStore (Dashboard/shared territory).
  // Refs: saas_docs/plans/LAYOUT_SSOT_2026-05-02.md §0.4, INV-RESP-3.
  // WB rooms read viewport via useDeviceMode (own breakpoint scale + INV-5 visualViewport).
  {
    files: ['src/modules/winterboard/**/*.{ts,tsx,vue,js}'],
    ignores: ['**/__tests__/**', '**/tests/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: 'axios',
            message: 'Import apiClient from @/utils/apiClient instead.'
          },
          {
            name: '@/stores/layoutStore',
            message: 'INV-RESP-3: Winterboard must use useDeviceMode (own breakpoint scale + visualViewport INV-5). layoutStore is for Dashboard/shared shell only.'
          },
          {
            name: '@/composables/useResponsiveLayout',
            message: 'INV-RESP-3: Winterboard must use useDeviceMode, not useResponsiveLayout (Dashboard/shared composable, deleted in Stage 5).'
          },
          {
            name: '@/composables/useSidebar',
            message: 'INV-RESP-3: Winterboard does not have a sidebar — useDeviceMode and WBResponsiveShell handle layout. useSidebar is for Dashboard/shared shell only.'
          }
        ]
      }]
    }
  },
  // INV-LAYOUT-9 — Popovers/dropdowns MUST use layout.getViewportSnapshot() (non-reactive).
  // Direct `.viewport.width` / `.viewport.height` MemberExpression subscribes to reactivity → jitter on resize.
  // Refs: saas_docs/plans/LAYOUT_SSOT_2026-05-02.md §7.1 AST guards.
  // PR-G2.5 (Stage 5 final): promoted from 'warn' to 'error' — Stage 5 invariants enforced.
  {
    files: ['src/**/*.{ts,tsx,vue,js}'],
    ignores: [
      '**/__tests__/**',
      '**/tests/**',
      'src/stores/layoutStore.ts',     // store itself defines viewport
      // useResponsiveLayout / useSidebar deleted in Layout SSoT Stage 5.
      'src/composables/useDeviceCapabilities.ts',  // legitimate reactive consumer (orientation, NOT popover)
    ],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "MemberExpression[object.type='MemberExpression'][object.property.name='viewport'][property.name=/^(width|height)$/]",
          message: 'INV-LAYOUT-9: Use layout.getViewportSnapshot() for popovers (non-reactive). Direct *.viewport.{width,height} subscribes to reactivity → jitter on resize.'
        }
      ]
    }
  },
  // Stage 5 (post-sweep) ESLint rules — ACTIVE.
  // useResponsiveLayout + useSidebar are deleted; window.innerWidth restricted
  // outside whitelist. WB rooms (modules/winterboard/**) are domain trust zone
  // per INV-RESP-3 and skip these globals (they have own useDeviceMode).
  // Refs: saas_docs/plans/LAYOUT_SSOT_2026-05-02.md §6 Stage 5.
  {
    files: ['src/**/*.{ts,tsx,vue,js}'],
    ignores: [
      '**/__tests__/**',
      '**/tests/**',
      'src/stores/layoutStore.ts',
      'src/config/breakpoints.ts',
      // WB domain — INV-RESP-3 trust zone (own viewport via useDeviceMode).
      'src/modules/winterboard/**',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: '@/composables/useResponsiveLayout',
            message: 'INV-LAYOUT-1: useResponsiveLayout is deleted. Use useLayoutStore from @/stores/layoutStore.'
          },
          {
            name: '@/composables/useSidebar',
            message: 'INV-LAYOUT-1: useSidebar is deleted. Use useLayoutStore from @/stores/layoutStore.'
          }
        ]
      }]
    }
  },
  {
    plugins: {
      'custom-rules': {
        rules: {
          'no-hardcoded-translations': {
            meta: {
              type: 'problem',
              docs: {
                description: 'Disallow hardcoded user-facing strings that should use i18n',
                category: 'Best Practices',
                recommended: true,
              },
              messages: {
                hardcodedString: 'User-facing text "{{text}}" should use i18n key instead of hardcoded string',
              },
              schema: [],
            },
            create(context) {
              const sourceCode = context.getSourceCode()
              
              function isI18nCall(node) {
                if (!node.parent) return false
                
                // Check for $t() or t() calls
                if (node.parent.type === 'CallExpression') {
                  const callee = node.parent.callee
                  if (callee.type === 'Identifier' && callee.name === 't') return true
                  if (callee.type === 'MemberExpression' && 
                      callee.property.type === 'Identifier' && 
                      callee.property.name === 't') return true
                }
                
                return false
              }
              
              function isConfigOrConstant(node) {
                if (!node.parent) return false
                
                // Allow in object keys
                if (node.parent.type === 'Property' && node.parent.key === node) return true
                
                // Allow in imports/exports
                if (node.parent.type === 'ImportDeclaration' || 
                    node.parent.type === 'ExportNamedDeclaration') return true
                
                // Allow in type annotations
                if (node.parent.type === 'TSLiteralType') return true
                
                return false
              }
              
              function looksLikeUserFacingText(text) {
                // Skip very short strings
                if (text.length < 3) return false
                
                // Skip URLs, paths, technical strings
                if (/^(https?:\/\/|\/|\.\/|@|#)/.test(text)) return false
                if (/^[A-Z_]+$/.test(text)) return false // CONSTANTS
                if (/^\d+$/.test(text)) return false // numbers only
                
                // Check if it contains words (likely user-facing)
                return /[a-zа-яії]{3,}/i.test(text)
              }
              
              return {
                Literal(node) {
                  if (typeof node.value !== 'string') return
                  if (!looksLikeUserFacingText(node.value)) return
                  if (isI18nCall(node)) return
                  if (isConfigOrConstant(node)) return
                  
                  context.report({
                    node,
                    messageId: 'hardcodedString',
                    data: {
                      text: node.value.substring(0, 30) + (node.value.length > 30 ? '...' : ''),
                    },
                  })
                },
                TemplateElement(node) {
                  const text = node.value.cooked
                  if (!text || !looksLikeUserFacingText(text)) return
                  if (isI18nCall(node)) return
                  
                  context.report({
                    node,
                    messageId: 'hardcodedString',
                    data: {
                      text: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
                    },
                  })
                },
              }
            },
          },
        },
      },
    },
  },
]
