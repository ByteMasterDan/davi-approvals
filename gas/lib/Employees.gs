/**
 * Employees.gs - CRUD Operations for Employee Directory
 */

/**
 * API: Get all employees
 */
function getEmployees(token) {
  var session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  try {
    var ss = CONFIG.getSpreadsheet();
    var sheet = ss.getSheetByName('EMPLOYEES');
    if (!sheet) return { success: true, employees: [] };

    var data = sheet.getDataRange().getValues();
    var employees = [];

    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) {
        employees.push({
          employeeId: data[i][0],
          employeeNumber: data[i][1],
          displayName: data[i][2],
          email: data[i][3],
          department: data[i][4],
          isActive: data[i][5] === true || data[i][5] === 'TRUE',
          createdAt: normalizeDate(data[i][6]),
        });
      }
    }

    return { success: true, employees: employees };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Create a new employee
 */
function createEmployee(token, employeeData) {
  var session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin', 'Operator'])) return { success: false, error: 'Access denied' };

  try {
    var ss = CONFIG.getSpreadsheet();
    var sheet = ss.getSheetByName('EMPLOYEES');
    if (!sheet) return { success: false, error: 'EMPLOYEES sheet not found' };

    var employeeId = 'EMP-' + new Date().getTime();
    var now = new Date().toISOString();

    sheet.appendRow([
      employeeId,
      employeeData.employeeNumber || '',
      employeeData.name,
      employeeData.email,
      employeeData.department || '',
      true,
      now,
    ]);

    return { success: true, employeeId: employeeId, message: 'Employee created' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Update an employee
 */
function updateEmployee(token, employeeId, employeeData) {
  var session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin', 'Operator'])) return { success: false, error: 'Access denied' };

  try {
    var ss = CONFIG.getSpreadsheet();
    var sheet = ss.getSheetByName('EMPLOYEES');
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === employeeId) {
        if (employeeData.employeeNumber !== undefined) sheet.getRange(i + 1, 2).setValue(employeeData.employeeNumber);
        if (employeeData.name) sheet.getRange(i + 1, 3).setValue(employeeData.name);
        if (employeeData.email) sheet.getRange(i + 1, 4).setValue(employeeData.email);
        if (employeeData.department !== undefined) sheet.getRange(i + 1, 5).setValue(employeeData.department);
        if (employeeData.isActive !== undefined) sheet.getRange(i + 1, 6).setValue(employeeData.isActive);
        return { success: true, message: 'Employee updated' };
      }
    }

    return { success: false, error: 'Employee not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * API: Delete an employee (soft delete)
 */
function deleteEmployee(token, employeeId) {
  var session = getSession(token);
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!hasRole(token, ['Admin'])) return { success: false, error: 'Access denied' };

  try {
    var ss = CONFIG.getSpreadsheet();
    var sheet = ss.getSheetByName('EMPLOYEES');
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === employeeId) {
        sheet.getRange(i + 1, 6).setValue(false);
        return { success: true, message: 'Employee deactivated' };
      }
    }

    return { success: false, error: 'Employee not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
