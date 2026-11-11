import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

// Pages built ahead of time (guides, "X vs Y", alternatives, referral codes: about 930 pages) are stored with the
// site's static files and served from there, instead of being put together on every visit. Nothing is revalidated
// at run time: the hourly card-data sync writes to the repo and every change deploys, which rebuilds them all.
// Pages that need the moment of the request (home, rankings, card reviews with live prices, tools) stay dynamic.
export default defineCloudflareConfig({ incrementalCache: staticAssetsIncrementalCache });
