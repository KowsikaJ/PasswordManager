import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8080";

// The server requires this header on refresh/logout, as a cross-site request forgery defence
const AJAX = { "X-Requested-With": "XMLHttpRequest" };

// withCredentials lets the browser send and store the HttpOnly refresh cookie
const api = axios.create({ baseURL, withCredentials: true });

// No interceptors here, so refresh/logout can never trigger themselves
const bare = axios.create({ baseURL, withCredentials: true, headers: AJAX });

let token = null; // access token, kept in memory only
let onUnauthorized = null;
let refreshing = null; // one shared refresh for any number of failed requests

export const setToken = (t) => {
  token = t;
};

// App.jsx registers a function here that locks the vault
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

function refreshAccessToken() {
  if (!refreshing) {
    refreshing = bare
      .post("/api/auth/refresh")
      .then(({ data }) => {
        if (token === null) throw new Error("locked"); // the user locked while this was in flight
        token = data.token;
        return token;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/** Ends this browser's server-side session. Never throws. */
export function logoutSession() {
  return bare.post("/api/auth/logout").catch(() => {});
}

/** Ends every session on every device. Throws on failure. */
export function logoutEverywhere() {
  return api.post("/api/account/logout-all");
}

api.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;

    // Only react to a 401 on a request made while signed in.
    // A 401 on the login form just means a wrong password.
    if (response?.status !== 401 || !token || !config) return Promise.reject(error);

    // Already retried once after a refresh and still unauthorised: give up
    if (config._retried) {
      if (onUnauthorized) onUnauthorized();
      return Promise.reject(error);
    }

    config._retried = true;
    try {
      await refreshAccessToken();
      return api(config); // the request interceptor attaches the new token
    } catch {
      if (onUnauthorized) onUnauthorized();
      return Promise.reject(error);
    }
  }
);

export default api;