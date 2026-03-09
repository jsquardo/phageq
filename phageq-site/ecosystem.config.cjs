module.exports = {
  apps: [{
    name: 'phageq-site',
    script: './dist/server/entry.mjs',
    cwd: '/var/www/phageq/phageq-site',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: 4321,
    },
    error_file: '/var/log/phageq/site-error.log',
    out_file:   '/var/log/phageq/site-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
