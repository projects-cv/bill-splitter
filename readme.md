# Bill Splitter

An Expo / React Native app for scanning receipts, assigning items to friends, and calculating each person's share. The same app runs on web, iOS, and Android.

## Development

Install dependencies with `npm install`, then run `npm run web` (or `npm start` for Expo). Run `npm test` and `npx tsc --noEmit` to check changes. Build the website with `npx expo export --platform web`; the output is `dist`.

## Phone signup and login

Authentication uses [Descope SMS magic links](https://docs.descope.com/auth-methods/magic-link). Entering a phone number sends a one-time login link; verifying the link creates the account if needed. A successful send alone never signs a user in.

The app is configured for project `P3K6TbhL6uPFJq3qrajpkfH2h98e` and the web callback `https://cvbillsplitter.netlify.app/`. The callback uses a `t` query parameter at the site root, so it does not require a special server route. The token is removed from the browser address before verification.

### Descope setup

1. In [Project Settings](https://app.descope.com/settings/project), select the project above. Add `cvbillsplitter.netlify.app` to **Approved Domains**, without a protocol or trailing slash, and add only the development domains you use. Keep domain validation enabled.
2. In **Authentication Methods → Magic Link**, turn on **Enable method in API and SDK** and save. This is required because the app uses the SDK directly, rather than a Descope flow. Select the built-in Descope connector for **Text Message (SMS)**. Set the redirect URL to `https://cvbillsplitter.netlify.app/`. Use a short expiration, such as 5 minutes, and enable recipient communication limits. See [Magic Link settings](https://docs.descope.com/auth-methods/magic-link/settings).
3. Keep the account on **Free Forever** and use the built-in connector. Do not add a paid SMS provider or messaging package if the app must stay free. As checked October 1, 2026, [Descope includes 100 SMS/voice deliveries per month](https://www.descope.com/pricing); new text logins stop when that shared limit is reached. The app includes a 60-second resend delay; provider-side limits still apply.
4. Deploy the updated app, then test with a phone you control: request a link, open the text, confirm login, reload, sign out, and confirm that reusing the old link fails.

### Troubleshooting failed texts

The app shows a safe Descope error reference when available; it does not display raw provider messages, which can contain personal information. Check the failed request in the Descope audit log for the underlying reason. First verify that **Enable method in API and SDK** is on, the SMS connector is configured, and the approved domain matches the callback. Descope setting changes apply without rebuilding the website.

Documented references include `E061003` (redirect domain not approved), `E071001` (invalid project ID), `E013009` (missing connector), and `E032106` (invalid phone number). `E032101` means SMS delivery failed; inspect its details before assuming it is a rate limit or quota problem. See [Descope common errors](https://docs.descope.com/common-errors). Keep the free plan and existing protections; do not add a paid connector or turn off limits to work around an unexplained failure.

### App configuration and Netlify

The Project ID is a public identifier. No Descope management key or SMS secret belongs in client code or an `EXPO_PUBLIC_` variable.

For local development, merge the values in `.env.example` into `.env`. To verify a login on localhost, set `EXPO_PUBLIC_AUTH_REDIRECT_URL` to the exact local web URL (including its trailing slash) and approve that origin in Descope. A phone cannot reach your computer through `localhost`; use a reachable development URL or the deployed site.

`netlify.toml` defines the build command, `dist` publishing directory, and the public production authentication configuration. Existing Netlify environment variables, if any, should match this configuration. The referrer policy prevents callback URLs from being forwarded as referrers. Deploying requires the normal Netlify deployment workflow; editing these files alone does not update the live site.

For native builds, the registered scheme is `billsplitter` and the login callback is `billsplitter://login`. Configure that redirect in Descope for native testing and build/install an Expo development or production app with this scheme. Expo Go does not register the custom scheme. Native refresh tokens use Expo SecureStore; web refresh tokens use browser local storage. Every restored session is checked with Descope before saved account data becomes available. Sessions refresh before expiration, and signing out clears the local token and requests server-side revocation.

## Saved splits

Sign-in is optional. Guests can scan receipts, split items, and share text requests without an account. Guest splits are kept only while active and are not saved to history. Sign in from the dashboard or Summary to save history; signing in keeps your current split open.

For signed-in users, reaching Summary saves a split. Tap a card in Recent Splits to reopen it. Amount corrections and later edits are saved with that receipt.

Use **Payment details** on the dashboard or Summary to save an optional Venmo username and/or Zelle email or phone. These settings are stored separately for each account on this device and included in shared requests. Guests can send requests containing the amount without payment details. Requests open the device’s share sheet; the app does not automatically send SMS or initiate payments.

History is stored **on the current device/browser, separately for each authenticated user**. It does not sync between devices yet. Signing out clears the active screen and receipt state, while preserving that user's history for their next login. Receipts saved before authentication remain available through an explicit **Import old splits into my account** action; they are not automatically assigned to whichever account logs in first.

There is no shared receipt backend in this app. If cloud storage or server APIs are added, they must validate the Descope session token and enforce ownership server-side; account controls in the UI are not a substitute for server authorization.

## License

MIT
