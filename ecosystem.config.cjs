module.exports = {
  apps: [
    {
      name: "gharpayy-frontend",
      cwd: __dirname,
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
