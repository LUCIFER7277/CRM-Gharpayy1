module.exports = {
  apps: [
    {
      name: "gharpayy-api",
      cwd: __dirname,
      script: "dist/server/src/index.js",
      env: { NODE_ENV: "production" },
    },
    {
      name: "gharpayy-worker",
      cwd: __dirname,
      script: "dist/server/src/workers/index.js",
      env: { NODE_ENV: "production" },
    },
  ],
};