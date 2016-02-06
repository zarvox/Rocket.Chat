Package.describe({
  name: 'sandstorm:notification',
  version: '0.0.1',
  summary: 'Proxy window.Notification through Sandstorm postMessage API',
  git: ''
});

Package.onUse(function(api) {
  api.addFiles('sandstorm-notification.js', 'client');
  api.export("SandstormNotification");
});

Package.onTest(function(api) {
});
