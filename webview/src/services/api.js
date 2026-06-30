import {
  createFolder as createFolderRequest,
  createProject as createProjectRequest,
  createTestCase,
  getCaseDetail as getCaseDetailRequest,
  getCases as listCasesRequest,
  getRepositoryTree as getRepositoryTreeRequest,
  updateCase as updateCaseRequest,
  initializeCasesRoot,
  onCasesUpdated,
  onRunsUpdated,
  onInit,
  ready,
  getInitPayload,
  listCaseTemplates,
  getCaseTemplateContent,
  saveCaseTemplate,
  saveTestAsset,
  getWorkspaceUsernames,
  getCaseFilters,
  postCaseComment,
  deleteCaseComment,
  archiveCase,
  deleteCase,
  renameCase,
  renameFolder,
  deleteFolder,
  deleteProject,
  archiveFolder,
  restoreFolder,
  restoreCase,
  moveCase,
  getDashboardSummary,
  invoke,
  deleteLocalAsset,
  listRuns as listRunsRequest,
  getRunDetail as getRunDetailRequest,
  createRun as createRunRequest,
  updateRunTitle as updateRunTitleRequest,
  addRunCases as addRunCasesRequest,
  removeRunCase as removeRunCaseRequest,
  setRunCaseResult as setRunCaseResultRequest,
  saveRunResults as saveRunResultsRequest,
  deleteRun as deleteRunRequest,
  initializeRunsRoot,
} from "../api/vscodeApi.js";

export {
  onCasesUpdated,
  onRunsUpdated,
  onInit,
  ready,
  getInitPayload,
  initializeCasesRoot,
  initializeRunsRoot,
  listCaseTemplates,
  getCaseTemplateContent,
  saveCaseTemplate,
  saveTestAsset,
  deleteLocalAsset,
  getWorkspaceUsernames,
  getCaseFilters,
  postCaseComment,
  deleteCaseComment,
  archiveCase,
  deleteCase,
  renameCase,
  renameFolder,
  deleteFolder,
  deleteProject,
  archiveFolder,
  restoreFolder,
  restoreCase,
  moveCase,
  getDashboardSummary,
  invoke,
};

export const getRepositoryTree = async (_projectOrOptions = undefined, _repoSlug = null) => {
  return getRepositoryTreeRequest();
};

export const getCases = async (repoSlug = null, extraParams = {}) => {
  if (!repoSlug) {
    return { items: [], total: 0 };
  }
  const params = {
    directory: extraParams.directory || null,
    path_prefix: extraParams.path_prefix || extraParams.pathPrefix || null,
    status: extraParams.status || null,
    priority: extraParams.priority || null,
    tag: extraParams.tag || null,
    approve_status: extraParams.approve_status || extraParams.approveStatus || null,
    updated_by: extraParams.updated_by || extraParams.updatedBy || null,
    assigned_to: extraParams.assigned_to || extraParams.assignedTo || null,
    automated: extraParams.automated,
    search: extraParams.search || null,
    limit: extraParams.limit,
    offset: extraParams.offset,
  };
  return listCasesRequest(params);
};

export const getCaseDetail = (filePath, _repoSlug = null) =>
  getCaseDetailRequest(filePath);

export const updateCase = (filePath, payload, _repoSlug = null) =>
  updateCaseRequest(filePath, payload);

export const createProject = (projectName, _repoSlug = null) =>
  createProjectRequest(projectName);

export const createFolder = (parentPath, folderName, _repoSlug = null) =>
  createFolderRequest(parentPath, folderName);

export { createTestCase };

export const listRuns = () => listRunsRequest();

export const getRunDetail = (runId) => getRunDetailRequest(runId);

export const createRun = (runId, title) => createRunRequest(runId, title);

export const updateRunTitle = (runId, title) =>
  updateRunTitleRequest(runId, title);

export const addRunCases = (runId, paths) => addRunCasesRequest(runId, paths);

export const removeRunCase = (runId, path) =>
  removeRunCaseRequest(runId, path);

export const setRunCaseResult = (runId, path, result) =>
  setRunCaseResultRequest(runId, path, result);

export const saveRunResults = (runId, updates) =>
  saveRunResultsRequest(runId, updates);

export const deleteRun = (runId) => deleteRunRequest(runId);
