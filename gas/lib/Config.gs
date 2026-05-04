/**
 * Config.gs - Configuration Management
 * Single spreadsheet for everything
 */

const PROPS = PropertiesService.getScriptProperties();

const CONFIG = {
  /**
   * Get the single CONFIG_SPREADSHEET_ID
   */
  getSpreadsheetId() {
    return PROPS.getProperty('CONFIG_SPREADSHEET_ID');
  },

  /**
   * Set the single CONFIG_SPREADSHEET_ID
   */
  setSpreadsheetId(id) {
    PROPS.setProperty('CONFIG_SPREADSHEET_ID', id);
  },

  /**
   * Check if system is configured
   */
  isConfigured() {
    return !!PROPS.getProperty('CONFIG_SPREADSHEET_ID');
  },

  /**
   * Get the spreadsheet object
   */
  getSpreadsheet() {
    const id = this.getSpreadsheetId();
    if (!id) throw new Error('System not configured');
    return SpreadsheetApp.openById(id);
  },

  /**
   * Clear all configuration (for reset)
   */
  clear() {
    PROPS.deleteProperty('CONFIG_SPREADSHEET_ID');
  },
};

/**
 * API: Check if system is configured
 */
function isSystemConfigured() {
  return CONFIG.isConfigured();
}

/**
 * API: Get configuration status
 */
function getConfigStatus() {
  return {
    configured: CONFIG.isConfigured(),
    spreadsheetId: CONFIG.getSpreadsheetId(),
  };
}