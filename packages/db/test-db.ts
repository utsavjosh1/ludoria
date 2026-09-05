import "dotenv/config";
import { createClient } from "@libsql/client";

// This workspace uses libSQL. The old PostgreSQL probe depended on an
// undeclared pg package and prevented the entire monorepo from building.
async function testConnection() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL before running the database connection probe.");
    process.exitCode = 1;
    return;
  }
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  try {
    await client.execute("SELECT 1 AS ok");
    console.log("Database connection and read query succeeded.");
  } catch {
    console.error("Database connection failed. Check the configured URL, token, and network.");
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

void testConnection();
