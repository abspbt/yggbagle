// 歪嘴雞烘焙後台 PWA — Phase 6：串接真實 Worker API
// 統一在這裡處理 fetch、token 存取（12 小時有效，比照 Worker 簽發的 token TTL）、
// 401 自動清掉過期 token，呼叫端只要 catch 到 err.isAuthError 就導回登入頁即可。

const API_BASE = 'https://ygg-hidden-star-9fe8.drum3126.workers.dev';
const TOKEN_KEY = 'ykj_pwa_token_v1';

const Api = {
  getToken() {
    let raw;
    try {
      raw = localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (!data.token || !data.expires_at) return null;
      if (Math.floor(Date.now() / 1000) >= data.expires_at) {
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }
      return data.token;
    } catch (e) {
      return null;
    }
  },
  setToken(token, expiresAt) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expires_at: expiresAt }));
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },
  hasValidToken() {
    return !!this.getToken();
  },

  async request(path, options) {
    options = options || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = this.getToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    let res;
    try {
      res = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
    } catch (e) {
      throw new Error('無法連線到伺服器，請檢查網路連線後再試一次');
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('伺服器回應格式錯誤');
    }

    if (res.status === 401) {
      this.clearToken();
      const err = new Error((data && data.error) || '登入已過期，請重新登入');
      err.isAuthError = true;
      throw err;
    }

    if (!res.ok || !data.ok) {
      throw new Error((data && data.error) || `發生未知錯誤（${res.status}）`);
    }

    return data;
  },

  get(path) {
    return this.request(path, { method: 'GET' });
  },
  post(path, body) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  },
  patch(path, body) {
    return this.request(path, { method: 'PATCH', body: JSON.stringify(body) });
  },
  del(path) {
    return this.request(path, { method: 'DELETE' });
  },
  login(pin) {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify({ pin }) });
  },
};

window.Api = Api;
