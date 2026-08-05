// Fixed row layout every master sheet in this feature is assumed to follow
// (confirmed against the real master sheet's layout — see
// TemplateSettingsWizard.jsx's own comment on this). Plain constants only,
// no server-only imports, so both the client-side wizard and the client-side
// export engine (lib/exports/excelTemplateEngine.js) can import this freely.
export const HEADER_ROW_INDEX = 2 // 0-based — "line 3", the real column-header row
export const GROUP_LABEL_ROW_INDEX = HEADER_ROW_INDEX - 1 // "line 2" — merged group-label row
export const DATA_START_ROW_EXCEL = HEADER_ROW_INDEX + 2 // 1-based Excel row where real data begins ("row 4")
