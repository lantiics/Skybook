## [1.0.0] - 2026-10-26

### <!-- 0 -->🚀 Features

- Implement toggling of ability to flag entries guestbook-wide 
- Script to minify clientside js (closes #37) 
- Script to minify clientside js (closes #37) 
- Version number query in release.sh 
- Implement LengthError for invalid content lengths 
- Implement MFA replay protection (closes #39) 
- Cryptographically hash invitations, session tokens, and entry tokens 
- Store who invited a user if user signed up with invitation 
- Create privacy policy page (closes #40) 
- Implement customization of maximum import counts 

### <!-- 1 -->🐛 Bug Fixes

- User enforcement lifting can cycle through null enforcements 
- Still sending server-generated mfa information client-side, unused server-side 
- Valid recovery codes fail after first login with recovery code 
- LiftUserEnforcements does not select enforcement ids 
- ToggleUserLocked checks against wrong column 
- GlobalBlock incorrectly specifies reason on insertion 
- TryUserEnforcement doesn't count current block when checking blocks 
- Accidental removal of unblockLapsedIps 
- Authentic posts not shown as authentic 
- Returning 202 on submit always says filtered 
- Release.sh specifying v in package.json version 
- Superadmin still checked in some places 
- Tabs not switched based on location hash if notifications disabled 
- No limits on character count of notification urls 
- Instance.js creates popup using raw response status on error 
- Uncaught error if updated instance flag threshold is above postgres limits 
- Field replacements can be above max content length 
- Whitespace-only field replacements can be submitted 
- Author field can be set as not required 
- Header border still visible on mobile 
- Landing page auth buttons not working 
- Instance embed fails 
- Error rendering fails 
- Signup never detected as requiring invitation 
- NotFoundError thrown on invalid invitation, rather than UnauthorizedError 
- Wrong naming of sql migration (unpushed) 
- MFA secrets unsafely stored 
- Users.test.ts expects incorrect responses for invitation testing 
    invitations were changed to be hashed, but testing code was not updated to reflect this

- Release.sh specifying v in package.json version 
- V in package.json version 
- SetupTwoFactor incorrectly called 
- Migrate.ts can run encryption logic before any tables are created 
- Accidentally renamed sql migration 
- Authentic property only added upon edit 
- Some post indicators only showing with authentic=true 

### <!-- 2 -->🚜 Refactor

- Remove superadmin features & key 
- Remove automated user enforcements 
- Remove verbose logging (closes #36; 1.0.0 prep) 
- Only use morgan logging during development 
- Remove verbose logging (closes #36; 1.0.0 prep) 
- Remove dead code, imports, comments; use console.time statements for one-offs 
- Remove hard-coded development banner 
- Optimize for SEO 
- Render error pages in pages.ts 
- Only redirect to skybook root on 404 if on root path of a guestbook 
- Remove unused import, redundant catch statement from users.ts 
- Remove logging from errorStatus (errors.ts) 
- Use const rather than var in app.js 
- Remove superadmin from testing harness baseCtx 
- Convert entry app.js to typescript 
- Remove usage of dotenv 
    bun natively reads .env files, so we do not have a need for dotenv

- Iterate through array for .env secret creation 
- Remove ability to disable TOTP instance-wide 
- Fully remove verbosity; update some logging (closes #36) 
- Use unified decryption/encryption functions for notifications, totp secrets 

### <!-- 3 -->📚 Documentation

- Remove environment from config.sample.toml 
- Normalize usage of 'entry' term (rather than mixed post & entry) 
- Update about.ejs 
- Add site description 
- Update README.md to use Skybook logo, remove indev info 
- Add badges to README.md 
- Update .env.example to reflect added .env vars 
- Introduce Skybook logo w/ footer text 
- Fix typo in README.md 

### <!-- 5 -->🎨 Styling

- Remove TODO from domain/posts.ts (impractical) 
- Remove TBD comment from notifications.ts (decided) 
- Update styling of post authentic indicators 
- Completely overhaul skybook visuals 
- Brighten some elements on hover 
- Update landing text 
- Set invitation requirement notice to information-box class 
- Update error page (closes #41) 
- Update header margin 
- Format elevated-instance.js 
- Add spacing between 2fa disablement and mfa regeneration (account.ejs) 
- Update menu styling, add skybook logo to header 
- Reflect maximum entry count per import in settings 

### <!-- 6 -->🧪 Testing

- Only specify baseTOTPUser.identifier while enabling MFA 
- Update env vars in .gitlab-ci.yml 

### <!-- 7 -->⚙️ Miscellaneous Tasks

- Remove unused src/reserved.ts 
- Ensure entities.d.ts is at parity with db schema 
- Remove dead app.js from root dir (used for iframe testing) 
- Remove dead imports 
- Update bun version in dockerfile 
- Update dependencies 
## [0.12.3] - 2026-10-23

### <!-- 7 -->⚙️ Miscellaneous Tasks

- Update bun version in dockerfile 
- V0.12.3 
## [0.12.2] - 2026-10-17

### <!-- 1 -->🐛 Bug Fixes

- Valid recovery codes fail after first login with recovery code 
    (cherry picked from commit a18e860706a2d2709104b0bee21cf9a5ee76a5e4)


### <!-- 7 -->⚙️ Miscellaneous Tasks

- Update package.json version 
- V0.12.2 
## [0.12.1] - 2026-10-12

### <!-- 1 -->🐛 Bug Fixes

- Failure to check req.ctx.authenticated on some endpoints 

### <!-- 7 -->⚙️ Miscellaneous Tasks

- Add container_name to docker-compose.yml services 
- V0.12.1 
## [0.12.0] - 2026-10-11

### <!-- 0 -->🚀 Features

- Use Bun.cron() rather than setInterval() for jobs 
- Never queue entries made by instance owners 
- Add is_expired col to user_enforcements (prevents infinite expiration) 
- Implement automated user enforcements 
- Allow deletion of non-required, custom fields (closes #28) 
- Create release helper and CHANGELOG.md (closes #16, closes #15) 
- Run files from migrations dir dynamically 
- Use mfa_enabled for mfa gating (#30); implement hashing of recovery... 
- Allow regeneration of recovery codes (closes #21) 
- Migration script (closes #27) 
- Implement limits for invitations 
    each user may only have one invitation active at any given time.
    
    generating a new invitation will replace a currently active invitation if it exists.
    
    invitations expire after a period of 24 hours, configurable in config.toml
    
    **MANUAL INTERVENTION REQUIRED**: Skybook's config.toml must be updated to have an `[invitations]` section, with `expiration_period_hours` set to a number. a database migration is also required, an SQL script has been created in the /migrations directory of Skybook's repository

- Allow disabling of captchas 
- Add Skybook to cap_default network in docker-compose.yml (bridging of cap instance) 
- Add scripts directory to dockerfile 
- Specify networks in docker-compose.yml 
- Experimental helper for docker image creation & pushing (#9) 
- Implement role creation & password setting scripts 
- Use SUPERUSER user for db operations 
- Implement migration helper (closes #32) 
- Implement docker support 
- Create setup scripts 
- Add dev script in package.json 

### <!-- 1 -->🐛 Bug Fixes

- Regex filter can be bypassed with newlines 
- Moderation bypass via editing entry 
- User account blocks not being recorded 
- Skybook import endpoint has no memory size limit 
- Possibility to fully wipe ip list with bad download 
- Ip list updater always sees sources as non-elapsed 
- ToggleUserLocked specifies name=UUID, not user_identifier=UUID 
- Created_at sometimes not insrted in recordUserEnforcement() 
- User enforcement block counts check string against number 
- Lack of cache-control: private header on elevated sessions 
- AuthenticateUser() checks loginEnabled without calling loginEnabled() 
- Individual field filters are case-sensitive 
- Tokens expiry_hours unused for token expiration 
- EntryTokenValid not checking against configured expiration date 
- Session creation uses hardcoded expiration time 
- PasswordIsSafe (for password changing) rules incosistent with signup 
- GetPosts perPage hardcoded as 15 
- 404 may redirect to undefined.skybook.domain 
- Notification urls encrypted unsafely (fixes #19) 
- Align harness to new auth schema 
- .env.example db url names different from README.md 
- Return 409 if trying to signup as existing user (fixes #24) 
- Init iterates through wrong directory 
- Remove copying of example .env files when building docker image (user provided credentials) 
- Pg_isready may listen on unix socket (healthcheck may succeed early) 
- PORT env var does nothing 
- NODE_ENV is unspecified 
- WRITE_DB_URL used instead of SUPERUSER_DB_URL 
- Fix typographical errors, incorrect permissions set 
- Copy tsconfig.json into image 
- Wrong import 
- Altering a field with max field count reached throws an exception (fixes #33) 
- Dockerfile copies non-existent scripts dir 
- Add SUPERUSER_DB_URL var to gitlab-ci.yml, run src/startup/migrate.ts 
- Lapsed ip unblocking uses hardcoded expiration date 
- Incorrect typing on import endpoint 
- Potential for two header-accountment divs in layout.ejs 
- Failed file downloads can create empty file (setup scripts) 
- Stray comment in layout.ejs 
- Post delete buttons are appended clientside even with existing delete btn 

### <!-- 10 -->💼 Other

- Remove dead code from auth.js 
- Create base layout for dockerization; introduce logging of docker port 
- Remove 'currently' from 'currently requires server-side access' 
- Remove trailing space in setup.sh (.env creation) 

### <!-- 2 -->🚜 Refactor

- Remove unusued NOTIFICATION_URL_IV 
- Specify skipping on re-run of setup.sh 
- Use env_file for development postgres 

### <!-- 3 -->📚 Documentation

- Remove default open postgres ports 
- Add descriptive header (#11) 
- Include more description in .env.example, .env.postgres, alongside required .env vars 
- Rename .env.postgres to .env.postgres.example 
- Further annotate config.sample.toml; ensure README.md provides up-to-date configuration instructions 
- Specify db names as fixed in .env.example 
- Fix inconsistent naming with SUPERUSER_DB_URL 
- Specify postgres host as explicit in SUPERUSER_DB_URL (.env) 
- README.md @ database setup instructs to manually set user permissions 
- Fix username max length varchar said to be 15, but actually is 20 
- Specify quick setup script in README.md 
- Pipe init scripts into bash rather than sh 
- Bun --watch src/app.js in raw init guide 
- State captchas as optional in README.md 
- Fix typo in README.md 

### <!-- 5 -->🎨 Styling

- Specify host requirements when outputting .env in setup.sh 

### <!-- 7 -->⚙️ Miscellaneous Tasks

- Remove pm2 dependency; bun.cron() now manages jobs; sys-level cron can manage skybook 
- Update database.sh script to use updated migration scripts 
- Update cliff.toml 
- Set version to 0.12.0 in package.json 
- Uncomment docker pushing in release.sh 
- Uncomment working tree checking in release.sh 
- Update CI bun image to 1.4 
- Fix formatting; remove unused imports 
- Fix formatting (clientside js) 
- V0.12.0 
## [0.11.0] - 2026-10-04

### <!-- 0 -->🚀 Features

- Implement matrix notifications 
- Allow specifying additional notification request headers (header-based auth) 
- Remove expired entry tokens from localStorage (prevents post action buttons from appearing despite invalid credentials) 

### <!-- 1 -->🐛 Bug Fixes

- Properly set active notification service in select elem 
- Use res.clearCookie() on session cookies when performing an action which results in revocation of sessions 
- Only set instance-related html metadata if ctx.instance exists 
## [0.10.0] - 2026-09-30

### <!-- 0 -->🚀 Features

- Hide invitation creation button in account if signup does not require invitation 
- Create .gitlab-ci.yml to run bun tests 
- Require heavy test workflow to run on schedule 
- Implement experimental script to quickly initialize skybook database with docker (for development purposes) 
- Modernize frontend 

### <!-- 1 -->🐛 Bug Fixes

- Properly test user inputted regular expressions before storing them, reject if invalid 
- Missing trailing comma in 001_init.sql 
- Redirect to guestboko root on guestbook 404; redirect to skybook domain on instance 404 at root path 

### <!-- 10 -->💼 Other

- Remove 'can_delete_account' query from userInformation in enforcements.ts (non-existent row, prevents authentication) 
## [0.9.2] - 2026-09-26

### <!-- 10 -->💼 Other

- Remove req.ctx specification from deleteUser() endpoint 
## [0.9.1] - 2026-09-26

### <!-- 10 -->💼 Other

- Make it apparent when a specific skybook instance has disabled notifications globally 
## [0.9.0] - 2026-09-26

### <!-- 0 -->🚀 Features

- Also check req.ctx.instance during elevation logic in authentication middleware 
- Specify null for notifyUser when enabling instance notifications 

### <!-- 10 -->💼 Other

- Rename auth.test.ts to users.test.ts 
- Bypass IP Checking if IP starts with harness 
- Implement TOTP helper 
- Validate OTP checking with login using tests 
- Implement testing for test harness 
- Use UPDATE statement rather than INSERT statement when enabling instance notifications 
- Implement instanceNotificationInfo helper 
- Ensure notification URLs begin with 'https://', elsewise reject 
- Ensure global blocks affect only intended user in posts.test.ts (#3 #4 #6) 
- Ensure post submission with invalid fields rejects (#3 #5) 
- Export createAuthorizedPost, createPostWithRandomizedIP helpers (#3) 
- Declare [{is_queued:queued}] in test for post flags exceeding queue threshold (rather than selecting the entire message) (#3) 
- Disallow editing of posts if trying to delete a required field without replacement. Also use validatedEntry on entry edits. Ensures proper validation on editing. 
- Properly validate required fields during post editing; Properly replace if trying to delete a required field. 
- Validate trying to remove a required field via post edit fails (#3 #5) 
- Set field to empty string if trimmed field content length === 0 
- Allow alteration of parts of author/content fields 
- Return 503 error instead of throwing UnavailableError outside of try/catch block in skybook/route("/notifications")/put 
- Return during notifyUser function if notifications are disabled 
- Remove Hono dependency (former potential framework rewrite), update dependencies 
- Remove leftover replying_enabled CHECK in overrides (001_init.sql) 
- Update typing: Ensure entities.d.ts matches database schema 
- Remove optional values from explicitly being specified as null/undefined in validatedEntry 
- Properly specify proerty name in list-enforcements.ts job 
- Type DEFAULT_INSTANCE_EXPORT as Partial<Instance> 

### <!-- 7 -->⚙️ Miscellaneous Tasks

- Add typing to editPost hasExtra object.keys() 
- Type base ctx exports in text harness 
- Update explicit typing on par with entities.d.ts 
- Add further explicit typing 
## [0.8.0] - 2026-09-22

### <!-- 10 -->💼 Other

- Specify property to set constant to when returning DB rows for counts in flagPost and blockPostCreator 
- Correctly expire old accounts 
- Convert milliseconds to minutes in expire-accounts.ts 
- Properly check if invitation tokens are valid 
- Properly validate fields and their existence in post creation 
- Specify blocklist_*_enabled in instances.ts/_getSpecifiedInstanceStatus 
- Properly do field replacement logic on validatedEntry during an edit 
- Check field.is_required rather than field.required when building entry form in views/partials/instances/entry-form.ejs 
- Specify title for error pages 
- Specify min password length in change-password.ejs as >=, rather than > 
- Remove name attributes from IP block inputs in moderation.ejs 
- Properly sanitize SQL in overrides.ts/_deleteOverride (currently unused) 
- Properly parse imported entry added dates 
- Use promise during importing instance 
- Use instance-information classes for info on /embed route 
- Only show reply deletion button for elevated contexts 
- Set entry.can_flag to false only if the entry creator is the instance owner 
- Properly disallow elevated posts from being flagged 
- Fragmented test message with copy-paste leftovers (i dont know what fragmented means) 
## [0.7.0] - 2026-09-13

### <!-- 10 -->💼 Other

- Use type UUID on instance user_identifier referencing users(identifier) 
- Use correct syntax in migration scripts, update domain/enforcements to accomodate 
- Delete captcha information after captcha failure (prevents both duplicate captchas on repeated failures and captcha validation failing due to multiple captcha fields) 
- Ctx.superAdmin depends on superadmin .env variable EXISTING AS WELL (fixes authentication failure on .env variable being undefined) 
- Validate instanceBlocks.proxy against source==='proxy' (previously source==='vpn') on entry validation 
- Remove extra testing content on entry reply 
- When adding edit listeners, if the editable field is a reply, reply to that post instead of trying to edit a post with a non-existent identifier 
- Properly merge existing content when editing fields 
- README.md specified former name for Skybook 
- Ensure correct tab numbering on elevated-interface.ejs view 
- Specify idx_blocklist_ranges in IP blocklist updating (rather than idx_blocklist_range) 
- Specify correct enforcement reasons when switching on user enforcement to lift 
- Specify 'users' (rather than 'usets') when updating user enforcements (typo) 
- Have one tab pane active on default (prevents both entry form and settings from appearing at once on initial instance admin view) 
- Prevent viewport jumping when switching tabs 
- Return instance status on _getSpecifiedInstanceStatus 
- Properly check whether a post creator is already blocked 
- Multiply account expiration interval  to ensure config var actually goes to minutes. Prevents n minute interval really becoming a n ms interval 
- Also multiply config interval to actually do interval per n minutes and not n ms, this time for lift-enforcements.ts 
