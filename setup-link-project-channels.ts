/**
 * setup-link-project-channels.ts
 * Links Discord project channels to ~/projects/ paths in the NanoClaw DB.
 * Run from the NanoClaw project root: npx tsx setup-link-project-channels.ts
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { initDatabase, setRegisteredGroup } from './src/db.js';

const PROJECT_ROOT = path.join(os.homedir(), 'projects');

const channels = [
  {
    jid: 'dc:1487193308605190206',
    name: 'Shoggoth #platform-abm',
    folder: 'discord_platform-abm',
    projectPath: path.join(PROJECT_ROOT, 'platform-abm'),
  },
  {
    jid: 'dc:1488284137117974669',
    name: 'Shoggoth #tiktok-audit',
    folder: 'discord_tiktok-audit',
    projectPath: path.join(PROJECT_ROOT, 'tiktok-audit'),
  },
  {
    jid: 'dc:1488284138976051350',
    name: 'Shoggoth #oops',
    folder: 'discord_oops',
    projectPath: path.join(PROJECT_ROOT, 'oops'),
  },
  {
    jid: 'dc:1488284139928158399',
    name: 'Shoggoth #helper',
    folder: 'discord_helper',
    projectPath: path.join(PROJECT_ROOT, 'helper'),
  },
  {
    jid: 'dc:1488284141601685595',
    name: 'Shoggoth #community-competition',
    folder: 'discord_community-competition',
    projectPath: path.join(PROJECT_ROOT, 'community-competition'),
  },
  {
    jid: 'dc:1488284143233269810',
    name: 'Shoggoth #bluesky-scraper',
    folder: 'discord_bluesky-scraper',
    projectPath: path.join(PROJECT_ROOT, 'bluesky-scraper'),
  },
  {
    jid: 'dc:1488284144965521438',
    name: 'Shoggoth #tiktok-descriptive',
    folder: 'discord_tiktok-descriptive',
    projectPath: path.join(PROJECT_ROOT, 'tiktok-descriptive'),
  },
  {
    jid: 'dc:1488284146664210492',
    name: 'Shoggoth #snowball-sampler',
    folder: 'discord_snowball-sampler',
    projectPath: path.join(PROJECT_ROOT, 'snowball-sampler'),
  },
  {
    jid: 'dc:1488607209733623828',
    name: 'Shoggoth #gravity-misinfo',
    folder: 'project_gravity-misinfo',
    projectPath: path.join(PROJECT_ROOT, 'gravity-misinfo'),
  },
  {
    jid: 'dc:1488607210769485885',
    name: 'Shoggoth #political-feature-atlas',
    folder: 'project_political-feature-atlas',
    projectPath: path.join(PROJECT_ROOT, 'political-feature-atlas'),
  },
  {
    jid: 'dc:1488607211910598737',
    name: 'Shoggoth #propaganda-dissent-geometry',
    folder: 'project_propaganda-dissent-geometry',
    projectPath: path.join(PROJECT_ROOT, 'propaganda-dissent-geometry'),
  },
  {
    jid: 'dc:1488607212849860760',
    name: 'Shoggoth #sae-regulatory',
    folder: 'project_sae-regulatory',
    projectPath: path.join(PROJECT_ROOT, 'sae-regulatory'),
  },
];

console.log('=== Creating local project folders ===');
for (const ch of channels) {
  if (!fs.existsSync(ch.projectPath)) {
    fs.mkdirSync(ch.projectPath, { recursive: true });
    console.log(`  mkdir ${ch.projectPath}`);
  } else {
    console.log(`  exists  ${ch.projectPath}`);
  }
}

console.log('\n=== Linking project paths in database ===');
initDatabase();

for (const ch of channels) {
  setRegisteredGroup(ch.jid, {
    name: ch.name,
    folder: ch.folder,
    trigger: '@Shoggoth',
    added_at: new Date().toISOString(),
    requiresTrigger: true,
    isMain: false,
    projectPath: ch.projectPath,
  });
  console.log(`  ✓ ${ch.name} → ${ch.projectPath}`);
}

console.log('\nDone. Restart Nanoclaw:');
console.log('  launchctl kickstart -k gui/$(id -u)/com.nanoclaw');
