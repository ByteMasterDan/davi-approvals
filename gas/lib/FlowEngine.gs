/**
 * FlowEngine.gs - Execution Engine for Workflows
 * Manages flow execution state machine
 */

const EXECUTION_SHEET = 'EXECUTIONS';

/**
 * Initialize EXECUTIONS sheet if not exists
 */
function initExecutionsSheet() {
  const ss = CONFIG.getSpreadsheet();
  let sheet = ss.getSheetByName(EXECUTION_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(EXECUTION_SHEET);
    sheet.getRange(1, 1, 1, 13).setValues([
      ['ExecutionId', 'FlowId', 'FlowName', 'SubmittedBy', 'CurrentStep', 'Status', 'FormData', 'StartedAt', 'CompletedAt', 'Notes', 'AssignedTo', 'ClaimedBy', 'ClaimedAt']
    ]).setFontWeight('bold');
  } else if (sheet.getLastColumn() < 13) {
    sheet.getRange(1, 11).setValue('AssignedTo').setFontWeight('bold');
    sheet.getRange(1, 12).setValue('ClaimedBy').setFontWeight('bold');
    sheet.getRange(1, 13).setValue('ClaimedAt').setFontWeight('bold');
  }
  return sheet;
}

/**
 * API: Start a new execution of a flow
 */
function startExecution(token, flowId, formData, files) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const sheet = initExecutionsSheet();
    const executionId = 'EXEC-' + new Date().getTime();
    const now = new Date().toISOString();

    let flowName = '';
    let assignedTo = [];
    const flowResult = getFlowById(token, flowId);
    if (flowResult.success && flowResult.flow) {
      flowName = flowResult.flow.flowName || '';
      const steps = flowResult.flow.steps || [];
      for (const step of steps) {
        if (step.type === 'form' && step.assignees && step.assignees.length > 0) {
          assignedTo = step.assignees;
          break;
        }
      }
    }

    sheet.appendRow([
      executionId,
      flowId,
      flowName,
      session.email,
      0,
      'Pending',
      JSON.stringify(formData || {}),
      now,
      '',
      JSON.stringify({ files: files || [] }),
      JSON.stringify(assignedTo),
      '',
      '',
    ]);

    logAuditAction(executionId, session.email, 'EXECUTION_STARTED', 'Flow execution started: ' + flowId);

    return { success: true, executionId: executionId, message: 'Execution started' };
  } catch (e) {
    return { success: false, error: 'startExecution error: ' + e.message };
  }
}

/**
 * API: Get all executions (for Admin/SuperApprover)
 */
function getExecutions(token, flowId) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName(EXECUTION_SHEET);
    if (!sheet) return { success: true, executions: [] };

    const data = sheet.getDataRange().getValues();
    const executions = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        let formData = {};
        try { formData = JSON.parse(data[i][6] || '{}'); } catch (e) {}

        const exec = {
          executionId: data[i][0],
          flowId: data[i][1],
          flowName: data[i][2],
          submittedBy: data[i][3],
          currentStep: data[i][4],
          status: data[i][5],
          formData: formData,
          startedAt: normalizeDate(data[i][7]),
          completedAt: normalizeDate(data[i][8]),
          notes: data[i][9],
        };

        if (!flowId || exec.flowId === flowId) {
          executions.push(exec);
        }
      }
    }

    executions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return { success: true, executions: executions };
  } catch (e) {
    return { success: false, error: 'getExecutions error: ' + e.message };
  }
}

/**
 * API: Get pending approvals for current user
 */
function getApprovals(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName(EXECUTION_SHEET);
    if (!sheet) return { success: true, approvals: [] };

    const data = sheet.getDataRange().getValues();
    const approvals = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][5] === 'Pending') {
        let formData = {};
        try { formData = JSON.parse(data[i][6] || '{}'); } catch (e) {}

        approvals.push({
          executionId: data[i][0],
          flowId: data[i][1],
          flowName: data[i][2],
          submittedBy: data[i][3],
          currentStep: data[i][4],
          status: data[i][5],
          formData: formData,
          startedAt: normalizeDate(data[i][7]),
        });
      }
    }

    return { success: true, approvals: approvals };
  } catch (e) {
    return { success: false, error: 'getApprovals error: ' + e.message };
  }
}

/**
 * API: Process an approval action with optional per-document approval
 */
function processApproval(token, executionId, action, comment, documentApproval) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName(EXECUTION_SHEET);
    if (!sheet) return { success: false, error: 'No executions sheet' };

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === executionId) {
        const newStatus = action === 'APPROVE' ? 'Approved' : action === 'REJECT' ? 'Rejected' : 'Pending';
        sheet.getRange(i + 1, 6).setValue(newStatus);

        if (action !== 'REQUEST_REVISION') {
          sheet.getRange(i + 1, 9).setValue(new Date().toISOString());
        }

        // Store comment + document approval status in Notes
        var notesStr = data[i][9] || '{}';
        var notes = {};
        try { notes = JSON.parse(notesStr); } catch(e) { notes = {}; }
        notes.comment = comment || '';
        if (documentApproval && typeof documentApproval === 'object') {
          notes.documentApproval = documentApproval;
        }
        notes.approvedBy = session.email;
        sheet.getRange(i + 1, 10).setValue(JSON.stringify(notes));

        logAuditAction(executionId, session.email, action, 'Execution ' + action.toLowerCase() + ': ' + executionId);

        // Send email notification to submitter
        try {
          const flowIdForRow = data[i][1];
          const submittedBy = data[i][3];
          const flowNameForRow = data[i][2];
          const flowResult = getFlowById('', flowIdForRow);
          
          if (flowResult.success && flowResult.flow && submittedBy) {
            const steps = flowResult.flow.steps || [];
            const formStep = steps.find(function(s) { return s.type === 'form' && s.fields; });
            
            let formData = {};
            try { formData = JSON.parse(data[i][6] || '{}'); } catch(e) {}
            
            let dataSummary = '';
            if (formStep && formStep.fields) {
              for (const field of formStep.fields) {
                const val = formData[field.id] !== undefined ? formData[field.id] : '';
                dataSummary += field.label + ': ' + String(val) + '\n';
              }
            } else {
              for (const [k, v] of Object.entries(formData)) {
                dataSummary += k + ': ' + String(v) + '\n';
              }
            }
            
            const statusText = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'NEEDS REVISION';
            const subject = '[G-Flow] Execution ' + statusText + ': ' + flowNameForRow;
            const body = 'Your form submission has been ' + statusText.toLowerCase() + '.\n\n' +
                       'Flow: ' + flowNameForRow + '\n' +
                       'Execution ID: ' + executionId + '\n' +
                       'Status: ' + newStatus + '\n' +
                       (comment ? '\nComment: ' + comment + '\n' : '') +
                       '\n--- Form Data ---\n' + dataSummary + '\n' +
                       'Please log in to G-Flow to view details.';
            
            GmailApp.sendEmail(submittedBy, subject, body, {
              from: Session.getActiveUser().getEmail(),
              name: 'G-Flow System',
            });
            
            logAuditAction(executionId, session.email, 'EMAIL_SENT', 'Notification email sent to: ' + submittedBy);
          }
        } catch (emailErr) {
          Logger.log('Email notification error: ' + emailErr.message);
        }

        // After approval, process remaining flow steps automatically
        if (action === 'APPROVE') {
          advanceExecution(executionId);
        }

        return { success: true, message: 'Execution ' + action.toLowerCase() };
      }
    }

    return { success: false, error: 'Execution not found' };
  } catch (e) {
    return { success: false, error: 'processApproval error: ' + e.message };
  }
}

/**
 * API: Get execution detail
 */
function getExecutionDetail(token, executionId) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName(EXECUTION_SHEET);
    if (!sheet) return { success: false, error: 'No executions sheet' };

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === executionId) {
        let formData = {};
        try { formData = JSON.parse(data[i][6] || '{}'); } catch (e) {}

        return {
          success: true,
          execution: {
            executionId: data[i][0],
            flowId: data[i][1],
            flowName: data[i][2],
            submittedBy: data[i][3],
            currentStep: data[i][4],
            status: data[i][5],
            formData: formData,
            startedAt: normalizeDate(data[i][7]),
            completedAt: normalizeDate(data[i][8]),
            notes: data[i][9],
          },
        };
      }
    }

    return { success: false, error: 'Execution not found' };
  } catch (e) {
    return { success: false, error: 'getExecutionDetail error: ' + e.message };
  }
}

/**
 * API: Get Gmail aliases for email From dropdown
 */
function getGmailAliases() {
  try {
    const aliases = GmailApp.getAliases();
    const defaultEmail = Session.getActiveUser().getEmail();
    return { success: true, aliases: [defaultEmail, ...aliases] };
  } catch (e) {
    return { success: false, error: 'getGmailAliases error: ' + e.message };
  }
}

/**
 * API: Send email via Gmail
 */
function sendFlowEmail(token, config) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const fromAlias = config.from || Session.getActiveUser().getEmail();
    const subject = config.subject || 'No Subject';
    const body = config.body || '';
    const htmlBody = config.htmlBody || body;

    const options = {
      from: fromAlias,
      name: config.fromName || 'G-Flow Approval System',
    };

    if (config.cc && config.cc.length > 0) {
      options.cc = config.cc.join(',');
    }
    if (config.bcc && config.bcc.length > 0) {
      options.bcc = config.bcc.join(',');
    }

    if (config.attachments && config.attachments.length > 0) {
      options.attachments = config.attachments;
    }

    GmailApp.sendEmail(config.to.join(','), subject, body, options);

    if (config.executionId) {
      logAuditAction(config.executionId, session.email, 'EMAIL_SENT', 'Email sent to: ' + config.to.join(', '));
    }

    return { success: true, message: 'Email sent' };
  } catch (e) {
    return { success: false, error: 'sendFlowEmail error: ' + e.message };
  }
}

/**
 * API: Save data to a specific spreadsheet/sheet
 */
function saveToSheet(token, spreadsheetId, sheetName, data) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      let headers = [];
      const lastCol = sheet.getLastColumn();
      if (lastCol > 0) {
        headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      }
      
      const newKeys = Object.keys(data).filter(k => !headers.includes(k));
      if (newKeys.length > 0) {
        headers.push(...newKeys);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      }

      const values = headers.map(h => data[h] !== undefined ? data[h] : '');

      if (sheet.getLastRow() === 1 && sheet.getLastColumn() === 1 && sheet.getRange(1, 1).getValue() === '') {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        sheet.getRange(2, 1, 1, values.length).setValues([values]);
      } else {
        sheet.appendRow(values);
      }
    }

    return { success: true, message: 'Data saved to ' + sheetName };
  } catch (e) {
    return { success: false, error: 'saveToSheet error: ' + e.message };
  }
}

/**
 * API: Save file to Drive folder
 */
function saveFileToDrive(token, fileData, folderPath, fileName) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    let rootFolderId = PROPS.getProperty('ROOT_DRIVE_FOLDER_ID');

    if (!rootFolderId) {
      const rootFolder = DriveApp.getRootFolder();
      rootFolderId = rootFolder.getId();
    }

    let parentFolder = DriveApp.getFolderById(rootFolderId);
    const pathParts = folderPath.split('/').filter(Boolean);

    for (const part of pathParts) {
      let found = false;
      const folders = parentFolder.getFoldersByName(part);
      if (folders.hasNext()) {
        parentFolder = folders.next();
        found = true;
      }
      if (!found) {
        parentFolder = parentFolder.createFolder(part);
      }
    }

    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileData.base64),
      fileData.mimeType || 'application/octet-stream',
      fileName || fileData.name
    );

    const file = parentFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      message: 'File saved to Drive',
    };
  } catch (e) {
    return { success: false, error: 'saveFileToDrive error: ' + e.message };
  }
}

/**
 * API: Create a new spreadsheet for flow
 */
function createSpreadsheetForFlow(token, name) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = SpreadsheetApp.create(name || 'New Flow Spreadsheet');
    const file = DriveApp.getFileById(ss.getId());
    
    // Attempt to move to root folder if configured
    let rootFolderId = PROPS.getProperty('ROOT_DRIVE_FOLDER_ID');
    if (rootFolderId) {
      const folder = DriveApp.getFolderById(rootFolderId);
      file.moveTo(folder);
    }
    
    return { success: true, spreadsheetId: ss.getId(), url: ss.getUrl() };
  } catch (e) {
    return { success: false, error: 'createSpreadsheet error: ' + e.message };
  }
}

/**
 * API: Get submitted documents
 */
function getDocuments(token, filterEntity) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('APPROVALS');
    if (!sheet) return { success: true, documents: [] };

    const data = sheet.getDataRange().getValues();
    const documents = [];

    // APPROVALS schema: ['ApprovalID', 'FlowID', 'CurrentStep', 'Status', 'SubmittedBy', 'EntityTag', 'Files', 'SubmittedAt', 'CompletedAt']
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      
      const entityTag = data[i][5];
      if (filterEntity && entityTag.toLowerCase() !== filterEntity.toLowerCase() && 
          !entityTag.toLowerCase().includes(filterEntity.toLowerCase())) {
        continue;
      }
      
      let files = [];
      try { 
        files = JSON.parse(data[i][6] || '[]'); 
      } catch (e) { }

      if (files.length > 0) {
        documents.push({
          approvalId: data[i][0],
          flowId: data[i][1],
          status: data[i][3],
          submittedBy: data[i][4],
          entityTag: entityTag,
          files: files,
          submittedAt: normalizeDate(data[i][7]),
        });
      }
    }

    return { success: true, documents };
  } catch (e) {
    return { success: false, error: 'getDocuments error: ' + e.message };
  }
}

/**
 * API: Get flow templates assigned to the current user (always available)
 * These are the flows the operator can fill at any time
 */
function getMyAssignedFlowTemplates(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const flowsSheet = ss.getSheetByName('FLOWS');
    if (!flowsSheet) return { success: true, templates: [] };

    const flowsData = flowsSheet.getDataRange().getValues();
    const templates = [];
    const userEmail = session.email.toLowerCase();

    for (let i = 1; i < flowsData.length; i++) {
      if (!flowsData[i][0]) continue;

      const isActive = flowsData[i][8] === true || flowsData[i][8] === 'TRUE';
      if (!isActive) continue;

      let steps = [];
      try { steps = JSON.parse(flowsData[i][3] || '[]'); } catch (e) {}

      let formFields = [];
      let assignees = [];
      for (const step of steps) {
        if (step.type === 'form') {
          if (step.fields && step.fields.length > 0) formFields = step.fields;
          if (step.assignees && Array.isArray(step.assignees)) {
            for (const a of step.assignees) {
              if (assignees.indexOf(a) === -1) assignees.push(a);
            }
          }
        }
      }

      const assigneesLower = assignees.map(function(a) { return a.toLowerCase(); });
      if (assigneesLower.indexOf(userEmail) === -1) continue;

      templates.push({
        flowId: flowsData[i][0],
        flowName: flowsData[i][1],
        description: flowsData[i][2],
        steps: steps,
        formFields: formFields,
        assignees: assignees,
        createdBy: flowsData[i][6],
        createdAt: normalizeDate(flowsData[i][7]),
      });
    }

    return { success: true, templates: templates };
  } catch (e) {
    return { success: false, error: 'getMyAssignedFlowTemplates error: ' + e.message };
  }
}

/**
 * API: Get active submissions by the current user (Pending/Submitted only)
 */
function getMyAssignedForms(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName(EXECUTION_SHEET);
    if (!sheet) return { success: true, submissions: [] };

    const data = sheet.getDataRange().getValues();
    const mySubmissions = [];
    const userEmail = session.email.toLowerCase();

    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;

      const submittedBy = (data[i][3] || '').toString().toLowerCase();
      if (submittedBy !== userEmail) continue;

      const status = (data[i][5] || '').toString();
      if (status !== 'Pending' && status !== 'Submitted') continue;

      let formData = {};
      try { formData = JSON.parse(data[i][6] || '{}'); } catch (e) {}

      mySubmissions.push({
        executionId: data[i][0],
        flowId: data[i][1],
        flowName: data[i][2],
        submittedBy: data[i][3],
        status: status,
        formData: formData,
        startedAt: normalizeDate(data[i][7]),
        completedAt: normalizeDate(data[i][8]),
      });
    }

    mySubmissions.sort(function(a, b) { return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(); });

    return { success: true, submissions: mySubmissions };
  } catch (e) {
    return { success: false, error: 'getMyAssignedForms error: ' + e.message };
  }
}

/**
 * API: Start a new form submission (creates execution + submits in one step)
 * If flow has no approval step, auto-approves and advances immediately
 */
function startFormSubmission(token, flowId, formData, files) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const sheet = initExecutionsSheet();
    const executionId = 'EXEC-' + new Date().getTime();
    const now = new Date().toISOString();

    let flowName = '';
    let approvalAssignee = '';
    let flowSteps = [];
    const flowResult = getFlowById(token, flowId);
    if (flowResult.success && flowResult.flow) {
      flowName = flowResult.flow.flowName || '';
      flowSteps = flowResult.flow.steps || [];
      for (const step of flowSteps) {
        if (step.type === 'approval' && step.assigneeValue) {
          approvalAssignee = step.assigneeValue;
          break;
        }
      }
    }

    // Extract files from formData (file fields contain arrays of {name, mimeType, base64})
    var allFiles = [];
    if (formData) {
      for (var key in formData) {
        var val = formData[key];
        if (Array.isArray(val)) {
          for (var fi = 0; fi < val.length; fi++) {
            if (val[fi] && val[fi].base64) {
              allFiles.push(val[fi]);
            }
          }
        } else if (val && typeof val === 'object' && val.base64) {
          allFiles.push(val);
        }
      }
    }
    if (files && Array.isArray(files)) {
      for (var fi2 = 0; fi2 < files.length; fi2++) {
        if (files[fi2] && files[fi2].base64) allFiles.push(files[fi2]);
      }
    }

    // Strip file data from formData before storing (keep only references)
    var cleanFormData = {};
    if (formData) {
      for (var k in formData) {
        var v = formData[k];
        if (Array.isArray(v) && v.length > 0 && v[0] && v[0].base64) {
          cleanFormData[k] = v.map(function(f) { return { name: f.name, mimeType: f.mimeType }; });
        } else if (v && typeof v === 'object' && v.base64) {
          cleanFormData[k] = { name: v.name, mimeType: v.mimeType };
        } else {
          cleanFormData[k] = v;
        }
      }
    }

    const assignedTo = [session.email];

    sheet.appendRow([
      executionId,
      flowId,
      flowName,
      session.email,
      0,
      approvalAssignee ? 'Submitted' : 'Approved',
      JSON.stringify(cleanFormData),
      now,
      approvalAssignee ? '' : now,
      JSON.stringify({ files: allFiles }),
      JSON.stringify(assignedTo),
      session.email,
      now,
    ]);

    logAuditAction(executionId, session.email, 'FORM_SUBMITTED', 'Form submitted by: ' + session.email);

    // Save to external sheet and folder if configured in form step
    try {
      var formStepConfig = flowSteps.find(function(s) { return s.type === 'form' && s.fields; });
      if (formStepConfig) {
        if (formStepConfig.spreadsheetId) {
          saveToExternalSheet(formStepConfig.spreadsheetId, formStepConfig.sheetName, executionId, { steps: flowSteps, flowName: flowName }, formData);
        }
        if (formStepConfig.driveFolderId) {
          saveFilesToExternalFolder(formStepConfig.driveFolderId, executionId, formData);
        }
      }
    } catch (extErr) {
      Logger.log('External save on submit error: ' + extErr.message);
    }

    if (approvalAssignee) {
      // Has approval step - notify approver
      try {
        var formStep = flowSteps.find(function(s) { return s.type === 'form' && s.fields; });
        var dataSummary = '';
        if (formStep && formStep.fields) {
          for (var f = 0; f < formStep.fields.length; f++) {
            var field = formStep.fields[f];
            var val2 = cleanFormData[field.id] !== undefined ? cleanFormData[field.id] : '';
            dataSummary += field.label + ': ' + String(val2) + '\n';
          }
        } else {
          for (var k2 in cleanFormData) {
            dataSummary += k2 + ': ' + String(cleanFormData[k2]) + '\n';
          }
        }

        var subject = '[G-Flow] Pending Approval: ' + flowName;
        var body = 'A form has been submitted and requires your approval.\n\n' +
                     'Flow: ' + flowName + '\n' +
                     'Submitted by: ' + session.email + '\n' +
                     'Execution ID: ' + executionId + '\n\n' +
                     '--- Form Data ---\n' + dataSummary + '\n' +
                     'Please log in to G-Flow to review and approve.';

        GmailApp.sendEmail(approvalAssignee, subject, body, {
          from: Session.getActiveUser().getEmail(),
          name: 'G-Flow Approval System',
        });
        logAuditAction(executionId, session.email, 'APPROVER_NOTIFIED', 'Approval notification sent to: ' + approvalAssignee);
      } catch (notifyErr) {
        Logger.log('Approver notification error: ' + notifyErr.message);
      }
    } else {
      // No approval step - auto-approve and advance
      logAuditAction(executionId, session.email, 'AUTO_APPROVED', 'Flow auto-approved (no approval step)');
      advanceExecution(executionId);
    }

    return { success: true, executionId: executionId, message: 'Form submitted successfully' };
  } catch (e) {
    return { success: false, error: 'startFormSubmission error: ' + e.message };
  }
}

/**
 * API: Claim a form execution
 */
function claimForm(token, executionId) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName(EXECUTION_SHEET);
    if (!sheet) return { success: false, error: 'No executions sheet' };

    const data = sheet.getDataRange().getValues();
    const userEmail = session.email.toLowerCase();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] !== executionId) continue;

      let assignedTo = [];
      try { assignedTo = JSON.parse(data[i][10] || '[]'); } catch (e) {}

      const assignedLower = assignedTo.map(function(a) { return a.toLowerCase(); });
      if (assignedLower.indexOf(userEmail) === -1) {
        return { success: false, error: 'You are not assigned to this form' };
      }

      const currentClaimer = (data[i][11] || '').toString();
      if (currentClaimer && currentClaimer.toLowerCase() !== userEmail) {
        return { success: false, error: 'This form is already claimed by ' + currentClaimer };
      }

      const currentStatus = (data[i][5] || '').toString();
      if (currentStatus !== 'Pending') {
        return { success: false, error: 'This form is already ' + currentStatus.toLowerCase() };
      }

      sheet.getRange(i + 1, 12).setValue(session.email);
      sheet.getRange(i + 1, 13).setValue(new Date().toISOString());

      logAuditAction(executionId, session.email, 'FORM_CLAIMED', 'Form claimed by: ' + session.email);

      return { success: true, message: 'Form claimed successfully' };
    }

    return { success: false, error: 'Execution not found' };
  } catch (e) {
    return { success: false, error: 'claimForm error: ' + e.message };
  }
}

/**
 * API: Release a claimed form
 */
function releaseForm(token, executionId) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName(EXECUTION_SHEET);
    if (!sheet) return { success: false, error: 'No executions sheet' };

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] !== executionId) continue;

      const currentClaimer = (data[i][11] || '').toString().toLowerCase();
      if (currentClaimer !== session.email.toLowerCase()) {
        return { success: false, error: 'You have not claimed this form' };
      }

      sheet.getRange(i + 1, 12).setValue('');
      sheet.getRange(i + 1, 13).setValue('');

      logAuditAction(executionId, session.email, 'FORM_RELEASED', 'Form released by: ' + session.email);

      return { success: true, message: 'Form released successfully' };
    }

    return { success: false, error: 'Execution not found' };
  } catch (e) {
    return { success: false, error: 'releaseForm error: ' + e.message };
  }
}

/**
 * API: Submit form data for a claimed execution
 */
function submitFormData(token, executionId, formData) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName(EXECUTION_SHEET);
    if (!sheet) return { success: false, error: 'No executions sheet' };

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] !== executionId) continue;

      const currentClaimer = (data[i][11] || '').toString().toLowerCase();
      if (currentClaimer !== session.email.toLowerCase()) {
        return { success: false, error: 'You have not claimed this form' };
      }

      sheet.getRange(i + 1, 7).setValue(JSON.stringify(formData || {}));
      sheet.getRange(i + 1, 6).setValue('Submitted');
      sheet.getRange(i + 1, 9).setValue(new Date().toISOString());

      logAuditAction(executionId, session.email, 'FORM_SUBMITTED', 'Form data submitted by: ' + session.email);

      // Save to external sheet and folder if configured
      try {
        const flowIdForRow = data[i][1];
        const flowResult = getFlowById('', flowIdForRow);
        if (flowResult.success && flowResult.flow) {
          const steps = flowResult.flow.steps || [];
          const formStep = steps.find(function(s) { return s.type === 'form' && s.fields; });
          
          if (formStep) {
            const sheetId = formStep.spreadsheetId;
            const folderId = formStep.driveFolderId;
            
            if (sheetId) {
              saveToExternalSheet(sheetId, formStep.sheetName, executionId, flowResult.flow, formData);
            }
            
            if (folderId) {
              saveFilesToExternalFolder(folderId, executionId, formData);
            }
          }
        }
      } catch (saveErr) {
        Logger.log('External save error: ' + saveErr.message);
      }

      // Notify approver that form has been submitted
      try {
        const flowIdForRow = data[i][1];
        const flowNameForRow = data[i][2];
        const flowResult = getFlowById('', flowIdForRow);
        if (flowResult.success && flowResult.flow) {
          const steps = flowResult.flow.steps || [];
          const formStep = steps.find(function(s) { return s.type === 'form' && s.fields; });
          const approvalStep = steps.find(function(s) { return s.type === 'approval' && s.assignee; });

          if (approvalStep && approvalStep.assignee) {
            let dataSummary = '';
            if (formStep && formStep.fields) {
              for (const field of formStep.fields) {
                const val = formData[field.id] !== undefined ? formData[field.id] : '';
                dataSummary += field.label + ': ' + String(val) + '\n';
              }
            } else {
              for (const [k, v] of Object.entries(formData)) {
                dataSummary += k + ': ' + String(v) + '\n';
              }
            }

            const subject = '[G-Flow] Pending Approval: ' + flowNameForRow;
            const body = 'A form has been submitted and requires your approval.\n\n' +
                         'Flow: ' + flowNameForRow + '\n' +
                         'Submitted by: ' + session.email + '\n' +
                         'Execution ID: ' + executionId + '\n\n' +
                         '--- Form Data ---\n' + dataSummary + '\n' +
                         'Please log in to G-Flow to review and approve.';

            GmailApp.sendEmail(approvalStep.assignee, subject, body, {
              from: Session.getActiveUser().getEmail(),
              name: 'G-Flow Approval System',
            });
            logAuditAction(executionId, session.email, 'APPROVER_NOTIFIED', 'Approval notification sent to: ' + approvalStep.assignee);
          }
        }
      } catch (notifyErr) {
        Logger.log('Approver notification error: ' + notifyErr.message);
      }

      return { success: true, message: 'Form submitted successfully' };
    }

    return { success: false, error: 'Execution not found' };
  } catch (e) {
    return { success: false, error: 'submitFormData error: ' + e.message };
  }
}

/**
 * Process remaining steps in the flow after approval
 * Executes saveToSheet, email, archive, dataLookup nodes automatically
 */
function advanceExecution(executionId) {
  try {
    const ss = CONFIG.getSpreadsheet();
    const execSheet = ss.getSheetByName(EXECUTION_SHEET);
    if (!execSheet) return;

    const execData = execSheet.getDataRange().getValues();
    let execution = null;
    let execRow = -1;

    for (let i = 1; i < execData.length; i++) {
      if (execData[i][0] === executionId) {
        var notesObj = {};
        try { notesObj = JSON.parse(execData[i][9] || '{}'); } catch(e) {}
        execution = {
          executionId: execData[i][0],
          flowId: execData[i][1],
          flowName: execData[i][2],
          submittedBy: execData[i][3],
          currentStep: execData[i][4],
          status: execData[i][5],
          formData: JSON.parse(execData[i][6] || '{}'),
          completedAt: normalizeDate(execData[i][8]),
          notes: notesObj,
          assignedTo: JSON.parse(execData[i][10] || '[]'),
        };
        execRow = i + 1;
        break;
      }
    }

    if (!execution || execution.status === 'Rejected') return;

    const flowResult = getFlowById('', execution.flowId);
    if (!flowResult.success || !flowResult.flow) return;

    const steps = flowResult.flow.steps || [];
    const formData = execution.formData;
    const approvedBy = execution.notes.approvedBy || 'System';
    const documentApproval = execution.notes.documentApproval || {};

    // Collect approved files from notes
    var allFiles = (execution.notes.files || []).slice();
    var approvedFiles = allFiles;
    if (Object.keys(documentApproval).length > 0) {
      approvedFiles = allFiles.filter(function(f) {
        return documentApproval[f.name] !== 'rejected';
      });
    }

    // Shared context for dataLookup results
    var lookupContext = {};

    for (const step of steps) {
      try {
        // --- DATA LOOKUP NODE ---
        if (step.type === 'dataLookup' && step.sourceField && step.lookupType) {
          var lookupValue = formData[step.sourceField];
          if (lookupValue !== undefined && lookupValue !== null && lookupValue !== '') {
            var lookupResult = lookupEmployeeOrClient(step.lookupType, String(lookupValue), step.matchField || 'EmployeeNumber');
            if (lookupResult) {
              var outputVar = step.outputVariable || 'lookupResult';
              lookupContext[outputVar] = lookupResult;
              logAuditAction(executionId, '', 'DATA_LOOKUP', 'Lookup found: ' + (lookupResult.email || 'no email') + ' for ' + lookupValue);
            } else {
              Logger.log('Data lookup: no match found for ' + lookupValue);
            }
          }
        }

        // --- SAVE TO SHEET NODE ---
        if (step.type === 'saveToSheet' && step.spreadsheetId && step.sheetName) {
          var now = new Date().toISOString();
          var completedAt = now;

          // Build mapped data from form fields
          var mappedData = {};
          if (step.fieldMapping && step.fieldMapping.length > 0) {
            for (const mapping of step.fieldMapping) {
              const headerName = mapping.sheetHeader || mapping.fieldId;
              mappedData[headerName] = formData[mapping.fieldId] !== undefined ? formData[mapping.fieldId] : '';
            }
          } else {
            for (const [key, value] of Object.entries(formData)) {
              mappedData[key] = value;
            }
          }

          // Prepend system metadata columns
          var fullData = {
            'Status': execution.status === 'Approved' ? 'Completed' : execution.status,
            'ExecutionId': executionId,
            'SubmittedBy': execution.submittedBy,
            'ApprovedBy': approvedBy,
            'SubmittedAt': execution.completedAt || now,
            'CompletedAt': completedAt,
          };
          for (var mk in mappedData) {
            fullData[mk] = mappedData[mk];
          }

          try {
            const targetSs = SpreadsheetApp.openById(step.spreadsheetId);
            let targetSheet = targetSs.getSheetByName(step.sheetName);
            if (!targetSheet) {
              targetSheet = targetSs.insertSheet(step.sheetName);
            }

            const headers = Object.keys(fullData);
            const lastCol = targetSheet.getLastColumn();
            const existingHeaders = lastCol > 0
              ? targetSheet.getRange(1, 1, 1, lastCol).getValues()[0]
              : [];

            if (existingHeaders.length === 0 || existingHeaders[0] === '') {
              targetSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
            }

            const values = headers.map(function(h) { return fullData[h] !== undefined ? fullData[h] : ''; });
            targetSheet.appendRow(values);

            logAuditAction(executionId, '', 'SAVED_TO_SHEET', 'Data saved to sheet: ' + step.sheetName);
          } catch (sheetErr) {
            Logger.log('saveToSheet error: ' + sheetErr.message);
          }
        }

        // --- EMAIL NODE ---
        if (step.type === 'email' && step.to && step.to.length > 0) {
          // Resolve {lookupEmail} from lookup context
          var toAddresses = [];
          for (var ti = 0; ti < step.to.length; ti++) {
            var addr = step.to[ti];
            if (addr.indexOf('{lookupEmail}') !== -1) {
              for (var lv in lookupContext) {
                if (lookupContext[lv] && lookupContext[lv].email) {
                  addr = addr.replace(/{lookupEmail}/g, lookupContext[lv].email);
                }
              }
            }
            toAddresses.push(addr);
          }

          var subject = (step.subject || 'Flow Completed: {flowName}')
            .replace(/{flowName}/g, execution.flowName)
            .replace(/{executionId}/g, executionId)
            .replace(/{submittedBy}/g, execution.submittedBy);

          var body = (step.body || 'Execution {executionId} has been completed.')
            .replace(/{flowName}/g, execution.flowName)
            .replace(/{executionId}/g, executionId)
            .replace(/{submittedBy}/g, execution.submittedBy);

          // Replace lookup variables in subject/body
          for (var lv2 in lookupContext) {
            if (lookupContext[lv2]) {
              subject = subject.replace(new RegExp('{' + lv2 + '}', 'g'), lookupContext[lv2].name || '');
              body = body.replace(new RegExp('{' + lv2 + '}', 'g'), lookupContext[lv2].name || '');
              subject = subject.replace(new RegExp('{' + lv2 + '.email}', 'g'), lookupContext[lv2].email || '');
              body = body.replace(new RegExp('{' + lv2 + '.email}', 'g'), lookupContext[lv2].email || '');
            }
          }

          // Prepare attachments from approved files
          var attachments = [];
          for (var ai = 0; ai < approvedFiles.length; ai++) {
            var af = approvedFiles[ai];
            if (af.base64) {
              try {
                attachments.push(Utilities.newBlob(
                  Utilities.base64Decode(af.base64),
                  af.mimeType || 'application/octet-stream',
                  executionId + '_' + af.name
                ));
              } catch(blobErr) {
                Logger.log('Blob error for ' + af.name + ': ' + blobErr.message);
              }
            }
          }

          try {
            var emailOpts = {
              from: step.from || Session.getActiveUser().getEmail(),
              name: 'G-Flow Approval System',
            };
            if (step.cc && step.cc.length > 0) emailOpts.cc = step.cc.join(',');
            if (step.bcc && step.bcc.length > 0) emailOpts.bcc = step.bcc.join(',');
            if (attachments.length > 0) emailOpts.attachments = attachments;

            GmailApp.sendEmail(toAddresses.join(','), subject, body, emailOpts);
            logAuditAction(executionId, '', 'EMAIL_SENT', 'Email sent to: ' + toAddresses.join(','));
          } catch (emailErr) {
            Logger.log('Email error: ' + emailErr.message);
          }
        }

        // --- ARCHIVE NODE ---
        if (step.type === 'archive' && step.folderPath) {
          try {
            var rootFolder = DriveApp.getFolderById(step.folderPath);
            var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');

            // Find or create date subfolder
            var dateFolder = null;
            var existingFolders = rootFolder.getFoldersByName(today);
            if (existingFolders.hasNext()) {
              dateFolder = existingFolders.next();
            } else {
              dateFolder = rootFolder.createFolder(today);
            }

            // Only archive approved files
            for (var fi = 0; fi < approvedFiles.length; fi++) {
              var fileInfo = approvedFiles[fi];
              if (fileInfo.base64) {
                var blob = Utilities.newBlob(
                  Utilities.base64Decode(fileInfo.base64),
                  fileInfo.mimeType || 'application/octet-stream',
                  executionId + '_' + fileInfo.name
                );
                dateFolder.createFile(blob);
              }
            }
            logAuditAction(executionId, '', 'ARCHIVED', approvedFiles.length + ' file(s) archived to Drive folder: ' + today);
          } catch (archiveErr) {
            Logger.log('Archive error: ' + archiveErr.message);
          }
        }
      } catch (stepErr) {
        Logger.log('Step execution error (' + step.type + '): ' + stepErr.message);
      }
    }

    execSheet.getRange(execRow, 6).setValue('Completed');
    execSheet.getRange(execRow, 9).setValue(new Date().toISOString());

    logAuditAction(executionId, '', 'EXECUTION_COMPLETED', 'Flow execution completed: ' + execution.flowName);

  } catch (e) {
    Logger.log('advanceExecution error: ' + e.message);
  }
}

/**
 * API: Test a specific node configuration
 * Sends a test email, writes a test row, or validates configuration
 */
function testNode(token, nodeData) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const nodeType = nodeData.type;

    if (nodeType === 'email') {
      const to = nodeData.to && nodeData.to.length > 0 ? nodeData.to : [session.email];
      const subject = nodeData.subject || '[G-Flow Test] Node test email';
      const body = nodeData.body || 'This is a test email from G-Flow node configuration.\n\nIf you received this, the email node is working correctly.';

      GmailApp.sendEmail(to.join(','), '[TEST] ' + subject, body, {
        from: nodeData.from || Session.getActiveUser().getEmail(),
        cc: nodeData.cc ? nodeData.cc.join(',') : undefined,
        bcc: nodeData.bcc ? nodeData.bcc.join(',') : undefined,
        name: 'G-Flow Test',
      });

      return { success: true, message: 'Test email sent to ' + to.join(', ') };
    }

    if (nodeType === 'saveToSheet') {
      if (!nodeData.spreadsheetId) return { success: false, error: 'Spreadsheet ID is required' };
      if (!nodeData.sheetName) return { success: false, error: 'Sheet name is required' };

      const targetSs = SpreadsheetApp.openById(nodeData.spreadsheetId);
      let targetSheet = targetSs.getSheetByName(nodeData.sheetName);

      if (!targetSheet) {
        targetSheet = targetSs.insertSheet(nodeData.sheetName);
      }

      const testHeaders = ['TestTimestamp', 'TestStatus', 'TestMessage'];
      const lastCol = targetSheet.getLastColumn();
      const existingHeaders = lastCol > 0
        ? targetSheet.getRange(1, 1, 1, lastCol).getValues()[0]
        : [];

      if (existingHeaders.length === 0 || existingHeaders[0] === '') {
        targetSheet.getRange(1, 1, 1, testHeaders.length).setValues([testHeaders]).setFontWeight('bold');
      }

      targetSheet.appendRow([
        new Date().toISOString(),
        'TEST',
        'Test row from G-Flow node configuration - safe to delete',
      ]);

      return { success: true, message: 'Test row written to sheet "' + nodeData.sheetName + '"' };
    }

    if (nodeType === 'approval') {
      if (!nodeData.assignee) return { success: false, error: 'No assignee configured' };

      const ss = CONFIG.getSpreadsheet();
      const usersSheet = ss.getSheetByName('USERS');
      if (!usersSheet) return { success: false, error: 'Users sheet not found' };

      const data = usersSheet.getDataRange().getValues();
      const assigneeLower = nodeData.assignee.toLowerCase();

      for (let i = 1; i < data.length; i++) {
        const rowEmail = (data[i][1] || '').toString().toLowerCase().trim();
        const isActive = data[i][7] === true || data[i][7] === 'TRUE';
        if (rowEmail === assigneeLower) {
          if (!isActive) return { success: false, error: 'User exists but is deactivated: ' + nodeData.assignee };
          return { success: true, message: 'Approver verified: ' + nodeData.assignee + ' (active)' };
        }
      }

      return { success: false, error: 'User not found: ' + nodeData.assignee };
    }

    if (nodeType === 'form') {
      const fieldCount = (nodeData.fields || []).length;
      const assigneeCount = (nodeData.assignees || []).length;
      if (fieldCount === 0) return { success: false, error: 'No fields configured' };
      if (assigneeCount === 0) return { success: false, error: 'No assignees configured' };

      var results = ['Form validated: ' + fieldCount + ' field(s), ' + assigneeCount + ' assignee(s)'];

      // Test spreadsheet access if configured
      if (nodeData.spreadsheetId) {
        try {
          const targetSs = SpreadsheetApp.openById(nodeData.spreadsheetId);
          var targetSheet = targetSs.getSheetByName(nodeData.sheetName || 'Sheet1');
          if (!targetSheet) {
            targetSheet = targetSs.insertSheet(nodeData.sheetName || 'TestSheet');
          }
          targetSheet.appendRow([new Date().toISOString(), 'TEST', 'Test from G-Flow node test - safe to delete']);
          results.push('Sheet write OK: ' + targetSs.getName() + '/' + targetSheet.getName());
        } catch (e) {
          return { success: false, error: 'Sheet test failed: ' + e.message };
        }
      }

      // Test drive folder access if configured
      if (nodeData.driveFolderId) {
        try {
          const folder = DriveApp.getFolderById(nodeData.driveFolderId);
          const testBlob = Utilities.newBlob('G-Flow test file', 'text/plain', 'gflow_test_' + Date.now() + '.txt');
          const testFile = folder.createFile(testBlob);
          testFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          results.push('Drive upload OK: ' + folder.getName() + '/' + testFile.getName());
        } catch (e) {
          return { success: false, error: 'Drive test failed: ' + e.message };
        }
      }

      return { success: true, message: results.join('\n') };
    }

    if (nodeType === 'archive') {
      if (!nodeData.folderPath) return { success: false, error: 'No folder ID configured' };
      try {
        const folder = DriveApp.getFolderById(nodeData.folderPath);
        return { success: true, message: 'Drive folder verified: ' + folder.getName() };
      } catch (e) {
        return { success: false, error: 'Cannot access folder: ' + e.message };
      }
    }

    if (nodeType === 'dataLookup') {
      if (!nodeData.sourceField) return { success: false, error: 'Source field is required' };
      if (!nodeData.lookupType) return { success: false, error: 'Lookup type is required (Employees or Clients)' };
      return { success: true, message: 'Data Lookup validated: source=' + nodeData.sourceField + ', type=' + nodeData.lookupType + ', match=' + (nodeData.matchField || 'default') };
    }

    return { success: false, error: 'Unknown node type: ' + nodeType };
  } catch (e) {
    return { success: false, error: 'Test failed: ' + e.message };
  }
}

/**
 * Lookup an employee or client by identifier
 * @param {string} type - 'Employees' or 'Clients'
 * @param {string} value - The value to match
 * @param {string} matchField - The field to match against (e.g. 'EmployeeNumber', 'ClientId')
 * @return {object|null} - { name, email } or null
 */
function lookupEmployeeOrClient(type, value, matchField) {
  try {
    var ss = CONFIG.getSpreadsheet();
    var sheetName = type === 'Employees' ? 'EMPLOYEES' : 'CLIENTS';
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return null;

    var data = sheet.getDataRange().getValues();
    var valueLower = String(value).toLowerCase().trim();

    if (type === 'Employees') {
      // EMPLOYEES: EmployeeID, EmployeeNumber, DisplayName, Email, Department, IsActive, CreatedAt
      for (var i = 1; i < data.length; i++) {
        var empNumber = String(data[i][1] || '').toLowerCase().trim();
        var empName = String(data[i][2] || '').toLowerCase().trim();
        var isActive = data[i][5] === true || data[i][5] === 'TRUE';
        if (!isActive) continue;

        if ((matchField === 'EmployeeNumber' && empNumber === valueLower) ||
            (matchField === 'DisplayName' && empName === valueLower)) {
          return {
            name: data[i][2] || '',
            email: data[i][3] || '',
            employeeNumber: data[i][1] || '',
          };
        }
      }
    } else {
      // CLIENTS: ClientID, ClientType, DisplayName, VerifiedEmail, IsActive, CreatedAt
      for (var j = 1; j < data.length; j++) {
        var clientId = String(data[j][0] || '').toLowerCase().trim();
        var clientName = String(data[j][2] || '').toLowerCase().trim();
        var clientActive = data[j][4] === true || data[j][4] === 'TRUE';
        if (!clientActive) continue;

        if ((matchField === 'ClientId' && clientId === valueLower) ||
            (matchField === 'DisplayName' && clientName === valueLower)) {
          return {
            name: data[j][2] || '',
            email: data[j][3] || '',
            clientId: data[j][0] || '',
          };
        }
      }
    }
    return null;
  } catch (e) {
    Logger.log('lookupEmployeeOrClient error: ' + e.message);
    return null;
  }
}

/**
 * Save form data to an external Google Sheet
 */
function saveToExternalSheet(sheetId, sheetName, executionId, flow, formData) {
  try {
    var targetSs = SpreadsheetApp.openById(sheetId);
    var targetSheet = sheetName ? targetSs.getSheetByName(sheetName) : targetSs.getActiveSheet();
    if (!targetSheet) {
      targetSheet = targetSs.insertSheet(sheetName || 'Submissions');
    }
    
    // Get form fields from flow
    var steps = flow.steps || [];
    var formStep = steps.find(function(s) { return s.type === 'form' && s.fields; });
    var fields = formStep ? formStep.fields : [];
    if (fields.length === 0) {
      Logger.log('saveToExternalSheet: No form fields found in flow');
      return;
    }
    
    // Build expected headers
    var expectedHeaders = ['ExecutionId', 'SubmittedAt'];
    for (var fi = 0; fi < fields.length; fi++) {
      expectedHeaders.push(fields[fi].label);
    }
    
    // Get existing headers from sheet
    var lastCol = targetSheet.getLastColumn();
    var existingHeaders = [];
    if (lastCol > 0 && targetSheet.getLastRow() > 0) {
      existingHeaders = targetSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }
    
    // If sheet is empty, write headers
    if (existingHeaders.length === 0 || existingHeaders[0] === '') {
      targetSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]).setFontWeight('bold');
      existingHeaders = expectedHeaders;
    }
    
    // Find or add missing headers
    var finalHeaders = existingHeaders.slice();
    for (var eh = 0; eh < expectedHeaders.length; eh++) {
      var found = false;
      for (var fh = 0; fh < finalHeaders.length; fh++) {
        if (finalHeaders[fh].toString().toLowerCase() === expectedHeaders[eh].toLowerCase()) {
          found = true;
          break;
        }
      }
      if (!found) {
        finalHeaders.push(expectedHeaders[eh]);
        targetSheet.getRange(1, finalHeaders.length).setValue(expectedHeaders[eh]).setFontWeight('bold');
      }
    }
    
    // Find or create row for this executionId
    var lastRow = targetSheet.getLastRow();
    var executionRow = 0;
    if (lastRow > 1) {
      var executionIds = targetSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < executionIds.length; i++) {
        if (executionIds[i][0] === executionId) {
          executionRow = i + 2;
          break;
        }
      }
    }
    if (executionRow === 0) {
      executionRow = Math.max(lastRow + 1, 2);
    }
    
    // Write data for each header
    for (var h = 0; h < finalHeaders.length; h++) {
      var headerName = finalHeaders[h];
      var colIndex = h + 1;
      var value = '';
      
      if (headerName === 'ExecutionId') {
        value = executionId;
      } else if (headerName === 'SubmittedAt') {
        value = new Date().toISOString();
      } else {
        // Find matching field
        for (var f = 0; f < fields.length; f++) {
          if (fields[f].label.toLowerCase() === headerName.toLowerCase()) {
            var rawValue = formData[fields[f].id];
            if (rawValue !== undefined) {
              if (Array.isArray(rawValue)) {
                value = rawValue.map(function(item) {
                  if (typeof item === 'object' && item !== null) {
                    return item.name || item.url || JSON.stringify(item);
                  }
                  return String(item);
                }).join(', ');
              } else if (typeof rawValue === 'object' && rawValue !== null) {
                value = rawValue.name || rawValue.url || JSON.stringify(rawValue);
              } else {
                value = String(rawValue);
              }
            }
            break;
          }
        }
      }
      
      targetSheet.getRange(executionRow, colIndex).setValue(value);
    }
    
    Logger.log('Data saved to external sheet: ' + sheetId + ' sheet: ' + (sheetName || 'active') + ' row: ' + executionRow);
  } catch (e) {
    Logger.log('saveToExternalSheet error: ' + e.message);
    throw e;
  }
}

/**
 * Save files from form data to an external Drive folder
 */
function saveFilesToExternalFolder(folderId, executionId, formData) {
  try {
    var folder = DriveApp.getFolderById(folderId);
    Logger.log('saveFilesToExternalFolder: Target folder = ' + folder.getName() + ' (' + folderId + ')');
    
    // Create subfolder with date prefix for organization
    var datePrefix = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
    var subFolderName = datePrefix + '_' + executionId;
    var subFolder = null;
    
    var subfolders = folder.getFoldersByName(subFolderName);
    if (subfolders.hasNext()) {
      subFolder = subfolders.next();
    } else {
      subFolder = folder.createFolder(subFolderName);
    }
    Logger.log('saveFilesToExternalFolder: Subfolder = ' + subFolder.getName());
    
    var filesSaved = [];
    
    // Find file fields in formData
    for (var key in formData) {
      var value = formData[key];
      if (!value) continue;
      
      var fileArray = Array.isArray(value) ? value : [value];
      
      for (var f = 0; f < fileArray.length; f++) {
        var fileData = fileArray[f];
        if (!fileData || !fileData.base64) {
          Logger.log('saveFilesToExternalFolder: Skipping item (no base64): ' + JSON.stringify(fileData));
          continue;
        }
        
        try {
          var blob = Utilities.newBlob(
            Utilities.base64Decode(fileData.base64),
            fileData.mimeType || 'application/octet-stream',
            fileData.name
          );
          
          var file = subFolder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          
          filesSaved.push({
            name: fileData.name,
            url: file.getUrl()
          });
          
          Logger.log('saveFilesToExternalFolder: File saved = ' + fileData.name + ' -> ' + file.getUrl());
        } catch (fileErr) {
          Logger.log('saveFilesToExternalFolder: Error saving file ' + fileData.name + ': ' + fileErr.message);
        }
      }
    }
    
    Logger.log('saveFilesToExternalFolder: Total files saved = ' + filesSaved.length);
    return { success: true, files: filesSaved };
  } catch (e) {
    Logger.log('saveFilesToExternalFolder error: ' + e.message);
    throw e;
  }
}

