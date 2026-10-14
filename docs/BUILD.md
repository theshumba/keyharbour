# KeyHarbour, first release

Build a crypto safety business for everyday holders who own, or are setting up, a hardware wallet. Start with practical prevention tools and sell human-guided setup later. Customers retain their wallets, money and keys.

The alternatives are a custody business, which introduces a different operational and regulatory burden, or a transaction-screening extension, which requires deeper wallet integration. This release chooses a useful independent safety app that can operate immediately without collecting secrets or asking users to sign.

## Product

- A public website explaining the service with one primary action: start a safety check.
- An eight-question guided check that records self-reported habits, identifies gaps and produces a prioritised action plan. It is not a wallet scan or a probability of loss.
- A suspicious-link checker using a current MetaMask phishing-list snapshot, including subdomain matching and basic impersonation warnings. Never visit the submitted URL. Never label an unknown link safe.
- An emergency guide with separate routes for an exposed phrase, an unwanted approval, a lost device and an unexpected support message.
- A printable personal safety plan and a calendar reminder. No phrases, addresses, balances, personal contact details or backup locations collected.
- Explicit local-save choice, export, reset and a privacy page. No accounts, wallet connections, analytics, payment collection or customer support claims.

## Design

Slate-blue navigation, a pale blue working surface, white content, cobalt actions and a single vault illustration. Large system sans-serif headlines and restrained serif accents in the illustration. All colours are semantic CSS tokens. A generous two-column homepage becomes one column on phones. The app places one question at a time in a clear central workspace, with progress and the next action visible.

## Implementation

Vanilla HTML, CSS and JavaScript, served from public/ on GitHub Pages. safety.mjs contains independently testable input parsing, phishing matching and checklist results. app.mjs handles forms, local storage and exports. A Node script retrieves and validates the upstream dataset, stores provenance and preserves its licence. No framework, runtime API keys or database.

## Build order

1. Save the startup proposition, commercial assumptions and source registry.
2. Implement and test URL checks, offline/stale-list behaviour, assessment priorities and input boundaries.
3. Build the landing page, guided app, emergency routes and privacy information.
4. Exercise the actual flow in Firefox at desktop and phone widths, including persistence, export, retry, keyboard use and injected text.
5. Commit the finished source, publish the public assets to GitHub Pages and fetch the live release. Record anything requiring the owner's action.

## Release boundaries

Useful public software is the deliverable. Incorporation, trademark clearance, a bought domain, legal sign-off for the proposed paid service, a business inbox and a paid-service checkout cannot be represented as already completed. Do not promise insurance, asset recovery, automatic blocking, 24-hour monitoring or protection guarantees. The product is independent of Ledger and MetaMask.
