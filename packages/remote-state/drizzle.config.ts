export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'games.db',
  },
  verbose: true,
  strict: true,
};
