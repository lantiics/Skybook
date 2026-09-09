module.exports = {
  apps: [
    {
      name: "Skybook-IPMaskingDatabase",
      script: "./src/jobs/update-ip-lists.ts",
      args: "dotenv_config_path=./.env",
      interpreter: "bun",
    },
    {
      name: "Skybook-AccountExpiration",
      script: "./src/jobs/expire-accounts.ts",
      args: "dotenv_config_path=./.env",
      interpreter: "bun",
    },
    {
      name: "Skybook-ScheduledAccountDeletion",
      script: "./src/jobs/scheduled-account-deletion.ts",
      args: "dotenv_config_path=./.env",
      interpreter: "bun",
    },
    {
      name: "Skybook-Enforcements",
      script: "./src/jobs/lift-enforcements.ts",
      args: "dotenv_config_path=./.env",
      interpreter: "bun",
    },

    {
      name: "Skybook",
      script: "./src/app.js",
      args: "dotenv_config_path=./.env",
      interpreter: "bun",
    },
  ],
};
