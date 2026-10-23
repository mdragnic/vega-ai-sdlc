// calc(), min(), max() and clamp() whose arguments are only tokens or 0, joined by + - * / or commas.
const tokenMath =
  '/^(calc|min|max|clamp)\\(\\s*(var\\(--[a-z0-9-]+\\)|0)(\\s*[-+*/,]\\s*(var\\(--[a-z0-9-]+\\)|0))*\\s*\\)$/';

/**
 * Frontend CSS uses design tokens only (CLAUDE.md, decision #65): every listed property takes
 * `var(--…)` from src/styles/tokens.css or one of the keywords below. Shorthands are expanded,
 * so `border`, `padding` and the like are checked part by part. `font` cannot be expanded
 * reliably, so it takes a whole `--font-…` text style token. tokens.css is exempt.
 * calc(), min(), max() and clamp() are allowed when every value inside is a token or 0 (task 002).
 * @type {import('stylelint').Config}
 */
export default {
  plugins: ['stylelint-declaration-strict-value'],
  ignoreFiles: ['src/styles/tokens.css'],
  rules: {
    'declaration-property-value-allowed-list': {
      font: ['/^var\\(--font-[a-z0-9-]+\\)$/', 'inherit', 'initial', 'unset'],
    },
    // A fallback would carry a raw value past the token rule: var(--x, 12px).
    'declaration-property-value-disallowed-list': {
      '/.*/': ['/var\\(\\s*--[a-z0-9-]+\\s*,/i'],
    },
    'scale-unlimited/declaration-strict-value': [
      [
        '/color$/',
        'fill',
        'stroke',
        'font-family',
        'font-size',
        'font-weight',
        'line-height',
        'letter-spacing',
        '/^margin/',
        '/^padding/',
        'gap',
        'row-gap',
        'column-gap',
        'flex-basis',
        '/^(min-|max-)?(width|height)$/',
        '/^(min-|max-)?(inline|block)-size$/',
        '/^inset/',
        'top',
        'right',
        'bottom',
        'left',
        '/^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?-width$/',
        '/radius$/',
        'box-shadow',
        'text-shadow',
        '/^outline-(width|offset)$/',
      ],
      {
        ignoreVariables: true,
        ignoreFunctions: false,
        ignoreValues: [
          '0',
          'auto',
          'none',
          'inherit',
          'initial',
          'unset',
          'transparent',
          '/^currentcolor$/i',
          '100%',
          '100vh',
          'fit-content',
          'min-content',
          'max-content',
          tokenMath,
        ],
        expandShorthand: true,
        recurseLonghand: true,
        disableFix: true,
      },
    ],
  },
};
