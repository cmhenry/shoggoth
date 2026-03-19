/**
 * Import a Zotero .bib file into the content registry.
 * Usage: npx tsx scripts/import-zotero.ts path/to/library.bib
 */
import fs from 'fs';
import { ContentRegistry } from '../src/tools/content-registry.js';
import { readEnvFile } from '../src/env.js';

async function main() {
  const bibPath = process.argv[2];
  if (!bibPath) {
    console.error(
      'Usage: npx tsx scripts/import-zotero.ts path/to/library.bib',
    );
    process.exit(1);
  }

  if (!fs.existsSync(bibPath)) {
    console.error(`File not found: ${bibPath}`);
    process.exit(1);
  }

  const env = readEnvFile(['OPENAI_API_KEY', 'POSTGRES_PASSWORD']);
  if (!env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not found in .env');
    process.exit(1);
  }

  const pgUrl = `postgresql://shoggoth:${env.POSTGRES_PASSWORD}@127.0.0.1:5432/shoggoth`;
  const registry = new ContentRegistry({
    connectionString: pgUrl,
    openaiApiKey: env.OPENAI_API_KEY,
  });

  await registry.initSchema();
  console.log('Schema initialized.');

  const content = fs.readFileSync(bibPath, 'utf-8');
  console.log(`Importing from: ${bibPath}`);

  const result = await registry.importZoteroBib(content);
  console.log(`Indexed: ${result.indexed}, Skipped: ${result.skipped}`);
  if (result.errors.length > 0) {
    console.error('Errors:');
    for (const e of result.errors) {
      console.error(`  ${e}`);
    }
  }

  await registry.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
