export const injectSecrets = () => {
  const fs = require("fs");

  [
    "COOKIE_SIGNING_SECRET",
    "IP_HASH_SECRET",
    "SESSION_HASH_SECRET",
    "TOKEN_HASH_SECRET",
    "INVITATION_HASH_SECRET",
    "NOTIFICATION_URL_KEY",
    "TOTP_SECRET_KEY",
  ].forEach((key) => {
    if (!process.env[key]) {
      const secret = require("crypto").randomBytes(32).toString("hex");
      fs.appendFile(".env", `\n${key}=${secret}`, (err: Error) => {
        if (err) throw err;
      });
      process.env[key] = secret;
    }
  });
  if (!process.env.WRITE_DB_URL)
    throw new Error(
      "WRITE_DB_URL not present in environment variables; Is this being ran from the right directory?",
    );

  if (!process.env.READ_DB_URL)
    throw new Error(
      "WRITE_DB_URL not present in environment variables; Is this being ran from the right directory?",
    );
};
