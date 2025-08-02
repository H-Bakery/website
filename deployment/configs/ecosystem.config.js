module.exports = {
  apps: [
    {
      name: 'bakery-api',
      script: 'apps/bakery-api/index.js',
      cwd: '/home/bakery/bakery',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        LOG_LEVEL: 'info',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        LOG_LEVEL: 'info',
      },
      // Logging
      log_file: '/var/log/bakery/bakery-api.log',
      out_file: '/var/log/bakery/bakery-api-out.log',
      error_file: '/var/log/bakery/bakery-api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Process management
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      // Memory management
      max_memory_restart: '500M',

      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,

      // Advanced features
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
      watch_options: {
        followSymlinks: false,
      },

      // Auto restart on file changes (disable in production)
      autorestart: true,

      // Kill timeout
      kill_timeout: 5000,
    },

    {
      name: 'bakery-shop',
      script: 'npm',
      args: 'start',
      cwd: '/home/bakery/bakery/apps/bakery-shop',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_API_URL: 'https://your-domain.com/api',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_API_URL: 'https://your-domain.com/api',
      },

      // Logging
      log_file: '/var/log/bakery/bakery-shop.log',
      out_file: '/var/log/bakery/bakery-shop-out.log',
      error_file: '/var/log/bakery/bakery-shop-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Process management
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      // Memory management (Next.js can use more memory)
      max_memory_restart: '800M',

      // Health monitoring
      health_check_grace_period: 5000,
      health_check_fatal_exceptions: true,

      // Advanced features
      watch: false,
      autorestart: true,
      kill_timeout: 5000,
    },

    {
      name: 'bakery-management',
      script: 'npm',
      args: 'start',
      cwd: '/home/bakery/bakery/apps/bakery-management',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        NEXT_PUBLIC_API_URL: 'https://your-domain.com/api',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        NEXT_PUBLIC_API_URL: 'https://your-domain.com/api',
      },

      // Logging
      log_file: '/var/log/bakery/bakery-management.log',
      out_file: '/var/log/bakery/bakery-management-out.log',
      error_file: '/var/log/bakery/bakery-management-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Process management
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      // Memory management
      max_memory_restart: '800M',

      // Health monitoring
      health_check_grace_period: 5000,
      health_check_fatal_exceptions: true,

      // Advanced features
      watch: false,
      autorestart: true,
      kill_timeout: 5000,
    },

    {
      name: 'bakery-landing',
      script: 'npx',
      args: 'serve -s out -l 3002',
      cwd: '/home/bakery/bakery/apps/bakery-landing',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },

      // Logging
      log_file: '/var/log/bakery/bakery-landing.log',
      out_file: '/var/log/bakery/bakery-landing-out.log',
      error_file: '/var/log/bakery/bakery-landing-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Process management
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      // Memory management (static serving uses minimal memory)
      max_memory_restart: '200M',

      // Advanced features
      watch: false,
      autorestart: true,
      kill_timeout: 3000,
    },
  ],

  // Global PM2 settings
  deploy: {
    production: {
      user: 'bakery',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'https://github.com/yourusername/bakery-monorepo.git',
      path: '/home/bakery/bakery',
      'pre-deploy-local': '',
      'post-deploy':
        'npm install && npm run build:all && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
  },
}
