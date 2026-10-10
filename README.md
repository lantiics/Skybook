# Skybook

Skybook is a fully open-source, self-hostable guestbook host akin to [123Guestbook](https://www.123guestbook.com) and [Atabook](https://atabook.org).

Skybook is currently unfinished but in a very usable state.

The official hosted instance of Skybook is available at [skybook.page](https://skybook.page)

## Features:

- Hashing of all stored IP addresses (alongside a salt)
- Vanity subdomains (yourname.skybook.page)
  - OR: Vanity pages (skybook.page/yourname)
- Optional blocking of proxy, VPN, and Tor IP addresses
- Deletion, editing, hiding of entries
- Ability to reply to entries
- Toggle submission, visibility of your guestbook
- Optionally require approval for all entries before they become visible
- The ability to block post creators
  - This contributes to a global record which can result in the IP address associated with the post being temporarily blocked (IP addresses are not immutable identifiers), or the account associated to be permanently disabled (deleted after 1 year, or as specified per Skybook instance)
- The ability for users to flag posts on your guestbook
  - Posts which surpass a user-defined threshold of flags automatically become queued
  - Flagging can be disabled per-post, and is always unavailable for the guestbook owner
  - Each account/IP address can only flag a post once, we store post flaggers alongside account identifiers/their hashed IP address
- Filters (utilizing regular expressions)
  - Custom per-field filters
  - Custom guestbook-wide filters (applies to all fields)
  - Optionally queue filtered posts (otherwise, they are immediately discarded)
- Creation of custom fields
- Toggling requirement of fields
  - Optionally, specify a replacement value for a field which is required. If no replacement value is specified, posts without that field specified will be rejected.
- Exports
- Imports (maximum of 1000 entries)
- Iframe embedding @ yourinstance/embed

### Skybook Features:

- Ability to toggle signup, login, and require an invitation code for signup\*
- Captcha support: Both [Cap](https://trycap.dev) and Cloudflare Turnstile
- Optional blocking of proxy, VPN, Tor IP addresses instance-wide
- Ability to automatically purge cache if using CloudFlare caching (it is recommended to only enable caching if there is no 'session' cookie, as we do not cache anything for logged-in users)
- Docker support

<small> \*Requires server-side access</small>

# Technical guide

## Docker

Skybook is available containerized using Docker, available at `lanticss/skybook`.

We can use the [sample docker-compose.yml file](/docker-compose.yml) provided at the root of this repository as a starting point. This also contains most of the information necessary to dockerize Skybook.

We can use the information shown in the technical guide to help with configuration. We put Skybook's .env m config.toml, .env.postgres, and docker-compose.yml into the same directory.

Refer to the **Configuration** & **Database setup** sections for configuration.

Postgres's data will be stored in `./postgres_data`.

If we are using [Cap](https://trycap.dev), we need to add Skybook's container to Cap's Docker network. The lines needed to typically do so are commented out in our `docker-compose.yml`.

If everything is correct, Skybook should now work when starting it's container.

You are responsible for data safety.

## Configuration

Skybook supports captchas using either [Cap](https://trycap.dev) or Cloudflare Turnstile. Both are configured with Skybook in the same manner, but require manual setup. Skybook does not currently work without captchaing, as they are embedded in serverside endpoints.

After completing setup of either captchaing service, there are some configuration values needed in order to enable captchaing.

Refer to the [_config.sample.toml_](/config.sample.toml) file. ALl information needed for configuration is inlined.

In your `.env`, set `CAPTCHA_SECRET` to your captcha secret. If you are using CloudFlare and Skybook's cache purging, set `CACHE_CLEARING_TOKEN` to Skybook's CloudFlare API token for purging cache on your domain.

### Database setup

Skybook uses two accounts for its database operations, `skybook_reader` and `skybook_writer`. They need to be set in Skybook's .env. The app creates both roles, sets their permissions, and sets their passwords to what is in Skybook's .env file on every start.

The [.env.example](/.env.example) in Skybook's repo root can be used for formatting.
We must also create a `.env.postgres` file. We can use the `.env.postgres.example` file as a starting point.

```
# THESE DICTATE POSTGRES'S SUPERUSER ACCOUNT
# DO NOT USE THESE DEFAULT VARIABLES

POSTGRES_USER=skybook
POSTGRES_PASSWORD=skybook

# SUPERUSER_DB_URL=postgres://<POSTGRES_USER>:<POSTGRES_PASSWORD>@<POSTGRES_HOST>/<POSTGRES_DB>
# This variable MUST be set, it is used for database operations.
# This must also be set in your .env, as it is used for Skybook database jobs
```

Scripts in the `/migrations` directory are executed as Skybook initializes. Passwords for `skybook_reader` and `skybook_writer` are set on every startup for convenience.

We can configure username limits in our `config.toml`, but the `users` database table uses a default type of `VARCHAR(20)`, so if we decide to alter username length we have to alter the length limits specified here.
