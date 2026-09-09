# Skybook

Skybook is a fully open-source, self-hostable guestbook host akin to [123Guestbook](https://www.123guestbook.com) and [Atabook](https://atabook.org).

Skybook is currently unfinished but in a very usable state.



## Features:
 - Hashing of all stored IP addresses (alongside a salt)
 - Vanity subdomains (yourname.skybook.page)
   - OR: Vanity pages (skybook.page/yourname)
 - Optional blocking of proxy, VPN, and Tor IP addresses
 - Deletion, editing, hiding of entries
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
 - Optionally, require an invitation code for creating an account
 - Ability to toggle signup, login, and account deletion*
 - Captcha support: Both [Cap](https://trycap.dev) and Cloudflare Turnstile
 - Optional blocking of proxy, VPN, Tor IP addresses instance-wide

<small> *Currently requires manual database queries</small>

# Technical guide