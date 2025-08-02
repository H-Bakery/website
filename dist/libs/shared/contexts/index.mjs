import { jsx as _ } from "react/jsx-runtime";
import { createContext as X, useState as q, useMemo as V, useEffect as j, useCallback as h, useContext as Y, useRef as I } from "react";
const Q = X(void 0), nt = () => {
  var r;
  return typeof window > "u" ? "light" : (r = window.matchMedia) != null && r.call(window, "(prefers-color-scheme: dark)").matches ? "dark" : "light";
}, at = (r, t) => r === "system" ? t ? "dark" : "light" : r, it = ({
  children: r,
  defaultMode: t = "light",
  defaultEnableTransitions: e = !0,
  storageKey: c = "bakery-theme",
  disablePersistence: f = !1,
  customTheme: i
}) => {
  const [g, p] = q(nt() === "dark"), [s, T] = q(t), [w, U] = q(e), [v, k] = q(i), C = V(
    () => at(s, g),
    [s, g]
  ), A = V(
    () => ({
      mode: s,
      colorScheme: C,
      enableTransitions: w,
      customTheme: v
    }),
    [s, C, w, v]
  );
  j(() => {
    if (!(typeof window > "u" || f))
      try {
        const n = localStorage.getItem(c);
        if (n) {
          const m = JSON.parse(n);
          m.mode && ["light", "dark", "system"].includes(m.mode) && T(m.mode), typeof m.enableTransitions == "boolean" && U(m.enableTransitions), m.customTheme && k(m.customTheme);
        }
      } catch (n) {
        console.warn("Failed to load theme from storage:", n);
      }
  }, [c, f]), j(() => {
    var R, J;
    if (typeof window > "u") return;
    const n = window.matchMedia("(prefers-color-scheme: dark)"), m = (L) => {
      p(L.matches);
    };
    return (R = n.addEventListener) == null || R.call(n, "change", m), n.addEventListener || (J = n.addListener) == null || J.call(n, m), () => {
      var L, H;
      (L = n.removeEventListener) == null || L.call(n, "change", m), n.removeEventListener || (H = n.removeListener) == null || H.call(n, m);
    };
  }, []), j(() => {
    if (typeof window > "u") return;
    const n = document.documentElement;
    n.classList.remove("light", "dark"), n.classList.add(C), w ? n.classList.add("theme-transitions") : n.classList.remove("theme-transitions"), v && Object.entries(v).forEach(([m, R]) => {
      n.style.setProperty(`--theme-${m}`, String(R));
    });
  }, [C, w, v]), j(() => {
    if (!(typeof window > "u" || f))
      try {
        const n = {
          mode: s,
          enableTransitions: w,
          customTheme: v
        };
        localStorage.setItem(c, JSON.stringify(n));
      } catch (n) {
        console.warn("Failed to save theme to storage:", n);
      }
  }, [s, w, v, c, f]);
  const b = h(() => {
    T((n) => n === "light" ? "dark" : n === "dark" ? "system" : "light");
  }, []), W = h((n) => {
    T(n);
  }, []), F = h((n) => {
    U(n);
  }, []), M = h(() => {
    T(t), U(e), k(i);
  }, [t, e, i]), z = V(
    () => ({
      theme: A,
      mode: s,
      colorScheme: C,
      toggleTheme: b,
      setMode: W,
      setTransitionsEnabled: F,
      setCustomTheme: k,
      resetTheme: M,
      systemPrefersDark: g
    }),
    [A, s, C, b, W, g]
  );
  return /* @__PURE__ */ _(Q.Provider, { value: z, children: r });
}, tt = () => {
  const r = Y(Q);
  if (!r)
    throw new Error("useTheme must be used within a ThemeProvider");
  return r;
}, pt = () => {
  const { colorScheme: r } = tt();
  return r;
}, Pt = () => {
  const { colorScheme: r } = tt();
  return r === "dark";
}, et = X(void 0), ct = {
  totalCount: 0,
  subtotal: 0,
  discount: 0,
  tax: 0,
  total: 0,
  totalWeight: 0
}, ut = ({
  children: r,
  storageKey: t = "bakery-cart",
  enablePersistence: e = !0,
  taxRate: c = 0.19,
  // 19% German VAT
  maxItems: f = 100,
  maxQuantityPerItem: i = 99,
  autoSaveDelay: g = 1e3,
  validateItem: p
}) => {
  const [s, T] = q([]), [w, U] = q(!0), [v, k] = q(null), [C, A] = q(0), [b, W] = q(null), F = V(() => {
    if (s.length === 0) return ct;
    const a = s.reduce((N, $) => N + $.quantity, 0), o = s.reduce((N, $) => N + $.price * $.quantity, 0), P = o * c, l = o - C + P, E = s.reduce(
      (N, $) => N + ($.weight || 0) * $.quantity,
      0
    );
    return {
      totalCount: a,
      subtotal: o,
      discount: C,
      tax: P,
      total: l,
      totalWeight: E
    };
  }, [s, C, c]), M = h(async () => {
    const a = {}, o = [];
    s.length > f && o.push(`Cart cannot contain more than ${f} different items`);
    for (const l of s) {
      const E = [];
      l.quantity > i && E.push(`Maximum quantity is ${i}`), l.quantity < 1 && E.push("Quantity must be at least 1"), l.stock !== void 0 && l.quantity > l.stock && E.push(`Only ${l.stock} items available`), l.isActive === !1 && E.push("Product is no longer available"), p && E.push(...p(l)), E.length > 0 && (a[l.id] = E);
    }
    return { isValid: Object.keys(a).length === 0 && o.length === 0, errors: a, globalErrors: o };
  }, [s, f, i, p]), z = V(() => {
    const a = {}, o = [];
    s.length > f && o.push(`Cart cannot contain more than ${f} different items`);
    for (const P of s) {
      const l = [];
      P.quantity > i && l.push(`Maximum quantity is ${i}`), l.length > 0 && (a[P.id] = l);
    }
    return {
      isValid: Object.keys(a).length === 0 && o.length === 0,
      errors: a,
      globalErrors: o
    };
  }, [s, f, i]);
  j(() => {
    if (!e || typeof window > "u") {
      U(!1);
      return;
    }
    try {
      const a = localStorage.getItem(t);
      if (a) {
        const o = JSON.parse(a);
        Array.isArray(o.items) && T(o.items), o.discountCode && (k(o.discountCode), A(o.discountAmount || 0));
      }
    } catch (a) {
      console.warn("Failed to load cart from storage:", a);
    } finally {
      U(!1);
    }
  }, [t, e]), j(() => {
    if (!e || typeof window > "u" || w) return;
    b && clearTimeout(b);
    const a = setTimeout(() => {
      try {
        const o = {
          items: s,
          discountCode: v,
          discountAmount: C,
          savedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        localStorage.setItem(t, JSON.stringify(o));
      } catch (o) {
        console.warn("Failed to save cart to storage:", o);
      }
    }, g);
    return W(a), () => {
      a && clearTimeout(a);
    };
  }, [s, v, C, t, e, g, w]);
  const n = h((a, o = 1, P) => {
    T((l) => {
      const E = l.find((N) => N.id === a.id);
      if (E) {
        const N = Math.min(
          E.quantity + o,
          i
        );
        return l.map(
          ($) => $.id === a.id ? { ...$, quantity: N, notes: P || $.notes } : $
        );
      } else
        return l.length >= f ? (console.warn(`Cannot add more than ${f} different items to cart`), l) : [...l, { ...a, quantity: o, notes: P }];
    });
  }, [f, i]), m = h((a) => {
    T((o) => o.filter((P) => P.id !== a));
  }, []), R = h((a, o) => {
    if (o <= 0) {
      m(a);
      return;
    }
    T(
      (P) => P.map(
        (l) => l.id === a ? { ...l, quantity: Math.min(o, i) } : l
      )
    );
  }, [i, m]), J = h((a, o) => {
    T(
      (P) => P.map(
        (l) => l.id === a ? { ...l, notes: o } : l
      )
    );
  }, []), L = h(() => {
    T([]), k(null), A(0);
  }, []), H = h((a) => s.some((o) => o.id === a), [s]), G = h((a) => {
    const o = s.find((P) => P.id === a);
    return (o == null ? void 0 : o.quantity) || 0;
  }, [s]), B = h(async (a) => {
    try {
      const P = {
        SAVE10: 0.1,
        SAVE20: 0.2,
        WELCOME: 0.15
      }[a.toUpperCase()];
      return P ? (k(a), A(F.subtotal * P), !0) : !1;
    } catch (o) {
      return console.error("Failed to apply discount:", o), !1;
    }
  }, [F.subtotal]), d = h(() => {
    k(null), A(0);
  }, []), u = h(() => JSON.stringify({
    items: s,
    discountCode: v,
    exportedAt: (/* @__PURE__ */ new Date()).toISOString()
  }, null, 2), [s, v]), S = h((a) => {
    try {
      const o = JSON.parse(a);
      return Array.isArray(o.items) ? (T(o.items), o.discountCode && B(o.discountCode), !0) : !1;
    } catch (o) {
      return console.error("Failed to import cart:", o), !1;
    }
  }, [B]), x = V(
    () => ({
      items: s,
      summary: F,
      validation: z,
      isLoading: w,
      addToCart: n,
      removeFromCart: m,
      updateQuantity: R,
      updateNotes: J,
      clearCart: L,
      isInCart: H,
      getQuantity: G,
      applyDiscount: B,
      removeDiscount: d,
      validateCart: M,
      exportCart: u,
      importCart: S
    }),
    [
      s,
      F,
      z,
      w,
      n,
      m,
      R,
      J,
      L,
      H,
      G,
      B,
      d,
      M,
      u,
      S
    ]
  );
  return /* @__PURE__ */ _(et.Provider, { value: x, children: r });
}, rt = () => {
  const r = Y(et);
  if (!r)
    throw new Error("useCart must be used within a CartProvider");
  return r;
}, Tt = () => {
  const { summary: r } = rt();
  return r;
}, vt = () => {
  const { items: r } = rt();
  return r.length === 0;
};
class dt {
  constructor(t) {
    this.baseUrl = t.baseUrl.replace(/\/$/, ""), this.timeout = t.timeout || 1e4, this.defaultHeaders = {
      "Content-Type": "application/json",
      ...t.headers
    };
  }
  /**
   * Set authorization token
   */
  setAuthToken(t) {
    this.defaultHeaders.Authorization = `Bearer ${t}`;
  }
  /**
   * Remove authorization token
   */
  clearAuthToken() {
    delete this.defaultHeaders.Authorization;
  }
  /**
   * Generic request method
   */
  async request(t, e = {}) {
    const c = `${this.baseUrl}${t}`, f = {
      ...e,
      headers: {
        ...this.defaultHeaders,
        ...e.headers
      }
    }, i = new AbortController(), g = setTimeout(() => i.abort(), this.timeout);
    f.signal = i.signal;
    try {
      const p = await fetch(c, f);
      clearTimeout(g);
      let s;
      const T = p.headers.get("content-type");
      if (T != null && T.includes("application/json") ? s = await p.json() : s = await p.text(), !p.ok)
        throw new Error(
          (s == null ? void 0 : s.message) || `HTTP ${p.status}: ${p.statusText}`
        );
      return s && typeof s == "object" && "success" in s ? s : {
        success: !0,
        data: s,
        message: "Request successful"
      };
    } catch (p) {
      throw clearTimeout(g), p instanceof Error ? p.name === "AbortError" ? new Error("Request timeout") : p : new Error("Unknown error occurred");
    }
  }
  /**
   * GET request
   */
  async get(t, e) {
    let c = t;
    if (e) {
      const f = new URLSearchParams();
      Object.entries(e).forEach(([i, g]) => {
        g != null && f.append(i, String(g));
      }), f.toString() && (c += `?${f.toString()}`);
    }
    return this.request(c, { method: "GET" });
  }
  /**
   * POST request
   */
  async post(t, e) {
    return this.request(t, {
      method: "POST",
      body: e ? JSON.stringify(e) : void 0
    });
  }
  /**
   * PUT request
   */
  async put(t, e) {
    return this.request(t, {
      method: "PUT",
      body: e ? JSON.stringify(e) : void 0
    });
  }
  /**
   * PATCH request
   */
  async patch(t, e) {
    return this.request(t, {
      method: "PATCH",
      body: e ? JSON.stringify(e) : void 0
    });
  }
  /**
   * DELETE request
   */
  async delete(t) {
    return this.request(t, { method: "DELETE" });
  }
  /**
   * Upload file
   */
  async upload(t, e, c) {
    const f = new FormData();
    f.append("file", e), c && Object.entries(c).forEach(([g, p]) => {
      f.append(g, String(p));
    });
    const i = { ...this.defaultHeaders };
    return delete i["Content-Type"], this.request(t, {
      method: "POST",
      body: f,
      headers: i
    });
  }
}
var K;
const y = new dt({
  baseUrl: typeof process < "u" && ((K = process.env) == null ? void 0 : K.NEXT_PUBLIC_API_URL) || "http://localhost:5000"
});
class lt {
  constructor() {
    this.basePath = "/api/users", this.authPath = "/api/auth";
  }
  /**
   * Login user
   */
  async login(t) {
    var c;
    const e = await y.post(
      `${this.authPath}/login`,
      t
    );
    return e.success && ((c = e.data) != null && c.token) && y.setAuthToken(e.data.token), e;
  }
  /**
   * Register new user
   */
  async register(t) {
    var c;
    const e = await y.post(
      `${this.authPath}/register`,
      t
    );
    return e.success && ((c = e.data) != null && c.token) && y.setAuthToken(e.data.token), e;
  }
  /**
   * Logout user
   */
  async logout() {
    const t = await y.post(`${this.authPath}/logout`);
    return y.clearAuthToken(), t;
  }
  /**
   * Refresh authentication token
   */
  async refreshToken(t) {
    var c;
    const e = await y.post(
      `${this.authPath}/refresh`,
      { refreshToken: t }
    );
    return e.success && ((c = e.data) != null && c.token) && y.setAuthToken(e.data.token), e;
  }
  /**
   * Get current user profile
   */
  async getCurrentUser() {
    return y.get(`${this.authPath}/me`);
  }
  /**
   * Update current user profile
   */
  async updateProfile(t) {
    return y.put(`${this.authPath}/me`, t);
  }
  /**
   * Change password
   */
  async changePassword(t, e) {
    return y.post(`${this.authPath}/change-password`, {
      currentPassword: t,
      newPassword: e
    });
  }
  /**
   * Request password reset
   */
  async requestPasswordReset(t) {
    return y.post(`${this.authPath}/forgot-password`, { email: t });
  }
  /**
   * Reset password with token
   */
  async resetPassword(t, e) {
    return y.post(`${this.authPath}/reset-password`, {
      token: t,
      newPassword: e
    });
  }
  /**
   * Get all users (admin only)
   */
  async getUsers() {
    return y.get(this.basePath);
  }
  /**
   * Get user by ID (admin only)
   */
  async getUser(t) {
    return y.get(`${this.basePath}/${t}`);
  }
  /**
   * Create new user (admin only)
   */
  async createUser(t) {
    return y.post(this.basePath, t);
  }
  /**
   * Update user (admin only)
   */
  async updateUser(t, e) {
    return y.put(`${this.basePath}/${t}`, e);
  }
  /**
   * Delete user (admin only)
   */
  async deleteUser(t) {
    return y.delete(`${this.basePath}/${t}`);
  }
  /**
   * Get customers only
   */
  async getCustomers() {
    return y.get(`${this.basePath}/customers`);
  }
  /**
   * Get staff only
   */
  async getStaff() {
    return y.get(`${this.basePath}/staff`);
  }
}
const D = new lt();
class ht {
  /**
   * Login user with credentials
   */
  async login(t) {
    return D.login(t);
  }
  /**
   * Register a new user
   */
  async register(t) {
    return D.register(t);
  }
  /**
   * Logout the current user
   */
  async logout() {
    return D.logout();
  }
  /**
   * Refresh the authentication token
   */
  async refreshToken(t) {
    return D.refreshToken(t);
  }
  /**
   * Get the current authenticated user
   */
  async getCurrentUser() {
    return D.getCurrentUser();
  }
  /**
   * Update the current user's profile
   */
  async updateProfile(t) {
    return D.updateProfile(t);
  }
  /**
   * Change the current user's password
   */
  async changePassword(t, e) {
    return D.changePassword(t, e);
  }
  /**
   * Request a password reset
   */
  async requestPasswordReset(t) {
    return D.requestPasswordReset(t);
  }
  /**
   * Reset password using a reset token
   */
  async resetPassword(t, e) {
    return D.resetPassword(t, e);
  }
}
const O = new ht(), st = X(void 0), ft = {
  admin: [
    "users.read",
    "users.write",
    "users.delete",
    "products.read",
    "products.write",
    "products.delete",
    "orders.read",
    "orders.write",
    "orders.delete",
    "cash.read",
    "cash.write",
    "inventory.read",
    "inventory.write",
    "production.read",
    "production.write",
    "staff.read",
    "staff.write",
    "dashboard.read",
    "settings.read",
    "settings.write"
  ],
  manager: [
    "products.read",
    "products.write",
    "orders.read",
    "orders.write",
    "cash.read",
    "cash.write",
    "inventory.read",
    "inventory.write",
    "production.read",
    "production.write",
    "staff.read",
    "dashboard.read"
  ],
  staff: [
    "products.read",
    "orders.read",
    "orders.write",
    "cash.read",
    "cash.write",
    "inventory.read",
    "production.read",
    "production.write"
  ],
  customer: [
    "products.read",
    "orders.read"
  ]
}, wt = ({
  children: r,
  refreshInterval: t = 5 * 60 * 1e3,
  // 5 minutes
  checkAuthOnMount: e = !0,
  onAuthStateChange: c,
  permissionMapping: f = ft
}) => {
  const [i, g] = q(null), [p, s] = q(!0), [T, w] = q(null), U = I(null), v = I(!1), k = V(() => {
    if (!i || !i.role) return /* @__PURE__ */ new Set();
    const d = f[i.role] || [];
    return new Set(d);
  }, [i, f]), C = !!(i && y.isAuthenticated());
  j(() => {
    c == null || c(C, i);
  }, [C, i, c]);
  const A = h(() => {
    U.current && (clearTimeout(U.current), U.current = null);
  }, []), b = h(() => {
    A(), C && t > 0 && (U.current = setTimeout(async () => {
      if (!v.current) {
        v.current = !0;
        try {
          await O.refreshToken();
        } catch (d) {
          console.error("Token refresh failed:", d), await M();
        } finally {
          v.current = !1;
        }
      }
    }, t));
  }, [C, t, A]);
  j(() => {
    (async () => {
      if (!e) {
        s(!1);
        return;
      }
      try {
        if (y.isAuthenticated()) {
          const u = await O.getCurrentUser();
          g(u), b();
        }
      } catch (u) {
        console.error("Auth initialization failed:", u), y.clearTokens();
      } finally {
        s(!1);
      }
    })();
  }, [e, b]), j(() => () => {
    A();
  }, [A]);
  const W = h(async (d) => {
    w(null), s(!0);
    try {
      const u = await O.login(d);
      g(u.user), b();
    } catch (u) {
      const S = u.message || "Login failed. Please try again.";
      throw w(S), u;
    } finally {
      s(!1);
    }
  }, [b]), F = h(async (d) => {
    w(null), s(!0);
    try {
      const u = await O.register(d);
      g(u.user), b();
    } catch (u) {
      const S = u.message || "Registration failed. Please try again.";
      throw w(S), u;
    } finally {
      s(!1);
    }
  }, [b]), M = h(async () => {
    w(null), s(!0);
    try {
      await O.logout();
    } catch (d) {
      console.error("Logout error:", d);
    } finally {
      g(null), A(), s(!1);
    }
  }, [A]), z = h(async () => {
    if (!v.current) {
      w(null), v.current = !0;
      try {
        const d = await O.getCurrentUser();
        g(d), b();
      } catch (d) {
        const u = d.message || "Failed to refresh authentication.";
        throw w(u), d;
      } finally {
        v.current = !1;
      }
    }
  }, [b]), n = h(async (d) => {
    w(null);
    try {
      await O.changePassword(d);
    } catch (u) {
      const S = u.message || "Failed to change password.";
      throw w(S), u;
    }
  }, []), m = h(async (d) => {
    w(null);
    try {
      await O.requestPasswordReset(d);
    } catch (u) {
      const S = u.message || "Failed to request password reset.";
      throw w(S), u;
    }
  }, []), R = h(async (d, u) => {
    w(null);
    try {
      await O.resetPassword(d, u);
    } catch (S) {
      const x = S.message || "Failed to reset password.";
      throw w(x), S;
    }
  }, []), J = h(async (d) => {
    w(null);
    try {
      const u = await O.updateProfile(d);
      g(u);
    } catch (u) {
      const S = u.message || "Failed to update profile.";
      throw w(S), u;
    }
  }, []), L = h((d) => k.has(d), [k]), H = h((...d) => !i || !i.role ? !1 : d.includes(i.role), [i]), G = h(() => {
    w(null);
  }, []), B = V(
    () => ({
      user: i,
      isAuthenticated: C,
      isLoading: p,
      error: T,
      permissions: k,
      login: W,
      register: F,
      logout: M,
      refreshAuth: z,
      changePassword: n,
      requestPasswordReset: m,
      resetPassword: R,
      hasPermission: L,
      hasRole: H,
      updateProfile: J,
      clearError: G
    }),
    [
      i,
      C,
      p,
      T,
      k,
      W,
      F,
      M,
      z,
      n,
      m,
      R,
      L,
      H,
      J,
      G
    ]
  );
  return /* @__PURE__ */ _(st.Provider, { value: B, children: r });
}, Z = () => {
  const r = Y(st);
  if (!r)
    throw new Error("useAuth must be used within an AuthProvider");
  return r;
}, Ct = () => {
  const { user: r } = Z();
  return r;
}, St = () => {
  const { isAuthenticated: r } = Z();
  return r;
}, ot = () => {
  const r = Z();
  if (!r.isAuthenticated && !r.isLoading)
    throw new Error("Authentication required");
  return r;
}, At = (r) => {
  const t = ot();
  if (!t.hasPermission(r))
    throw new Error(`Permission denied: ${r}`);
  return t;
}, bt = (...r) => {
  const t = ot();
  if (!t.hasRole(...r))
    throw new Error(`Role required: ${r.join(" or ")}`);
  return t;
}, gt = ({
  children: r,
  theme: t,
  auth: e,
  cart: c
  // TODO: Re-enable after fixing dependencies
  // notification,
}) => /* @__PURE__ */ _(it, { ...t, children: /* @__PURE__ */ _(wt, { ...e, children: /* @__PURE__ */ _(ut, { ...c, children: r }) }) });
function kt(r, t) {
  const e = (c) => /* @__PURE__ */ _(gt, { ...t, children: /* @__PURE__ */ _(r, { ...c }) });
  return e.displayName = `withRootProvider(${r.displayName || r.name})`, e;
}
export {
  wt as AuthProvider,
  ut as CartProvider,
  gt as RootProvider,
  it as ThemeProvider,
  Z as useAuth,
  rt as useCart,
  Tt as useCartSummary,
  pt as useColorScheme,
  Ct as useCurrentUser,
  St as useIsAuthenticated,
  vt as useIsCartEmpty,
  Pt as useIsDarkMode,
  ot as useRequireAuth,
  At as useRequirePermission,
  bt as useRequireRole,
  tt as useTheme,
  kt as withRootProvider
};
