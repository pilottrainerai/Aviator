import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

export const isDbConfigured = Boolean(databaseUrl);

export const db = isDbConfigured
  ? drizzle(neon(databaseUrl!), { schema })
  : null;

export { schema };
