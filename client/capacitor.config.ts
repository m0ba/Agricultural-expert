/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.agriexpert.app',
  appName: '农事专家',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: ['localhost', '127.0.0.1']
  },
  plugins: {
    CapacitorNodeJS: {
      nodeDir: 'nodejs',
      startMode: 'manual'
    }
  }
};

export default config;
