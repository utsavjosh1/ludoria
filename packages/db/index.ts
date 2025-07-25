import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const { DATABASE_URL, DATABASE_AUTH_TOKEN } = process.env;

if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const client = createClient({
  url: DATABASE_URL,
  authToken: DATABASE_AUTH_TOKEN, // optional
});

export const db = drizzle(client, { schema });
export * from "./schema";
