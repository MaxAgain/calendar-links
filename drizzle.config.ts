import { defineConfig } from 'drizzle-kit';

// Migrations run over the direct (non-pooled) connection, as Neon recommends.
export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '',
  },
});
