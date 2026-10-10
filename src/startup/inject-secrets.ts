export const injectSecrets = () => {
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
  if (!process.env.NOTIFICATION_URL_KEY) {
    const fs = require("fs");
    const secret = require("crypto").randomBytes(32).toString("hex");
    fs.appendFile(".env", `\nNOTIFICATION_URL_KEY=${secret}`, (err: Error) => {
      if (err) throw err;
    });
    process.env.NOTIFICATION_URL_KEY = secret;
  }
  if (!process.env.WRITE_DB_URL)
    throw new Error(
      "WRITE_DB_URL not present in environment variables; Is this being ran from the right directory?",
    );

  if (!process.env.READ_DB_URL)
    throw new Error(
      "WRITE_DB_URL not present in environment variables; Is this being ran from the right directory?",
    );
};
