/**
 * Davi-Approvals - Main Entry Point
 * Web App + API Handler
 */

function doGet(e) {
  try {
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Davi-Approvals')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (error) {
    return HtmlService.createHtmlOutput('<h1>Error</h1><p>' + error.message + '</p>');
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function normalizeDate(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return value.toString();
}

function apiCall(jsonString) {
  const response = { success: false, data: null, error: null };
  let action = 'unknown';

  try {
    const request = JSON.parse(jsonString);
    action = request.action;
    const args = request.params || {};

    // Ensure database exists
    if (action !== 'initDatabase') {
      try { initDatabase(); } catch(e) {}
    }

    switch (action) {
      // System
      case 'initDatabase':
        response.data = initDatabase();
        break;
      case 'setupSystem':
        response.data = setupSystem(args.spreadsheetId);
        break;
      case 'isSystemConfigured':
        response.data = { configured: isSystemConfigured() };
        response.success = true;
        break;

      // Auth
      case 'login':
        response.data = login(args.email, args.password);
        break;
      case 'getSession':
        response.data = getSession(args.token);
        break;

      // Users
      case 'getUsers':
        response.data = getUsers(args.token);
        break;
      case 'addUser':
        response.data = addUser(args.token, args.name, args.email, args.role);
        break;
      case 'updateUser':
        response.data = updateUser(args.token, args.name, args.email, args.role, args.isActive);
        break;

      // Clients
      case 'getClients':
        response.data = getClients(args.token);
        break;
      case 'addClient':
        response.data = addClient(args.token, args.clientName, args.email);
        break;
      case 'updateClient':
        response.data = updateClient(args.token, args.clientName, args.email, args.isActive);
        break;

      // Documents
      case 'uploadDocuments':
        response.data = uploadDocuments(args.token, args.files);
        break;

      // Approvals
      case 'getPendingApprovals':
        response.data = getPendingApprovals(args.token);
        break;
      case 'approveDocument':
        response.data = approveDocument(args.token, args.auditId);
        break;
      case 'approveAllDocuments':
        response.data = approveAllDocuments(args.token, args.auditIds);
        break;
      case 'rejectDocument':
        response.data = rejectDocument(args.token, args.auditId, args.reason);
        break;

      // Dashboard
      case 'getDashboard':
        response.data = getDashboard(args.token);
        break;

      // Audit
      case 'getAuditLog':
        response.data = getAuditLog(args.token);
        break;

      default:
        response.error = 'Unknown action: ' + action;
    }

    response.success = response.data && response.data.success !== undefined ? response.data.success : !response.error;
  } catch (error) {
    Logger.log('API error in ' + action + ': ' + error.message);
    response.error = error.message;
    response.success = false;
  }

  return JSON.stringify(response);
}
