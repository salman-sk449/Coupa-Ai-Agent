// src/features/oaf/oafClient.js
// Wrapper functions for interacting with the Open Assistant Framework (OAF) API.
// Uses initOAFInstance (supported by your SDK build) and logs runtime config to verify IDs/host.

import { initOAFInstance } from "@coupa/open-assistant-framework-client";
import config from "./oafConfig";
import { STATUSES, CONFIG_PROPS } from "./oafConstants";

// --- safe event emitter for standalone mode ---
const createNoopEmitter = () => ({
  on: () => {},
  off: () => {},
  emit: () => {},
});

let oafApp = null;
try {
  // IMPORTANT: pass dynamic iframeId & coupahost (read from URL by oafConfig.js)
  // Add aliases (clientId + host) to satisfy stricter client/host builds.
  oafApp = initOAFInstance({
    appId:    config.appId,
    clientId: config.appId,

    // For binding: use domain-only host, and provide it under both keys.
    coupahost: config.coupahost, // e.g., "ey-in-demo.coupacloud.com"
    host:      config.coupahost,

    iframeId:  config.iframeId,
  });

  // DEBUG: log config & current URL to confirm the iframe id came from the query string
  console.log("[OAF CONFIG AT RUNTIME]", {
    appId: config.appId,
    clientId: config.appId,
    coupahost: config.coupahost,
    host: config.coupahost,
    iframeId: config.iframeId,
  });
  console.log("[LOCATION HREF]", window.location.href);
} catch (e) {
  console.error("[OAF init error]", e);
  oafApp = null;
}

// --- helpers to normalize responses ---
const failure = (message, rawError) => ({
  status: STATUSES.ERROR,
  message,
  ...(rawError ? { rawError } : {}),
});

const noOafMsg = (op) =>
  `OAF is not connected (${op} unavailable in standalone). Open the app from within Coupa.`;

/**
 * Safely execute an OAF call. Returns normalized result or a failure object.
 */
const callOaf = async (factory, opName) => {
  if (!oafApp) return failure(noOafMsg(opName));
  try {
    const resp = await factory();
    if (resp == null) {
      // Surface as a clear failure so we can see the host is ignoring it
      return failure(`No response from OAF for ${opName}`);
    }
    return resp;
  } catch (err) {
    return failure(`OAF ${opName} failed`, err);
  }
};

// --- utilities ---
const normalizePath = (p) => {
  if (!p) return "";
  // Strip any stray bullet characters / unusual whitespace
  p = p.replace(/\u2022/g, "").trim();
  // If a full URL was pasted, strip origin
  try {
    const u = new URL(p);
    p = u.pathname + (u.search || "");
  } catch {
    /* not a full URL */
  }
  if (!p.startsWith("/")) p = "/" + p;
  return p.replace(/\/{2,}/g, "/");
};

// ====== BASIC CONTEXT CALLS (prove we are connected) ======
export const getUserContext = async () =>
  callOaf(() => oafApp.getUserContext(), "getUserContext");

export const getPageContext = async () =>
  callOaf(() => oafApp.getPageContext(), "getPageContext");

// ====== NAVIGATION (dual-signature, resilient) ======
/**
 * Navigates the user to a specific path using OAF.
 * Tries the object signature first ({ path }), then falls back to plain string.
 */
export const navigatePath = async (path) =>
  callOaf(async () => {
    const normalized = normalizePath(path);

    // Instead of using OAF navigation, navigate the parent window directly to the full Coupa URL
    try {
      const fullUrl = `${CONFIG_PROPS.HOST_URLS.HTTPS_PROTOCOL}${config.coupahost}${normalized}`;
      window.parent.location.href = fullUrl;
      return { status: "success", message: "Navigated parent window to " + fullUrl };
    } catch (e) {
      return failure(`Failed to navigate parent window: ${e.message}`, e);
    }
  }, "navigatePath");

// ====== WINDOW MANAGEMENT (prove permissions) ======
export const setSize = async (height, width) =>
  callOaf(() => oafApp.setSize({ height, width }), "setSize");

export const moveAppToLocation = async (top, left, resetToDock) =>
  callOaf(() => oafApp.moveToLocation({ top, left, resetToDock }), "moveToLocation");

export const moveAndResize = async (top, left, height, width, resetToDock) =>
  callOaf(() => oafApp.moveAndResize({ top, left, height, width, resetToDock }), "moveAndResize");

// ====== ENTERPRISE / FORMS ======
export const openEasyForm = async (formId) => {
  if (!oafApp || !oafApp.enterprise) return failure(noOafMsg("openEasyForm"));
  return callOaf(() => oafApp.enterprise.openEasyForm(formId), "openEasyForm");
};

export const readForm = async (readMetaData) =>
  callOaf(() => oafApp.readForm({ formMetaData: readMetaData }), "readForm");

export const writeForm = async (writeData) =>
  callOaf(() => oafApp.writeForm(writeData), "writeForm");

// ====== SUBSCRIPTIONS / EVENTS ======
export const subscribeToLocation = async (subscriptionData) =>
  callOaf(() => oafApp.listenToDataLocation(subscriptionData), "listenToDataLocation");

export const subscribeToEvents = async (eventsSubscriptionData) =>
  callOaf(() => oafApp.listenToOafEvents(eventsSubscriptionData), "listenToOafEvents");

export const oafEvents = () => (oafApp?.events ? oafApp.events : createNoopEmitter());

// ====== METADATA / PROCESSES ======
export const getElementMeta = async (formStructure) =>
  callOaf(() => oafApp.getElementMeta(formStructure), "getElementMeta");

export const launchUiButtonClickProcess = async (processId) => {
  if (!oafApp || !oafApp.enterprise) return failure(noOafMsg("launchUiButtonClickProcess"));
  return callOaf(
    () => oafApp.enterprise.launchUiButtonClickProcess(processId),
    "launchUiButtonClickProcess"
  );
};