import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Default config: the Node.js runtime, no extra caching layer configured yet. The hourly card-data sync writes
// files to the repo (not to a running server), so there is no need for an incremental cache override here — every
// deploy already bundles the latest data/cards.json.
export default defineCloudflareConfig();
