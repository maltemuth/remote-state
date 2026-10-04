import eslintConfig from '../../eslint.config';

const config = eslintConfig.map(conf => {
  if ('rules' in conf) {
    return {
      ...conf,
      rules: {
        ...conf.rules,
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
      },
    };
  }
  return conf;
});

export default config;
