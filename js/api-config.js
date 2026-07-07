window.FINE_DASHBOARD_CONFIG = {
  spreadsheetId: '1XTMe3z8FZ9i4XSyX_N632ZxM8otd3eeQvhTsI6kZWJc',
  sheetName: 'data',

  // Live backend for the current fine database workflow.
  gasEndpoint: 'https://script.google.com/macros/s/AKfycbxKBkV7A7zIhJ2AaOxXk6bNNd3yvF5mDE0WKJhvL5Move36OagNYeTi89KEsI25-Y7XOw/exec',

  // Reserved fields for the next backend/database migration.
  backendMode: 'live-fine-database-gas',
  databaseApiBase: '',
  databaseHealthPath: '',

  useJsonp: true,
  requestTimeoutMs: 20000
};
