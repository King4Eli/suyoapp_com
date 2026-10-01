# API tests

End-to-end tests for the API: the real Express app (`app.js`) on a random
local port, against a throwaway MySQL 8.0 + Redis in Docker that is built from
the real migrations and seed data. Uses Node's built-in test runner; no extra
dependencies.

```sh
npm run test:full    # start containers, migrate, seed, run every test, remove containers
```

While iterating, keep the containers up:

```sh
npm run test:db:up   # once
npm test             # as often as you like
node --env-file=test/test.env --test --test-force-exit test/matching.test.js   # one file
npm run test:db:down
```

- `helpers.js` -- starts the app, blocks all outbound network (SMS gateway,
  Nominatim, s3bender get canned replies), records emails instead of sending
  them (`mailbox`, `lastEmailedCode`), and has fixtures: `createUser`,
  `setPlan`, `giveBoosts`, `otpFor`, `resetData`.
- Every test starts from empty user tables (`resetData`); reference data
  (products, prompts, ...) comes from `db/seed`.
- `test.env` holds only fake credentials and points at the test containers
  (MySQL on 127.0.0.1:33307, Redis on 127.0.0.1:36380). Nothing here can reach
  production.
