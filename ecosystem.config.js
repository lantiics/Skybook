module.exports = {
  apps: [
    {
      name: "Skybook",
      script: "./src/app.js",
      args: "dotenv_config_path=./.env NODE_ENV=production",
      interpreter: "bun",
    },
  ],
};
