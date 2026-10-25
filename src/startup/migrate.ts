import { Glob, SQL } from "bun";
import { join } from "node:path";
import { encryptedSecret } from "../domain/auth";

const MIGRATION_LOCK_KEY = 57568446;
const dir = join(import.meta.dir, "../../migrations");
if (!process.env.SUPERUSER_DB_URL)
  throw new Error(
    "SUPERUSER_DB_URL is not specified in Skybook's environment variables. SUPERUSER_DB_URL is required to run key tasks for Skybook's database.",
  );

// Due to an oversight, MFA secrets were not stored encrypted.
// Luckily, Skybook has not reached a wide audience as of this implementation.
// This one-off encrypts all MFA secrets.
const MFA_ENCRYPTION_MIGRATION_IDENTIFIER = "PROGRAMMATIC-MFA-ENCRYPTION-0000";
const encryptMFA = async (MIGRATOR: SQL) => {
  const data: { identifier: string; totp_secret: string }[] =
    await MIGRATOR`SELECT totp_secret, identifier FROM users WHERE totp_secret IS NOT NULL`;
  await MIGRATOR.begin(async (TX) => {
    for (const { identifier, totp_secret: secret } of data) {
      await TX`UPDATE users SET totp_secret=${encryptedSecret(secret, identifier)} WHERE identifier = ${identifier}`;
    }
  });
  await MIGRATOR`INSERT INTO schema_migrations (name) VALUES (${MFA_ENCRYPTION_MIGRATION_IDENTIFIER})`;
  return;
};

export const runMigrations = async () => {
  console.time("Ran migrations");
  const MIGRATOR = new SQL({ url: process.env.SUPERUSER_DB_URL, max: 1 });
  try {
    await MIGRATOR`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
    await MIGRATOR`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`;

    const migrated = new Set(
      (await MIGRATOR`SELECT name FROM schema_migrations`.values()).map(
        (row: [string[]]) => row[0],
      ),
    );
    if (!migrated.has(MFA_ENCRYPTION_MIGRATION_IDENTIFIER)) {
      console.time("Encrypted all MFA columns");
      await encryptMFA(MIGRATOR);
      console.timeEnd("Encrypted all MFA columns");
    }

    const files: string[] = (
      await Array.fromAsync(new Glob("*.sql").scan({ cwd: dir }))
    ).sort();

    for (const name of files.filter((f) => !migrated.has(f))) {
      console.time(`Applied migration ${name}`);
      await MIGRATOR.begin(async (tx) => {
        await tx.file(join(dir, name));
        await tx`INSERT INTO schema_migrations (name) VALUES (${name})`;
      });
      console.timeEnd(`Applied migration ${name}`);
    }
    const writerURL = new URL(process.env.WRITE_DB_URL!);
    const readerURL = new URL(process.env.READ_DB_URL!);
    const [{ stmt: writerStmt }] =
      await MIGRATOR`SELECT format('ALTER ROLE %I PASSWORD %L', ${decodeURIComponent(writerURL.username)}::text, ${decodeURIComponent(writerURL.password)}::text) AS stmt`;
    const [{ stmt: readerStmt }] =
      await MIGRATOR`SELECT format('ALTER ROLE %I PASSWORD %L', ${decodeURIComponent(readerURL.username)}::text, ${decodeURIComponent(readerURL.password)}::text) AS stmt`;
    await MIGRATOR.unsafe(writerStmt);
    await MIGRATOR.unsafe(readerStmt);
  } finally {
    await MIGRATOR`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`.catch(
      () => {},
    );
    await MIGRATOR.close();
    console.timeEnd("Ran migrations");
  }
};

if (import.meta.main) {
  await runMigrations();
}
