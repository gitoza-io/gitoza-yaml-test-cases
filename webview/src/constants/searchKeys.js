/**
 * Search key definitions per context.
 * Each key has:
 *   - key: internal identifier (maps to API param)
 *   - label: display label shown to users
 *   - type: "text" (free input) | "enum" (single/multi select from options) | "tag" (multi-select, loaded from DB)
 *   - placeholder: input placeholder when this key is active
 *   - multi: if true, user can pick multiple values (comma-separated)
 *   - apiParam: the API query param this maps to (defaults to key)
 */

import { ASSIGNED_TO_ME, ASSIGNED_TO_ME_LABEL } from "./assignee";

const APPROVE_STATUS_KEY = "approve_status";

const ASSIGNED_TO_SEARCH_KEY = {
  key: "assigned_to",
  label: "Assigned to",
  type: "user",
  placeholder: "All",
  multi: false,
  apiParam: "assigned_to",
  filterKey: "assigned_to",
  specialOptions: [{ value: ASSIGNED_TO_ME, label: ASSIGNED_TO_ME_LABEL }],
};

export const CASE_SEARCH_KEYS = [
  {
    key: "priority",
    label: "Priority",
    type: "enum",
    placeholder: "Select priority…",
    multi: false,
    apiParam: "priority",
    filterKey: "priorities",
  },
  {
    key: "approve_status",
    label: "Approve Status",
    type: "enum",
    placeholder: "Select status…",
    multi: false,
    apiParam: "approve_status",
    options: [
      { value: "draft", label: "Draft" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
    ],
  },
  {
    key: "updated_by",
    label: "Last Updated By",
    type: "user",
    placeholder: "All",
    multi: false,
    apiParam: "updated_by",
    filterKey: "updated_by",
  },
  ASSIGNED_TO_SEARCH_KEY,
  {
    key: "automated",
    label: "Automated",
    type: "enum",
    placeholder: "Select…",
    multi: false,
    apiParam: "automated",
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
  {
    key: "param",
    label: "Custom field",
    type: "param",
    placeholder: "Select key…",
    multi: true,
  },
  {
    key: "tag",
    label: "Tag",
    type: "tag",
    placeholder: "Select tags…",
    multi: true,
    apiParam: "tag",
  },
];

export const RUN_SEARCH_KEYS = [
  {
    key: "result",
    label: "Result",
    type: "enum",
    placeholder: "Select result…",
    multi: false,
    apiParam: "result",
    options: [
      { value: "passed", label: "Passed" },
      { value: "failed", label: "Failed" },
      { value: "skipped", label: "Skipped" },
      { value: "pending", label: "Pending" },
    ],
  },
  {
    key: "priority",
    label: "Priority",
    type: "enum",
    placeholder: "Select priority…",
    multi: false,
    apiParam: "priority",
    filterKey: "priorities",
  },
  {
    key: "requirement_id",
    label: "Requirement ID",
    type: "enum",
    placeholder: "Select requirement…",
    multi: false,
    apiParam: "requirement_id",
    filterKey: "requirement_ids",
  },
  {
    key: "executed_by",
    label: "Executed By",
    type: "enum",
    placeholder: "Select executor…",
    multi: false,
    apiParam: "executed_by",
    filterKey: "executed_by",
  },
  {
    key: "automated",
    label: "Automated",
    type: "enum",
    placeholder: "Select…",
    multi: false,
    apiParam: "automated",
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
  ASSIGNED_TO_SEARCH_KEY,
  {
    key: "tag",
    label: "Tag",
    type: "tag",
    placeholder: "Select tags…",
    multi: true,
    apiParam: "tag",
  },
];

/** Case search keys; omits approve_status when review is disabled. */
export function caseSearchKeys(reviewEnabled = true) {
  if (reviewEnabled) return CASE_SEARCH_KEYS;
  return CASE_SEARCH_KEYS.filter((k) => k.key !== APPROVE_STATUS_KEY);
}

/** Run search keys for Test Run and Review run tab. */
export function runSearchKeys() {
  return RUN_SEARCH_KEYS;
}
