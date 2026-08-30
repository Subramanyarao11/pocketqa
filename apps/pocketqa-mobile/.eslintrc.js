/**
 * The UI conventions in AGENTS.md, enforced. Everything below exists because a
 * file already drifted that way once and nothing caught it.
 */

const NO_RAW_COLOR = {
  selector: "Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
  message:
    "Raw colour literal. Add a semantic key to ThemeColors in src/theme/tokens.ts and read it from useAppTheme().",
};

const NO_RAW_RGBA = {
  selector: "Literal[value=/^rgba?\\(/]",
  message:
    "Raw rgba() literal. Add a semantic key to ThemeColors in src/theme/tokens.ts and read it from useAppTheme().",
};

const NO_MODULE_STYLESHEET = {
  selector:
    "Program > VariableDeclaration > VariableDeclarator > CallExpression[callee.object.name='StyleSheet'][callee.property.name='create']",
  message:
    "Module-level StyleSheet.create can't see the theme. Use `const createStyles = (theme: AppTheme) => ({…})` with useThemeStyles(createStyles).",
};

const UNWRAPPED_CREATE_STYLES = {
  selector: "VariableDeclarator[id.name='createStyles'] > ArrowFunctionExpression",
  message:
    "Wrap the factory in makeStyles(). Unwrapped, the style object is inferred on its own and `flexDirection: \"row\"` widens to `string`, which stops matching ViewStyle.",
};

module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // The RN preset only warns. An inline style is how a magic number gets in.
    'react-native/no-inline-styles': 'error',
    'no-restricted-syntax': ['error', NO_RAW_COLOR, NO_RAW_RGBA],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../theme', '../../theme', '../components', '../../components'],
            message: 'Use the @theme / @components aliases so files can move without rewriting imports.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // Tokens are where colour literals are supposed to live.
      files: ['src/theme/**/*.ts', 'src/theme/**/*.tsx'],
      rules: { 'no-restricted-syntax': 'off' },
    },
    {
      files: ['src/components/**/*.tsx', 'src/features/**/*.tsx'],
      rules: {
        'no-restricted-syntax': [
          'error',
          NO_RAW_COLOR,
          NO_RAW_RGBA,
          NO_MODULE_STYLESHEET,
          UNWRAPPED_CREATE_STYLES,
        ],
      },
    },
    {
      files: ['src/features/**/*.tsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@features/*'],
                message:
                  'Features must not import each other. Promote the shared piece to @components or @domain.',
              },
              {
                group: ['@components/*'],
                message:
                  'Import from "@components". Deep paths bypass the barrel and can resolve to an unexported file.',
              },
              {
                group: ['../theme', '../../theme', '../components', '../../components'],
                message: 'Use the @theme / @components aliases.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
      rules: { 'no-restricted-syntax': 'off', 'react-native/no-inline-styles': 'off' },
    },
  ],
};
