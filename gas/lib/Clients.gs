/**
 * Clients.gs - CRUD Operations for Client Directory
 */

/**
 * API: Get all clients
 */
function getClients(token) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('CLIENTS');
    if (!sheet) return { success: true, clients: [] };

    const data = sheet.getDataRange().getValues();
    const clients = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        clients.push({
          clientId: data[i][0],
          clientType: data[i][1],
          displayName: data[i][2],
          verifiedEmail: data[i][3],
          isActive: data[i][4] === true || data[i][4] === 'TRUE',
          createdAt: normalizeDate(data[i][5]),
        });
      }
    }

    return { success: true, clients: clients };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Create a new client
 */
function createClient(token, clientData) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin', 'Operator'])) return { success: false, error: 'Access denied' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('CLIENTS');
    if (!sheet) return { success: false, error: 'CLIENTS sheet not found' };

    const clientId = 'CLI-' + new Date().getTime();
    const now = new Date().toISOString();

    sheet.appendRow([
      clientId,
      clientData.type || 'Natural',
      clientData.name,
      clientData.email,
      true,
      now,
    ]);

    return { success: true, clientId: clientId, message: 'Client created' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Update a client
 */
function updateClient(token, clientId, clientData) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin', 'Operator'])) return { success: false, error: 'Access denied' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('CLIENTS');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === clientId) {
        if (clientData.type) sheet.getRange(i + 1, 2).setValue(clientData.type);
        if (clientData.name) sheet.getRange(i + 1, 3).setValue(clientData.name);
        if (clientData.email) sheet.getRange(i + 1, 4).setValue(clientData.email);
        if (clientData.isActive !== undefined) sheet.getRange(i + 1, 5).setValue(clientData.isActive);
        return { success: true, message: 'Client updated' };
      }
    }

    return { success: false, error: 'Client not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Delete a client (soft delete)
 */
function deleteClient(token, clientId) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin'])) return { success: false, error: 'Access denied' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('CLIENTS');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === clientId) {
        sheet.getRange(i + 1, 5).setValue(false);
        return { success: true, message: 'Client deactivated' };
      }
    }

    return { success: false, error: 'Client not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}