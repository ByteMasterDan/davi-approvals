/**
 * Flows.gs - CRUD Operations for Workflows
 */

/**
 * API: Get all flows
 */
function getFlows(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('FLOWS');
    if (!sheet) return { success: true, flows: [] };

    const data = sheet.getDataRange().getValues();
    const flows = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        let steps = [];
        let formData = [];
        try { steps = JSON.parse(data[i][3] || '[]'); } catch (e) { /* ignore */ }
        try { formData = JSON.parse(data[i][4] || '[]'); } catch (e) { /* ignore */ }

        flows.push({
          flowId: data[i][0],
          flowName: data[i][1],
          description: data[i][2],
          steps: steps,
          formData: formData,
          formLink: data[i][5] || '',
          createdBy: data[i][6],
          createdAt: normalizeDate(data[i][7]),
          isActive: data[i][8] === true || data[i][8] === 'TRUE',
          sheetId: data[i][9] || '',
          folderId: data[i][10] || '',
          edges: (() => { try { return JSON.parse(data[i][11] || '[]') } catch(e) { return [] } })(),
        });
      }
    }

    return { success: true, flows: flows };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Create a new flow
 */
function createFlow(token, flowData) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin', 'SuperApprover'])) return { success: false, error: 'Access denied' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('FLOWS');
    if (!sheet) return { success: false, error: 'FLOWS sheet not found' };

    const flowId = 'FLOW-' + new Date().getTime();
    const now = new Date().toISOString();
    const formLink = ScriptApp.getService().getUrl() + '?form=' + flowId;

    sheet.appendRow([
      flowId,
      flowData.name,
      flowData.description || '',
      JSON.stringify(flowData.steps || []),
      JSON.stringify(flowData.formData || []),
      formLink,
      session.email,
      now,
      true,
      flowData.sheetId || '',
      flowData.folderId || '',
      JSON.stringify(flowData.edges || []),
    ]);

    logAuditAction(flowId, session.email, 'CREATED', 'Flow created: ' + flowData.name);

    notifyAssignedUsers(flowId, flowData.name, flowData.steps);

    return { success: true, flowId: flowId, message: 'Flow created' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Update a flow
 */
function updateFlow(token, flowId, flowData) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin', 'SuperApprover'])) return { success: false, error: 'Access denied' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('FLOWS');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === flowId) {
        if (flowData.name) sheet.getRange(i + 1, 2).setValue(flowData.name);
        if (flowData.description !== undefined) sheet.getRange(i + 1, 3).setValue(flowData.description);
        if (flowData.steps) sheet.getRange(i + 1, 4).setValue(JSON.stringify(flowData.steps));
        if (flowData.formData !== undefined) sheet.getRange(i + 1, 5).setValue(JSON.stringify(flowData.formData));
        if (flowData.isActive !== undefined) sheet.getRange(i + 1, 9).setValue(flowData.isActive);
        if (flowData.sheetId !== undefined) sheet.getRange(i + 1, 10).setValue(flowData.sheetId);
        if (flowData.folderId !== undefined) sheet.getRange(i + 1, 11).setValue(flowData.folderId);
        if (flowData.edges !== undefined) sheet.getRange(i + 1, 12).setValue(JSON.stringify(flowData.edges));
        logAuditAction(flowId, session.email, 'UPDATED', 'Flow updated: ' + flowId);

        if (flowData.steps) {
          notifyAssignedUsers(flowId, flowData.name || data[i][1], flowData.steps);
        }

        return { success: true, message: 'Flow updated' };
      }
    }

    return { success: false, error: 'Flow not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Delete a flow (soft delete)
 */
function deleteFlow(token, flowId) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin'])) return { success: false, error: 'Access denied' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('FLOWS');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === flowId) {
        sheet.getRange(i + 1, 9).setValue(false);
        logAuditAction(flowId, session.email, 'DEACTIVATED', 'Flow deactivated: ' + flowId);
        return { success: true, message: 'Flow deactivated' };
      }
    }

    return { success: false, error: 'Flow not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Get a single flow by ID
 */
function getFlowById(token, flowId) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('FLOWS');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === flowId) {
        let steps = [];
        let formData = [];
        try { steps = JSON.parse(data[i][3] || '[]'); } catch (e) { /* ignore */ }
        try { formData = JSON.parse(data[i][4] || '[]'); } catch (e) { /* ignore */ }

        return {
          success: true,
          flow: {
            flowId: data[i][0],
            flowName: data[i][1],
            description: data[i][2],
            steps: steps,
            formData: formData,
            formLink: data[i][5] || '',
            createdBy: data[i][6],
            createdAt: normalizeDate(data[i][7]),
            isActive: data[i][8] === true || data[i][8] === 'TRUE',
            sheetId: data[i][9] || '',
            folderId: data[i][10] || '',
            edges: (() => { try { return JSON.parse(data[i][11] || '[]') } catch(e) { return [] } })(),
          },
        };
      }
    }

    return { success: false, error: 'Flow not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Send email notification to users assigned to form steps
 */
function notifyAssignedUsers(flowId, flowName, steps) {
  try {
    if (!steps || !Array.isArray(steps)) return;

    var allAssignees = [];
    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      if (step.type === 'form' && step.assignees && Array.isArray(step.assignees)) {
        for (var j = 0; j < step.assignees.length; j++) {
          if (allAssignees.indexOf(step.assignees[j]) === -1) {
            allAssignees.push(step.assignees[j]);
          }
        }
      }
    }

    if (allAssignees.length === 0) return;

    var subject = '[G-Flow] Form ready to fill: ' + flowName;
    var body = 'A form has been assigned to you and is ready to fill.\n\n' +
               'Flow: ' + flowName + '\n' +
               'Flow ID: ' + flowId + '\n\n' +
               'Log in to G-Flow to claim and fill out your form.\n\n' +
               'This is an automated notification from G-Flow Approval System.';

    for (var k = 0; k < allAssignees.length; k++) {
      try {
        GmailApp.sendEmail(allAssignees[k], subject, body);
      } catch (emailErr) {
        Logger.log('Failed to send notification to ' + allAssignees[k] + ': ' + emailErr.message);
      }
    }
  } catch (e) {
    Logger.log('notifyAssignedUsers error: ' + e.message);
  }
}