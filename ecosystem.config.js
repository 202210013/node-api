module.exports = {
  apps: [{
    name: 'localfit',
    script: 'server.js',
    cwd: '/root/node-api',
    env: {
      DB_HOST: 'localhost',
      DB_USER: 'localfit_user',
      DB_PASSWORD: '@1234Localfit',
      DB_NAME: 'e-comm',
      DB_PORT: '3306',
      DB_CHARSET: 'utf8mb4',
      APP_TIMEZONE: 'Asia/Manila'
      IMAGE_BASE_URL: 'https://images.localfit.shop/ecomm-images/',
    }
  }]
}
