export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'sqlite',
  dbCredentials: {
    url: 'games.db',
  },
  verbose: true,
  strict: true,
};
