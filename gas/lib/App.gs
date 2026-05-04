/**
 * App.gs - Backend simplificado para davi-approvals
 * Gestión de usuarios, clientes, documentos y aprobaciones
 * 
 * NOTA: Las funciones de auth (login, getSession) están en Auth.gs
 */

const DRIVE_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID_HERE';

// ==========================================
// INIT DATABASE
// ==========================================
function initDatabase() {
  const ss = CONFIG.getSpreadsheet();

  const sheets = {
    'USERS': ['UserID', 'Email', 'PasswordHash', 'Role', 'DisplayName', 'Skills', 'CreatedAt', 'IsActive', 'LastLogin', 'Notes'],
    'CLIENTS': ['ClientName', 'Email', 'IsActive', 'CreatedAt', 'ClientType'],
    'AUDIT_LOG': ['Id', 'Timestamp', 'UserEmail', 'Action', 'ClientName', 'FileName', 'FileUrl', 'Status', 'Notes', 'EscalatedBy', 'EscalatedAt'],
    'SETTINGS': ['Key', 'Value'],
  };

  for (const [sheetName, headers] of Object.entries(sheets)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    } else {
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0 || sheet.getRange(1, 1).getValue() === '') {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        sheet.setFrozenRows(1);
      } else if (lastCol < headers.length) {
        // Migrate: add missing columns
        for (let c = lastCol; c < headers.length; c++) {
          sheet.getRange(1, c + 1).setValue(headers[c]).setFontWeight('bold');
        }
      }
    }
  }

  // Create default admin user if USERS sheet is empty
  const usersSheet = ss.getSheetByName('USERS');
  if (usersSheet && usersSheet.getLastRow() < 2) {
    const adminId = Utilities.getUuid();
    const adminHash = hashPassword('admin123');
    usersSheet.appendRow([
      adminId,
      'admin@davi-approvals.com',
      adminHash,
      'admin',
      'Administrator',
      '',
      new Date().toISOString(),
      true,
      '',
      'Default admin user - change password!',
    ]);
  }

  // Ensure each SETTINGS key exists (idempotent, works on existing sheets)
  const settingsSheet = ss.getSheetByName('SETTINGS');
  if (settingsSheet) {
    ensureSettingsKey(settingsSheet, 'CC_RECIPIENTS', '');
    ensureSettingsKey(settingsSheet, 'EMAIL_TEMPLATE_SUBJECT', 'Documento aprobado - {{clientName}}');
    ensureSettingsKey(settingsSheet, 'EMAIL_TEMPLATE_HTML', getDefaultEmailHTML());
    ensureSettingsKey(settingsSheet, 'CUSTOM_TEMPLATE_VARS', '[]');
  }

  return { success: true, message: 'Database initialized' };
}

// ==========================================
// USERS CRUD
// ==========================================
function getUsers(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('USERS');
    if (!sheet || sheet.getLastRow() < 2) return { success: true, users: [] };

    const data = sheet.getDataRange().getValues();
    const users = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        users.push({
          name: data[i][4] || data[i][1],
          email: data[i][1],
          role: String(data[i][3] || 'operator').toLowerCase(),
          isActive: data[i][7] === true || data[i][7] === 'TRUE',
          createdAt: data[i][6],
        });
      }
    }

    return { success: true, users };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function addUser(token, name, email, role, password) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  // Coordinator can only add operators
  if (session.role === 'coordinator' && role !== 'operator') {
    return { success: false, error: 'Coordinators can only add operators' };
  }

  if (!password || password.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters' };
  }

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('USERS');
    if (!sheet) return { success: false, error: 'USERS sheet not found' };

    // Check if user already exists
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1] || '').toLowerCase().trim() === email.toLowerCase().trim()) {
        return { success: false, error: 'User already exists' };
      }
    }

    const userId = Utilities.getUuid();
    sheet.appendRow([
      userId,
      email.toLowerCase(),
      hashPassword(password),
      role,
      name,
      '',
      new Date().toISOString(),
      true,
      '',
      '',
    ]);
    logAudit(session.email, 'USER_ADDED', '', '', '', '', 'Active', 'Added user: ' + name + ' (' + email + ')');

    return { success: true, message: 'User added' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function updateUser(token, name, email, role, isActive) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('USERS');
    if (!sheet) return { success: false, error: 'USERS sheet not found' };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1] || '').toLowerCase().trim() === email.toLowerCase().trim()) {
        sheet.getRange(i + 1, 4).setValue(role);
        sheet.getRange(i + 1, 5).setValue(name);
        sheet.getRange(i + 1, 8).setValue(isActive);
        logAudit(session.email, 'USER_UPDATED', '', '', '', '', isActive ? 'Active' : 'Inactive', 'Updated user: ' + name);
        return { success: true, message: 'User updated' };
      }
    }

    return { success: false, error: 'User not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ==========================================
// CLIENTS CRUD
// ==========================================
function getClients(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('CLIENTS');
    if (!sheet || sheet.getLastRow() < 2) return { success: true, clients: [] };

    const data = sheet.getDataRange().getValues();
    const clients = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        clients.push({
          clientName: data[i][0],
          email: data[i][1],
          isActive: data[i][2] === true || data[i][2] === 'TRUE',
          createdAt: normalizeDate(data[i][3]),
          clientType: data[i][4] || 'Natural',
        });
      }
    }

    return { success: true, clients };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function createClient(token, clientData) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('CLIENTS');
    if (!sheet) return { success: false, error: 'CLIENTS sheet not found' };

    const normalizedName = (clientData.clientName || '').toUpperCase().trim();
    const email = (clientData.email || '').toLowerCase().trim();
    const clientType = clientData.clientType || 'Natural';

    if (!normalizedName || !email) {
      return { success: false, error: 'Client name and email are required' };
    }

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').toUpperCase().trim() === normalizedName) {
        return { success: false, error: 'Client already exists' };
      }
    }

    sheet.appendRow([normalizedName, email, true, new Date().toISOString(), clientType]);
    logAudit(session.email, 'CLIENT_ADDED', normalizedName, '', '', '', 'Active', 'Added client: ' + normalizedName + ' (' + clientType + ')');

    return { success: true, message: 'Client created' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function updateClient(token, clientName, clientData) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('CLIENTS');
    if (!sheet) return { success: false, error: 'CLIENTS sheet not found' };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').toUpperCase().trim() === clientName.toUpperCase().trim()) {
        if (clientData.email !== undefined) sheet.getRange(i + 1, 2).setValue(clientData.email.toLowerCase());
        if (clientData.isActive !== undefined) sheet.getRange(i + 1, 3).setValue(clientData.isActive);
        if (clientData.clientType !== undefined) sheet.getRange(i + 1, 5).setValue(clientData.clientType);
        logAudit(session.email, 'CLIENT_UPDATED', clientName, '', '', '', clientData.isActive !== false ? 'Active' : 'Inactive', 'Updated client: ' + clientName);
        return { success: true, message: 'Client updated' };
      }
    }

    return { success: false, error: 'Client not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ==========================================
// DOCUMENT UPLOAD
// ==========================================
function uploadDocuments(token, files) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  var userRole = String(session.role || '').toLowerCase();
  if (['admin', 'operator', 'approver', 'superapprover'].indexOf(userRole) === -1) {
    return { success: false, error: 'Access denied - upload not allowed for your role' };
  }

  try {
    if (!files || !Array.isArray(files) || files.length === 0) {
      return { success: false, error: 'No files provided' };
    }

    const datePrefix = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
    const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);

    let dateFolder = null;
    const dateFolders = rootFolder.getFoldersByName(datePrefix);
    if (dateFolders.hasNext()) {
      dateFolder = dateFolders.next();
    } else {
      dateFolder = rootFolder.createFolder(datePrefix);
    }

    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.base64) continue;

      const fileName = file.name || 'unknown.pdf';
      const clientName = fileName.replace(/\.pdf$/i, '').toUpperCase().trim();

      try {
        const blob = Utilities.newBlob(
          Utilities.base64Decode(file.base64),
          file.mimeType || 'application/pdf',
          fileName
        );
        const driveFile = dateFolder.createFile(blob);
        const fileUrl = driveFile.getUrl();
        const auditId = Utilities.getUuid();

        // Write audit log BEFORE setSharing (sharing may fail due to domain policy)
        logAuditWithId(auditId, session.email, 'UPLOADED', clientName, fileName, fileUrl, 'PENDING', 'Uploaded by ' + session.email);

        // Attempt sharing (non-fatal if domain policy disallows it)
        try {
          driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (shareErr) {
          Logger.log('setSharing failed: ' + shareErr.message);
        }

        results.push({
          fileName,
          clientName,
          fileUrl,
          auditId,
          success: true,
        });
      } catch (fileErr) {
        results.push({
          fileName,
          clientName,
          success: false,
          error: fileErr.message,
        });
      }
    }

    // Send notification to coordinators
    try {
      const coordinators = getCoordinators();
      if (coordinators.length > 0) {
        const subject = '[Davi-Approvals] Nuevos documentos pendientes de aprobación';
        const body = 'Se han subido ' + results.filter(r => r.success).length + ' documento(s) pendientes de revisión.\n\n' +
                     'Operario: ' + session.email + '\n' +
                     'Fecha: ' + datePrefix + '\n\n' +
                     'Documentos:\n' +
                     results.filter(r => r.success).map(r => '- ' + r.clientName + ' (' + r.fileName + ')').join('\n') + '\n\n' +
                     'Por favor revise y apruebe los documentos en la aplicación.';

        for (const coord of coordinators) {
          GmailApp.sendEmail(coord.email, subject, body, {
            from: Session.getActiveUser().getEmail(),
            name: 'Davi-Approvals',
          });
        }
      }
    } catch (notifyErr) {
      Logger.log('Coordinator notification error: ' + notifyErr.message);
    }

    return { success: true, results };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getCoordinators() {
  const ss = CONFIG.getSpreadsheet();
  const sheet = ss.getSheetByName('USERS');
  if (!sheet || sheet.getLastRow() < 2) return [];

  const data = sheet.getDataRange().getValues();
  const coordinators = [];

  for (let i = 1; i < data.length; i++) {
    const role = String(data[i][3] || '').toLowerCase();
    const isActive = data[i][7] === true || data[i][7] === 'TRUE';
    if (role === 'coordinator' && isActive) {
      coordinators.push({ name: data[i][4], email: data[i][1] });
    }
  }

  return coordinators;
}

// ==========================================
// APPROVALS
// ==========================================
function getPendingApprovals(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('AUDIT_LOG');
    if (!sheet || sheet.getLastRow() < 2) return { success: true, approvals: [] };

    const data = sheet.getDataRange().getValues();
    const approvals = [];
    const userRole = String(session.role || '').toLowerCase();
    const isSuperApprover = userRole === 'superapprover' || userRole === 'admin';

    for (let i = 1; i < data.length; i++) {
      const status = String(data[i][7] || '').toUpperCase();
      const isPending = status === 'PENDING';
      const isEscalated = status === 'ESCALATED';

      if (isPending || (isEscalated && isSuperApprover)) {
        approvals.push({
          id: data[i][0],
          timestamp: normalizeDate(data[i][1]),
          userEmail: data[i][2],
          action: data[i][3],
          clientName: data[i][4],
          fileName: data[i][5],
          fileUrl: data[i][6],
          status: data[i][7],
          notes: data[i][8],
          escalatedBy: data[i][9] || '',
          escalatedAt: normalizeDate(data[i][10]),
        });
      }
    }

    return { success: true, approvals };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function approveDocument(token, auditId, clientEmailOverride) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('AUDIT_LOG');
    if (!sheet) return { success: false, error: 'AUDIT_LOG sheet not found' };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === auditId) {
        const clientName = String(data[i][4] || '');
        const fileName = String(data[i][5] || '');
        const fileUrl = String(data[i][6] || '');
        const escalatedBy = String(data[i][9] || '');
        const timestamp = new Date().toISOString();

        sheet.getRange(i + 1, 8).setValue('APPROVED');
        sheet.getRange(i + 1, 9).setValue('Approved by ' + session.email);

        const client = findClient(clientName);
        let targetEmail = clientEmailOverride || (client && client.email) || '';
        let emailSent = false;
        let attachment = null;

        if (fileUrl) {
          try {
            const fileId = extractFileIdFromUrl(fileUrl);
            if (fileId) {
              const driveFile = DriveApp.getFileById(fileId);
              attachment = driveFile.getAs('application/pdf');
            }
          } catch (attErr) {
            Logger.log('Failed to get attachment: ' + attErr.message);
          }
        }

        if (targetEmail) {
          try {
            const emailTemplate = getEmailTemplate();
            const templateVars = {
              clientName: clientName,
              fileName: fileName,
              date: new Date().toLocaleDateString(),
              approvedBy: session.email,
              escalatedBy: escalatedBy,
              clientType: (client && client.clientType) || '',
            };
            if (emailTemplate.customVars && emailTemplate.customVars.length > 0) {
              for (const cv of emailTemplate.customVars) {
                templateVars[cv.key] = cv.value || '';
              }
            }
            const subject = emailTemplate.subject ? interpolateTemplate(emailTemplate.subject, templateVars) : 'Documento aprobado - ' + clientName;
            let htmlBody = emailTemplate.html ? interpolateTemplate(emailTemplate.html, templateVars) : '';

            const emailOptions = {
              from: Session.getActiveUser().getEmail(),
              name: 'Davi-Approvals',
              htmlBody: htmlBody,
            };
            if (attachment) {
              emailOptions.attachments = [attachment];
            }

            GmailApp.sendEmail(targetEmail, subject, '', emailOptions);

            emailSent = true;
            sheet.getRange(i + 1, 8).setValue('EMAIL_SENT');
            sheet.getRange(i + 1, 9).setValue('Approved & emailed to ' + targetEmail);
          } catch (emailErr) {
            sheet.getRange(i + 1, 9).setValue('Approved but email failed: ' + emailErr.message);
          }
        } else {
          sheet.getRange(i + 1, 9).setValue('Approved - No client email for: ' + clientName + '. Send email manually.');
        }

        const ccRecipients = getCCRecipients();
        if (ccRecipients.length > 0) {
          const ccSubject = '[Davi-Approvals] Documento aprobado - ' + clientName;
          const ccBody = 'El documento ha sido aprobado exitosamente.\n\n' +
                         'Cliente: ' + clientName + '\n' +
                         'Documento: ' + fileName + '\n' +
                         'Aprobado por: ' + session.email +
                         (escalatedBy ? '\nEscalado por: ' + escalatedBy : '') +
                         '\nFecha: ' + timestamp + '\n\n' +
                         'El documento ha sido enviado al cliente.';

          for (const cc of ccRecipients) {
            try {
              GmailApp.sendEmail(cc, ccSubject, ccBody, {
                from: Session.getActiveUser().getEmail(),
                name: 'Davi-Approvals',
              });
            } catch (ccErr) {
              Logger.log('CC notification failed for ' + cc + ': ' + ccErr.message);
            }
          }
        }

        logAudit(session.email, 'APPROVED', clientName, fileName, fileUrl, emailSent ? 'EMAIL_SENT' : 'APPROVED', 'Approved by ' + session.email);

        return { success: true, message: emailSent ? 'Document approved & email sent' : 'Document approved (no email)', emailSent };
      }
    }

    return { success: false, error: 'Document not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function approveAllDocuments(token, auditIds) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  const results = [];
  for (const id of auditIds) {
    results.push(approveDocument(token, id));
  }

  return { success: true, results };
}

function rejectDocument(token, auditId, reason) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('AUDIT_LOG');
    if (!sheet) return { success: false, error: 'AUDIT_LOG sheet not found' };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === auditId) {
        const clientName = String(data[i][4] || '');
        const fileName = String(data[i][5] || '');

        sheet.getRange(i + 1, 8).setValue('REJECTED');
        sheet.getRange(i + 1, 9).setValue('Rejected by ' + session.email + ': ' + reason);

        logAudit(session.email, 'REJECTED', clientName, fileName, '', 'REJECTED', reason);

        return { success: true, message: 'Document rejected' };
      }
    }

    return { success: false, error: 'Document not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function escalateDocument(token, auditId) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  const userRole = String(session.role || '').toLowerCase();
  if (userRole === 'superapprover' || userRole === 'admin') {
    return { success: false, error: 'SuperApprovers and Admins cannot escalate' };
  }

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('AUDIT_LOG');
    if (!sheet) return { success: false, error: 'AUDIT_LOG sheet not found' };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === auditId) {
        const status = String(data[i][7] || '').toUpperCase();
        if (status !== 'PENDING') {
          return { success: false, error: 'Only PENDING documents can be escalated' };
        }

        const clientName = String(data[i][4] || '');
        const fileName = String(data[i][5] || '');
        const fileUrl = String(data[i][6] || '');
        const timestamp = new Date().toISOString();

        sheet.getRange(i + 1, 8).setValue('ESCALATED');
        sheet.getRange(i + 1, 10).setValue(session.email);
        sheet.getRange(i + 1, 11).setValue(timestamp);

        const superApprovers = getSuperApprovers();
        if (superApprovers.length > 0) {
          const subject = '[Davi-Approvals] Documento escalado para aprobación';
          const body = 'Se le ha delegado un documento para aprobación.\n\n' +
                       'Cliente: ' + clientName + '\n' +
                       'Documento: ' + fileName + '\n' +
                       'Escalado por: ' + session.email + '\n' +
                       'Fecha: ' + timestamp + '\n\n' +
                       'Por favor revise el documento en la aplicación.';

          for (const sa of superApprovers) {
            GmailApp.sendEmail(sa.email, subject, body, {
              from: Session.getActiveUser().getEmail(),
              name: 'Davi-Approvals',
            });
          }
        }

        logAudit(session.email, 'ESCALATED', clientName, fileName, fileUrl, 'ESCALATED', 'Escalated to SuperApprovers');

        return { success: true, message: 'Document escalated to SuperApprovers' };
      }
    }

    return { success: false, error: 'Document not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getSuperApprovers() {
  const ss = CONFIG.getSpreadsheet();
  const sheet = ss.getSheetByName('USERS');
  if (!sheet || sheet.getLastRow() < 2) return [];

  const data = sheet.getDataRange().getValues();
  const superApprovers = [];

  for (let i = 1; i < data.length; i++) {
    const role = String(data[i][3] || '').toLowerCase();
    const isActive = data[i][7] === true || data[i][7] === 'TRUE';
    if (role === 'superapprover' && isActive) {
      superApprovers.push({ name: data[i][4], email: data[i][1] });
    }
  }

  return superApprovers;
}

function getCCRecipients() {
  const ss = CONFIG.getSpreadsheet();
  const sheet = ss.getSheetByName('SETTINGS');
  if (!sheet || sheet.getLastRow() < 2) return [];

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').toUpperCase() === 'CC_RECIPIENTS') {
      const value = String(data[i][1] || '');
      if (!value) return [];
      return value.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
    }
  }

  return [];
}

function getSettings(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('SETTINGS');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, settings: { ccRecipients: [] } };
    }

    const data = sheet.getDataRange().getValues();
    const settings = { ccRecipients: [], emailTemplateSubject: '', emailTemplateHtml: '', customTemplateVars: [] };

    for (let i = 1; i < data.length; i++) {
      const key = String(data[i][0] || '').toUpperCase();
      const value = String(data[i][1] || '');
      if (key === 'CC_RECIPIENTS' && value) {
        settings.ccRecipients = value.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
      } else if (key === 'EMAIL_TEMPLATE_SUBJECT') {
        settings.emailTemplateSubject = value;
      } else if (key === 'EMAIL_TEMPLATE_HTML') {
        settings.emailTemplateHtml = value;
      } else if (key === 'CUSTOM_TEMPLATE_VARS') {
        try { settings.customTemplateVars = JSON.parse(value || '[]'); } catch(e) { settings.customTemplateVars = []; }
      }
    }

    return { success: true, settings };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getEmailTemplate() {
  const ss = CONFIG.getSpreadsheet();
  const sheet = ss.getSheetByName('SETTINGS');
  if (!sheet || sheet.getLastRow() < 2) return { subject: '', html: '', customVars: [] };

  const data = sheet.getDataRange().getValues();
  let subject = '';
  let html = '';
  let customVars = [];

  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0] || '').toUpperCase();
    const value = String(data[i][1] || '');
    if (key === 'EMAIL_TEMPLATE_SUBJECT') subject = value || '';
    else if (key === 'EMAIL_TEMPLATE_HTML') html = value || '';
    else if (key === 'CUSTOM_TEMPLATE_VARS') { try { customVars = JSON.parse(value || '[]'); } catch(e) { customVars = []; } }
  }

  return { subject: subject || 'Documento aprobado - {{clientName}}', html: html || getDefaultEmailHTML(), customVars: customVars };
}

function interpolateTemplate(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp('{{' + key + '}}', 'g'), String(value || ''));
  }
  return result;
}

function getDefaultEmailHTML() {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Documento Aprobado</title></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f5f5f5;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);"><!-- HEADER --><tr><td style="background:linear-gradient(135deg,#CE1126 0%,#a30d1f 100%);padding:30px 40px;position:relative;overflow:hidden;"><div style="position:absolute;top:-50px;right:-50px;width:150px;height:150px;background:rgba(255,255,255,0.1);border-radius:50%;"></div><div style="position:absolute;bottom:-30px;left:20px;width:80px;height:80px;background:rgba(255,255,255,0.08);border-radius:50%;"></div><table cellpadding="0" cellspacing="0" width="100%"><tr><td><span style="font-size:24px;font-weight:bold;color:#ffffff;letter-spacing:1px;">DAVIVIENDA</span></td><td align="right"><span style="font-size:12px;color:rgba(255,255,255,0.8);">Sistema de Aprobaciones</span></td></tr></table></td></tr><!-- SUCCESS ICON --><tr><td style="padding:40px 40px 20px;text-align:center;"><div style="display:inline-block;width:80px;height:80px;background-color:#28a745;border-radius:50%;line-height:80px;text-align:center;box-shadow:0 4px 12px rgba(40,167,69,0.3);"><span style="color:#ffffff;font-size:36px;font-weight:bold;">&#10003;</span></div><h1 style="margin:20px 0 5px;font-size:28px;color:#1a1a1a;font-weight:bold;">Documento Aprobado</h1><p style="margin:0;color:#666666;font-size:14px;">Su documento ha sido procesado exitosamente</p></td></tr><!-- CONTENT CARD --><tr><td style="padding:20px 40px;"><div style="background-color:#f8f9fa;border-left:4px solid #CE1126;border-radius:4px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,0.08);"><table width="100%" cellpadding="4"><tr><td style="color:#999999;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Cliente</td></tr><tr><td style="color:#1a1a1a;font-size:16px;font-weight:bold;padding-bottom:16px;">{{clientName}}</td></tr><tr><td style="color:#999999;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Documento</td></tr><tr><td style="color:#1a1a1a;font-size:16px;padding-bottom:16px;">{{fileName}}</td></tr><tr><td style="color:#999999;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Fecha de Aprobación</td></tr><tr><td style="color:#1a1a1a;font-size:16px;padding-bottom:16px;">{{date}}</td></tr><tr><td style="color:#999999;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Aprobado por</td></tr><tr><td style="color:#1a1a1a;font-size:16px;">{{approvedBy}}</td></tr></table></div></td></tr><!-- MESSAGE --><tr><td style="padding:10px 40px 20px;"><p style="color:#333333;font-size:15px;line-height:1.7;margin:0;">Estimado/a <strong>{{clientName}}</strong>,</p><p style="color:#333333;font-size:15px;line-height:1.7;margin:15px 0;">Nos complace informarle que su documento ha sido aprobado exitosamente y se encuentra disponible para su consulta.</p><p style="color:#333333;font-size:15px;line-height:1.7;margin:15px 0;">Si tiene alguna duda o necesita asistencia, no dude en contactarnos.</p></td></tr><!-- CTA BUTTON --><tr><td style="padding:10px 40px 30px;text-align:center;"><a href="#" style="display:inline-block;background:linear-gradient(135deg,#CE1126 0%,#a30d1f 100%);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:6px;font-weight:bold;font-size:14px;box-shadow:0 4px 12px rgba(206,17,38,0.3);">Ver Documento</a></td></tr><!-- FOOTER --><tr><td style="background-color:#1a1a1a;padding:25px 40px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td><p style="color:#ffffff;font-size:14px;font-weight:bold;margin:0 0 5px;">Banco Davivienda Salvadoreño S.A.</p><p style="color:rgba(255,255,255,0.6);font-size:11px;margin:0;line-height:1.5;">Este es un correo automático generado por el Sistema de Aprobaciones.<br>Por favor no responda directamente a este mensaje.</p></td><td align="right" style="vertical-align:bottom;"><div style="width:4px;height:40px;background-color:#CE1126;border-radius:2px;"></div></td></tr></table></td></tr></table></td></tr></table></body></html>';
}

function updateSettings(token, key, value) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  const userRole = String(session.role || '').toLowerCase();
  if (userRole !== 'admin' && userRole !== 'superapprover') {
    return { success: false, error: 'Access denied' };
  }

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('SETTINGS');
    if (!sheet) return { success: false, error: 'SETTINGS sheet not found' };

    const data = sheet.getDataRange().getValues();
    const upperKey = key.toUpperCase();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').toUpperCase() === upperKey) {
        sheet.getRange(i + 1, 2).setValue(value);
        return { success: true, message: 'Settings updated' };
      }
    }

    sheet.appendRow([key, value]);
    return { success: true, message: 'Settings updated' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ==========================================
// AUDIT LOG
// ==========================================
function getAuditLog(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('AUDIT_LOG');
    if (!sheet || sheet.getLastRow() < 2) return { success: true, logs: [] };

    const data = sheet.getDataRange().getValues();
    const logs = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        logs.push({
          id: data[i][0],
          timestamp: normalizeDate(data[i][1]),
          userEmail: data[i][2],
          action: data[i][3],
          clientName: data[i][4],
          fileName: data[i][5],
          fileUrl: data[i][6],
          status: data[i][7],
          notes: data[i][8],
        });
      }
    }

    return { success: true, logs: logs.reverse() };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function logAuditWithId(id, userEmail, action, clientName, fileName, fileUrl, status, notes) {
  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('AUDIT_LOG');
    if (!sheet) return;

    sheet.appendRow([
      id,
      new Date().toISOString(),
      userEmail,
      action,
      clientName,
      fileName,
      fileUrl,
      status,
      notes,
      '',
      '',
    ]);
  } catch (e) {
    Logger.log('logAuditWithId error: ' + e.message);
  }
}

function logAudit(userEmail, action, clientName, fileName, fileUrl, status, notes) {
  logAuditWithId(Utilities.getUuid(), userEmail, action, clientName, fileName, fileUrl, status, notes);
}

// ==========================================
// HELPERS
// ==========================================
function findClient(clientName) {
  const ss = CONFIG.getSpreadsheet();
  const sheet = ss.getSheetByName('CLIENTS');
  if (!sheet || sheet.getLastRow() < 2) return null;

  const data = sheet.getDataRange().getValues();
  const searchName = clientName.toUpperCase().trim();

  for (let i = 1; i < data.length; i++) {
    const sheetName = String(data[i][0] || '').toUpperCase().trim();
    const isActive = data[i][2] === true || data[i][2] === 'TRUE';
    if (sheetName === searchName && isActive) {
      return {
        clientName: data[i][0],
        email: data[i][1],
        isActive: true,
      };
    }
  }

  return null;
}

function getDashboard(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('AUDIT_LOG');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, stats: { uploaded: 0, pending: 0, approved: 0, rejected: 0, emailed: 0 }, recent: [] };
    }

    const data = sheet.getDataRange().getValues();

    let pending = 0, approved = 0, rejected = 0, emailed = 0;
    const recent = [];

    for (let i = 1; i < data.length; i++) {
      const status = String(data[i][7] || '').toUpperCase();

      if (status === 'PENDING') pending++;
      if (status === 'APPROVED') approved++;
      if (status === 'REJECTED') rejected++;
      if (status === 'EMAIL_SENT') emailed++;

      if (recent.length < 10) {
        recent.push({
          timestamp: normalizeDate(data[i][1]),
          userEmail: data[i][2],
          action: data[i][3],
          clientName: data[i][4],
          fileName: data[i][5],
          status: data[i][7],
        });
      }
    }

    return {
      success: true,
      stats: { uploaded: 0, pending, approved, rejected, emailed },
      recent: recent.reverse(),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function extractFileIdFromUrl(url) {
  if (!url) return null;
  // Match /d/FILE_ID/ or id=FILE_ID
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function ensureSettingsKey(sheet, key, defaultValue) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').toUpperCase() === key.toUpperCase()) return;
  }
  sheet.appendRow([key, defaultValue]);
}
