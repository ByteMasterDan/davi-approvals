/**
 * AuditLogger.gs - Audit Trail Operations
 */

/**
 * API: Get audit logs
 */
function getAuditLogs(token, filters) {
  const session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin', 'SuperApprover'])) return { success: false, error: 'Access denied' };

  try {
    const ss = CONFIG.getSpreadsheet();
    const sheet = ss.getSheetByName('AUDIT_LOG');
    if (!sheet) return { success: true, logs: [] };

    const data = sheet.getDataRange().getValues();
    const logs = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        const log = {
          timestamp: normalizeDate(data[i][0]),
          approvalId: data[i][1],
          actorEmail: data[i][2],
          action: data[i][3],
          details: data[i][4],
          metadata: data[i][5],
        };

        // Apply filters if provided
        let include = true;
        if (filters) {
          if (filters.action && log.action !== filters.action) include = false;
          if (filters.actor && !log.actorEmail.toLowerCase().includes(filters.actor.toLowerCase())) include = false;
          if (filters.approvalId && log.approvalId !== filters.approvalId) include = false;
          if (filters.from && new Date(log.timestamp) < new Date(filters.from)) include = false;
          if (filters.to && new Date(log.timestamp) > new Date(filters.to)) include = false;
        }

        if (include) logs.push(log);
      }
    }

    // Sort by timestamp descending (newest first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { success: true, logs: logs };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Internal: Log an action to audit trail
 */
function logAuditAction(approvalId, actorEmail, action, details, metadata) {
  try {
    const ss = CONFIG.getSpreadsheet();
    let sheet = ss.getSheetByName('AUDIT_LOG');

    if (!sheet) {
      sheet = ss.insertSheet('AUDIT_LOG');
      sheet.getRange(1, 1, 1, 6).setValues([['Timestamp', 'ApprovalID', 'ActorEmail', 'Action', 'Details', 'Metadata']]).setFontWeight('bold');
    }

    sheet.appendRow([
      new Date().toISOString(),
      approvalId || '',
      actorEmail,
      action,
      details || '',
      metadata ? JSON.stringify(metadata) : '',
    ]);
  } catch (e) {
    Logger.log('Audit log error: ' + e.message);
  }
}