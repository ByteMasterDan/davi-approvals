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
    'CLIENTS': ['ClientName', 'Email', 'IsActive', 'CreatedAt'],
    'AUDIT_LOG': ['Id', 'Timestamp', 'UserEmail', 'Action', 'ClientName', 'FileName', 'FileUrl', 'Status', 'Notes'],
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
      }
    }
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
          createdAt: data[i][3],
        });
      }
    }

    return { success: true, clients };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function addClient(token, clientName, email) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('CLIENTS');
    if (!sheet) return { success: false, error: 'CLIENTS sheet not found' };

    const normalizedName = clientName.toUpperCase().trim();

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').toUpperCase().trim() === normalizedName) {
        return { success: false, error: 'Client already exists' };
      }
    }

    sheet.appendRow([normalizedName, email.toLowerCase(), true, new Date().toISOString()]);
    logAudit(session.email, 'CLIENT_ADDED', normalizedName, '', '', '', 'Active', 'Added client: ' + normalizedName);

    return { success: true, message: 'Client added' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function updateClient(token, clientName, email, isActive) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('CLIENTS');
    if (!sheet) return { success: false, error: 'CLIENTS sheet not found' };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').toUpperCase().trim() === clientName.toUpperCase().trim()) {
        sheet.getRange(i + 1, 2).setValue(email.toLowerCase());
        sheet.getRange(i + 1, 3).setValue(isActive);
        logAudit(session.email, 'CLIENT_UPDATED', clientName, '', '', '', isActive ? 'Active' : 'Inactive', 'Updated client: ' + clientName);
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
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        const fileUrl = driveFile.getUrl();
        const auditId = Utilities.getUuid();

        logAuditWithId(auditId, session.email, 'UPLOADED', clientName, fileName, fileUrl, 'PENDING', 'Uploaded by ' + session.email);

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

    for (let i = 1; i < data.length; i++) {
      const status = String(data[i][7] || '').toUpperCase();
      if (status === 'PENDING') {
        approvals.push({
          id: data[i][0],
          timestamp: data[i][1],
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

    return { success: true, approvals };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function approveDocument(token, auditId) {
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

        sheet.getRange(i + 1, 8).setValue('APPROVED');
        sheet.getRange(i + 1, 9).setValue('Approved by ' + session.email);

        const client = findClient(clientName);
        let emailSent = false;

        if (client && client.email) {
          try {
            const subject = 'Documento aprobado - ' + clientName;
            const body = 'Estimado/a ' + clientName + ',\n\n' +
                         'Su documento ha sido aprobado exitosamente.\n\n' +
                         'Documento: ' + fileName + '\n' +
                         'Fecha: ' + new Date().toLocaleDateString() + '\n\n' +
                         'Saludos cordiales,\n' +
                         'Equipo de Aprobaciones';

            GmailApp.sendEmail(client.email, subject, body, {
              from: Session.getActiveUser().getEmail(),
              name: 'Davi-Approvals',
            });

            emailSent = true;
            sheet.getRange(i + 1, 8).setValue('EMAIL_SENT');
            sheet.getRange(i + 1, 9).setValue('Approved & emailed to ' + client.email);
          } catch (emailErr) {
            sheet.getRange(i + 1, 9).setValue('Approved but email failed: ' + emailErr.message);
          }
        } else {
          sheet.getRange(i + 1, 9).setValue('Approved - Client not found: ' + clientName + '. Send email manually.');
        }

        logAudit(session.email, 'APPROVED', clientName, fileName, fileUrl, emailSent ? 'EMAIL_SENT' : 'APPROVED', 'Approved by ' + session.email);

        return { success: true, message: emailSent ? 'Document approved & email sent' : 'Document approved (client not found)', emailSent };
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
          timestamp: data[i][1],
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
          timestamp: data[i][1],
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
