/**
 * G-Flow Approval System - Main Entry Point
 * Web App + API Handler
 */

function doGet(e) {
  try {
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('G-Flow Approval System')
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
    const params = request.params || {};
    const args = params || {};
    
    Logger.log('API Request: ' + action);

    // Auto-heal missing sheets (if user dynamically deleted them post-setup)
    if (action !== 'isSystemConfigured' && action !== 'setupSystem' && isSystemConfigured()) {
      ensureDatabase();
    }

    switch (action) {
      // System
      case 'isSystemConfigured':
        response.data = { configured: isSystemConfigured() };
        response.success = true;
        break;
      case 'setupSystem':
        response.data = setupSystem(args.spreadsheetId);
        break;
      case 'bootstrapDatabase':
        response.data = bootstrapDatabase();
        break;
      case 'getConfigStatus':
        response.data = getConfigStatus();
        response.success = true;
        break;
      case 'getDashboardStats':
        response.data = getDashboardStats(args.token);
        break;

      // Auth
      case 'login':
        response.data = login(args.email, args.password);
        break;
      case 'logout':
        response.data = logout(args.token);
        break;
      case 'getSession':
        response.data = getSession(args.token);
        break;
      case 'changePassword':
        response.data = changePassword(args.token, args.oldPassword, args.newPassword);
        break;

      // Users
      case 'getAllUsers':
        response.data = getAllUsers(args.token);
        break;
      case 'createUser':
        response.data = createUser(args.token, args.email, args.password, args.role, args.displayName);
        break;
      case 'updateUser':
        response.data = updateUser(args.token, args.userId, args.updates);
        break;

      // Employees
      case 'getEmployees':
        response.data = getEmployees(args.token);
        break;
      case 'createEmployee':
        response.data = createEmployee(args.token, args.employeeData);
        break;
      case 'updateEmployee':
        response.data = updateEmployee(args.token, args.employeeId, args.employeeData);
        break;
      case 'deleteEmployee':
        response.data = deleteEmployee(args.token, args.employeeId);
        break;

      // Flows
      case 'getFlows':
        response.data = getFlows(args.token);
        break;
      case 'getFlowById':
        response.data = getFlowById(args.token, args.flowId);
        break;
      case 'createFlow':
        response.data = createFlow(args.token, args.flowData);
        break;
      case 'updateFlow':
        response.data = updateFlow(args.token, args.flowId, args.flowData);
        break;
      case 'deleteFlow':
        response.data = deleteFlow(args.token, args.flowId);
        break;

      // Clients
      case 'getClients':
        response.data = getClients(args.token);
        break;
      case 'createClient':
        response.data = createClient(args.token, args.clientData);
        break;
      case 'updateClient':
        response.data = updateClient(args.token, args.clientId, args.clientData);
        break;
      case 'deleteClient':
        response.data = deleteClient(args.token, args.clientId);
        break;

      // Audit
      case 'getAuditLogs':
        response.data = getAuditLogs(args.token, args.filters);
        break;

      // Flow Engine
      case 'startExecution':
        response.data = startExecution(args.token, args.flowId, args.formData, args.files);
        break;
      case 'getExecutions':
        response.data = getExecutions(args.token, args.flowId);
        break;
      case 'getApprovals':
        response.data = getApprovals(args.token);
        break;
      case 'processApproval':
        response.data = processApproval(args.token, args.executionId, args.action, args.comment, args.documentApproval);
        break;
      case 'getExecutionDetail':
        response.data = getExecutionDetail(args.token, args.executionId);
        break;
      case 'getGmailAliases':
        response.data = getGmailAliases();
        break;
      case 'sendFlowEmail':
        response.data = sendFlowEmail(args.token, args.config);
        break;
      case 'saveToSheet':
        response.data = saveToSheet(args.token, args.spreadsheetId, args.sheetName, args.data);
        break;
      case 'saveFileToDrive':
        response.data = saveFileToDrive(args.token, args.fileData, args.folderPath, args.fileName);
        break;
      case 'createSpreadsheetForFlow':
        response.data = createSpreadsheetForFlow(args.token, args.name);
        break;
      case 'getDocuments':
        response.data = getDocuments(args.token, args.filterEntity);
        break;

      // My Assigned Forms
      case 'getMyAssignedFlowTemplates':
        response.data = getMyAssignedFlowTemplates(args.token);
        break;
      case 'getMyAssignedForms':
        response.data = getMyAssignedForms(args.token);
        break;
      case 'startFormSubmission':
        response.data = startFormSubmission(args.token, args.flowId, args.formData, args.files);
        break;
      case 'claimForm':
        response.data = claimForm(args.token, args.executionId);
        break;
      case 'releaseForm':
        response.data = releaseForm(args.token, args.executionId);
        break;
      case 'submitFormData':
        response.data = submitFormData(args.token, args.executionId, args.formData);
        break;

      // Bootstrap
      case 'forceBootstrap':
        response.data = forceBootstrap(args.token);
        break;

      // Test node
      case 'testNode':
        response.data = testNode(args.token, args.nodeData);
        break;

      default:
        response.error = 'Unknown action: ' + action;
    }

    response.success = response.data && response.data.success !== undefined ? response.data.success : !response.error;
    
    // Add debug info if it fails
    if (!response.success && !response.error) {
      if (response.data && response.data.error) {
        response.error = response.data.error;
      }
    }
  } catch (error) {
    Logger.log('Unhandled API error in ' + action + ': ' + error.message);
    response.error = error.message || 'Unknown error';
    response.success = false;
  }

  Logger.log('Response for ' + action + ': ' + JSON.stringify(response));
  return JSON.stringify(response);
}

/**
 * Dashboard statistics
 */
function getDashboardStats(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();

    // Count flows
    const flowsSheet = ss.getSheetByName('FLOWS');
    let activeFlows = 0;
    if (flowsSheet) {
      const flowsData = flowsSheet.getDataRange().getValues();
      for (let i = 1; i < flowsData.length; i++) {
        if (flowsData[i][8] === true || flowsData[i][8] === 'TRUE') activeFlows++;
      }
    }

    // Count approvals by status
    const approvalsSheet = ss.getSheetByName('APPROVALS');
    let pendingApprovals = 0, approvedToday = 0, rejectedToday = 0;
    if (approvalsSheet) {
      const approvalsData = approvalsSheet.getDataRange().getValues();
      const today = new Date().toDateString();
      for (let i = 1; i < approvalsData.length; i++) {
        if (approvalsData[i][3] === 'Pending') pendingApprovals++;
        if (approvalsData[i][3] === 'Approved' && new Date(approvalsData[i][8]).toDateString() === today) approvedToday++;
        if (approvalsData[i][3] === 'Rejected' && new Date(approvalsData[i][8]).toDateString() === today) rejectedToday++;
      }
    }

    // Count clients
    const clientsSheet = ss.getSheetByName('CLIENTS');
    let totalClients = 0;
    if (clientsSheet) {
      const clientsData = clientsSheet.getDataRange().getValues();
      for (let i = 1; i < clientsData.length; i++) {
        if (clientsData[i][4] === true || clientsData[i][4] === 'TRUE') totalClients++;
      }
    }

    // Count users
    const usersSheet = ss.getSheetByName('USERS');
    let totalUsers = 0;
    if (usersSheet) {
      const usersData = usersSheet.getDataRange().getValues();
      totalUsers = Math.max(0, usersData.length - 1);
    }

    // Get recent audit logs
    const recentLogs = [];
    const auditSheet = ss.getSheetByName('AUDIT_LOG');
    if (auditSheet) {
      const auditData = auditSheet.getDataRange().getValues();
      for (let i = Math.max(1, auditData.length - 5); i < auditData.length; i++) {
        if (auditData[i][0]) {
          recentLogs.push({
            timestamp: normalizeDate(auditData[i][0]),
            actorEmail: auditData[i][2],
            action: auditData[i][3],
            details: auditData[i][4],
          });
        }
      }
    }

    return {
      success: true,
      stats: {
        pendingApprovals,
        approvedToday,
        rejectedToday,
        activeFlows,
        totalClients,
        totalUsers,
      },
      recentLogs: recentLogs.reverse(),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}