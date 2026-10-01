# Protected deployment preparation

Status: prepared and locally tested; not deployed. GitHub Pages remains the live host.

Vercel must build from this branch with the root vercel.json. The public output directory is empty. A server function checks Supabase Auth and the existing active tracker account mapping before serving any page or asset. Only the login page and its two assets are public. Account creation is not offered. Existing approved manager/student credentials work for both the portal and tracker.

Build: `node scripts/private-site-build.mjs`
Tests: `node --test tests/private-gateway.test.mjs`

Before production cutover:
1. Deploy a preview and confirm catch-all routing, protected function file inclusion and public output behavior on Vercel.
2. Check anonymous requests for root, each tool, CSS/JS/images/downloads and the default deployment hostname. Confirm only login assets are public; confirm no caching of protected responses.
3. Verify an approved account, rejected account, logout and mobile login through real HTTPS.
4. Attach pelinaybar.com and its alternate hostname to the protected deployment and update domain records.
5. After successful cutover, disable old GitHub Pages and make the repository private. Public GitHub contents otherwise remain readable.

No production protection claim is valid until the old public origin and repository access are handled. Server failures deny access. All protected file requests currently validate Auth and authorization remotely; monitor latency and service limits before broad usage.
