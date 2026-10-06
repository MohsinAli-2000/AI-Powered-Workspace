/**
 * Platform admin CLI.
 *
 *   npm run platform-admin -- migrate              Apply migrations/001_platform_admin.sql
 *   npm run platform-admin -- grant  you@example.com
 *   npm run platform-admin -- revoke you@example.com
 *   npm run platform-admin -- list
 *
 * Granting is deliberately CLI-only: there is no HTTP endpoint that can create a platform admin.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool, closePool } from '../db/pool.js';

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../migrations'
);

const usage = (): never => {
  console.error('Usage: npm run platform-admin -- <migrate | grant <email> | revoke <email> | list>');
  process.exit(1);
};

const setFlag = async (email: string | undefined, value: boolean): Promise<void> => {
  if (!email) usage();
  const result = await pool.query<{ email: string }>(
    `UPDATE users SET is_platform_admin = $1, updated_at = NOW()
     WHERE LOWER(email) = LOWER($2)
     RETURNING email;`,
    [value, email]
  );
  if (result.rowCount === 0) {
    throw new Error(`No user with email "${email}". Sign up through the app first, then run this again.`);
  }
  console.log(`${value ? 'Granted' : 'Revoked'} platform admin for ${result.rows[0].email}.`);
  if (value) console.log('Sign out and back in (or reload) to see "Platform Admin" in the user menu.');
};

const main = async (): Promise<void> => {
  const [command, argument] = process.argv.slice(2);

  switch (command) {
    case 'migrate': {
      const files = (await readdir(MIGRATIONS_DIR))
        .filter((f) => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const fullPath = path.join(MIGRATIONS_DIR, file);
        const sql = await readFile(fullPath, 'utf8');
        await pool.query(sql);
        console.log(`Applied migrations/${file}`);
      }
      break;
    }

    case 'grant':
      await setFlag(argument, true);
      break;
    case 'revoke':
      await setFlag(argument, false);
      break;
    case 'list': {
      const result = await pool.query<{ email: string; name: string }>(
        'SELECT email, name FROM users WHERE is_platform_admin = TRUE ORDER BY email;'
      );
      if (result.rowCount === 0) console.log('No platform admins.');
      result.rows.forEach((row) => console.log(`${row.email}  (${row.name})`));
      break;
    }
    default:
      usage();
  }
};

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (/column .*is_platform_admin.* does not exist/i.test(message)) {
      console.error('The platform admin columns are missing. Run: npm run platform-admin -- migrate');
    } else {
      console.error(message);
    }
    process.exitCode = 1;
  })
  .finally(() => closePool());
