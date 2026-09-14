# Skybook

Skybook is a fully open-source, self-hostable guestbook host akin to [123Guestbook](https://www.123guestbook.com) and [Atabook](https://atabook.org).

Skybook is currently unfinished but in a very usable state.



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
 - Ability to toggle signup, login, and require an invitation code for signup*
 - Captcha support: Both [Cap](https://trycap.dev) and Cloudflare Turnstile
 - Optional blocking of proxy, VPN, Tor IP addresses instance-wide

<small> *Currently requires manual database queries</small>


# Technical guide

## Configuration
Skybook supports captchas using either [Cap](https://trycap.dev) or Cloudflare Turnstile. Both are configured with Skybook in the same manner, but require manual setup. Skybook does not currently work without captchaing, as they are embedded in serverside endpoints.

After completing setup of either captchaing service, there are some configuration values needed in order to enable captchaing.

The following *need* to be set in order for Skybook to work, alter according to your configuration:
```toml
[skybook]
proxies_between = 1 # If using Cloudflare, required to be at least 1 for Expressjs's 'Trust proxy' setting to actually register IP addresses.
environment = "development"
subdomain_vanity = true # This allows users to have yourname.skybook.page. If disabled, they have a url akin to skybook.page/yourname
cloudflare = true 
user_enforcements_enabled=true
domain="skybook.localhost"
header="Skybook is currently under development, stability can not be guaranteed." # Set to null if not needed
username_max_length=15
username_min_length=3
[captcha]
implementation = "cap"                                       # Available values: cap | cloudflare
token_property_name = "cap-token" # Available values: cap-token | cf-turnstile-response
site_key = "a1b2c3d4" # Set to your site key.

challenge_url = "http://localhost:9000/" # (Only required if using Cap): Set to the *root* path of your Cap instance.
verification_url = "http://localhost:9000/a1b2c3d4/siteverify" # Set to the *absolute* URL of your site verification URL.
```

In your `.env`, set `CAPTCHA_SECRET` to your captcha secret.

## Database setup
Skybook uses two accounts for its database operations, `skybook_reader` and `skybook_writer`. Self explanatory, but assign skybook_reader only SELECT privileges, and skybook_writer both SELECT and WRITE privileges.

The `.env.example` in Skybook's repo root can be used for formatting.

To actually set up the database tables, we use the `migrations` directory. Default SQL scripts are provided. Execute them in order.

We can configure username limits in our `config.toml`, but the `users` database table uses a default type of `VARCHAR(15)`, so if we decide to alter username length we have to alter the length limits specified here.

**INCOMPLETE**