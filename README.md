# KeyHarbour

Independent crypto safety tools for everyday wallet owners. The public app provides an eight-question safety plan, a phishing-link checker, incident guidance, a text export and a monthly calendar reminder. It never connects a wallet or asks for secrets.

## Run

Run `npm start`, then open http://localhost:8874/ in Firefox. There is no production database, API key, build step or sign-up service.

## Checks

- `npm test` runs the risk-assessment and link-parsing checks.
- `npm install` and `npx playwright install firefox` install the pinned browser-test dependencies on a new machine.
- With the local server running, `npm run test:browser` exercises the complete customer flow in Firefox, including a real upstream list refresh.
- `node tests/browser.mjs https://theshumba.github.io/keyharbour/` runs those journeys against the hosted site.

## Threat data

`npm run update:list` downloads and validates the published MetaMask phishing dataset, pins its upstream revision, records retrieval time and preserves the licence. The 2.4 MB snapshot is loaded only when the link checker is used. Users can refresh from the provider in the app. A snapshot older than 48 hours is visibly marked out of date.

This tool checks listed domains, their subdomains, reported page paths and a few address warning signs. It does not fetch submitted sites, resolve redirects, simulate transactions or certify safety. An unlisted domain always remains unresolved.

## Publication

GitHub Pages serves the `pages` branch. The `main` branch contains source, tests and business documents; only `public/` belongs in the published website. After a source release, publish that directory with a subtree split and a normal push to `pages`. Do not force-push. Confirm the hosted files match `public/` after the Pages build completes.

## Business

The positioning, pricing hypotheses, delivery model and owner launch decisions are in [docs/BUSINESS.md](docs/BUSINESS.md). The build contract is [docs/BUILD.md](docs/BUILD.md). Paid services, incorporation, a domain and name clearance have not been completed or represented as available.

Third-party data is attributed to MetaMask/eth-phishing-detect. No affiliation with Ledger, Trezor, MetaMask or Revoke.cash is implied.
