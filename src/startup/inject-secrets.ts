if (!process.env.COOKIE_SIGNING_SECRET) {
  const fs = require("fs");
  const secret = require("crypto").randomBytes(32).toString("hex");
  fs.appendFile(".env", `\nCOOKIE_SIGNING_SECRET=${secret}`, (err: Error) => {
    if (err) throw err;
  });
  process.env.COOKIE_SIGNING_SECRET = secret;
}

if (!process.env.IP_HASH_SECRET) {
  const fs = require("fs");
  const secret = require("crypto").randomBytes(32).toString("hex");
  fs.appendFile(".env", `\nIP_HASH_SECRET=${secret}`, (err: Error) => {
    if (err) throw err;
  });
  process.env.IP_HASH_SECRET = secret;
}

if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL not present in environment variables; Is this being ran from the right directory?",
  );
