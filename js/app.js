// 歪嘴雞烘焙後台 PWA — Phase 1（假資料，純前端）
// 所有資料變更僅寫入 localStorage，不會送出任何網路請求

const APP_VERSION = '1.0.0';
const PIN_CODE = '123456'; // 展示用固定 PIN
const TOKEN_KEY = 'ykj_pwa_token';
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 分鐘短期 token

const root = document.getElementById('app-root');
const tabbarEl = document.getElementById('tabbar');

// ---------------- 簡易路由 ----------------
const TAB_ROUTES = ['dashboard', 'orders', 'products', 'more'];

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  return hash || (hasValidToken() ? 'dashboard' : 'login');
}

function navigate(path) {
  location.hash = '#/' + path;
}
window.navigate = navigate;

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => {
  if (!location.hash) {
    location.hash = hasValidToken() ? '#/dashboard' : '#/login';
  } else {
    render();
  }
});

// ---------------- Token / 登入 ----------------
function hasValidToken() {
  const raw = sessionStorage.getItem(TOKEN_KEY);
  if (!raw) return false;
  try {
    const { exp } = JSON.parse(raw);
    return Date.now() < exp;
  } catch (e) {
    return false;
  }
}
function setToken() {
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS }));
}
function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

// ---------------- 小工具 ----------------
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function fmtMoney(n) {
  return '$' + Number(n).toLocaleString('zh-TW');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 已訂購量一律從訂單明細加總，不用寫死的欄位，避免跟訂單列表對不上
function getProductOrderedQty(product) {
  return Store.state.orders
    .filter(o => o.orderStatus !== 'cancelled' && o.campaignId === product.campaignId)
    .flatMap(o => o.items)
    .filter(item => item.name === product.name)
    .reduce((sum, item) => sum + item.qty, 0);
}

function getCampaignOrderedQty(campaignId) {
  return Store.state.orders
    .filter(o => o.orderStatus !== 'cancelled' && o.campaignId === campaignId)
    .flatMap(o => o.items)
    .reduce((sum, item) => sum + item.qty, 0);
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = el(`<div class="toast">${escapeHtml(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

function showDialog({ title, body, confirmText = '確認', cancelText = '取消', danger = false, onConfirm, hideCancel = false }) {
  const overlay = el(`
    <div class="overlay centered">
      <div class="dialog">
        <div class="dialog-title">${escapeHtml(title)}</div>
        <div class="dialog-body">${body}</div>
        <div class="btn-row" style="margin-top:0">
          ${hideCancel ? '' : `<button class="btn btn-outline" data-act="cancel">${escapeHtml(cancelText)}</button>`}
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    </div>
  `);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector('[data-act="cancel"]')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-act="confirm"]').addEventListener('click', () => {
    overlay.remove();
    onConfirm && onConfirm();
  });
  document.body.appendChild(overlay);
}

// ---------------- Layout：頂部列 ----------------
function topbar({ title, back, action }) {
  return `
    <div class="topbar ${back ? '' : ''}">
      ${back ? `<button class="topbar-back" data-nav="${back}">‹</button>` : ''}
      <div class="topbar-title">${escapeHtml(title)}</div>
      ${action ? `<button class="topbar-action" data-act="${action.act}">${escapeHtml(action.label)}</button>` : ''}
    </div>
  `;
}

// ---------------- Tabbar ----------------
const TABS = [
  { key: 'dashboard', icon: '🏠', label: '首頁' },
  { key: 'orders', icon: '📦', label: '訂單' },
  { key: 'products', icon: '🥖', label: '商品' },
  { key: 'more', icon: '☰', label: '更多' }
];

function renderTabbar(activeKey) {
  tabbarEl.innerHTML = TABS.map(t => `
    <button class="tab-item ${t.key === activeKey ? 'active' : ''}" data-nav="${t.key}">
      <span class="tab-icon">${t.icon}</span>
      <span>${t.label}</span>
    </button>
  `).join('');
}

// ================== 主渲染 ==================
function render() {
  const route = currentRoute();
  const parts = route.split('/');
  const base = parts[0];

  if (base !== 'login' && !hasValidToken()) {
    location.hash = '#/login';
    return;
  }

  if (base === 'login') {
    tabbarEl.style.display = 'none';
    document.getElementById('app').style.paddingBottom = '0';
    renderLogin();
    return;
  }

  document.getElementById('app').style.paddingBottom = '';

  const isTopLevel = TAB_ROUTES.includes(route);
  tabbarEl.style.display = 'flex';
  renderTabbar(isTopLevel ? base : (['orders', 'products', 'more'].includes(base) ? base : 'dashboard'));

  switch (base) {
    case 'dashboard': return renderDashboard();
    case 'orders':
      return parts[1] ? renderOrderDetail(parts[1]) : renderOrdersList();
    case 'products':
      return parts[1] ? renderProductEdit(parts[1]) : renderProductsList();
    case 'more':
      if (!parts[1]) return renderMoreMenu();
      if (parts[1] === 'announcement') return renderAnnouncement();
      if (parts[1] === 'shop') return renderShop();
      if (parts[1] === 'toggle') return renderToggle();
      if (parts[1] === 'campaigns') return parts[2] ? renderCampaignEdit(parts[2]) : renderCampaignsList();
      return renderMoreMenu();
    default:
      return renderDashboard();
  }
}

// 事件委派：所有 data-nav / data-act 統一處理
document.addEventListener('click', (e) => {
  const navEl = e.target.closest('[data-nav]');
  if (navEl) {
    navigate(navEl.getAttribute('data-nav'));
  }
});

function setContent(html) {
  root.innerHTML = html;
}

// ================== PIN 登入 ==================
let pinBuffer = '';
let pinFailCount = 0;
let pinLockUntil = 0;
let pinLockTimer = null;

function renderLogin() {
  pinBuffer = '';
  const shop = Store.state.shop;
  setContent(`
    <div class="pin-screen">
      <div class="pin-logo">🍞</div>
      <div class="pin-shop-name">${escapeHtml(shop.name)}</div>
      <div class="pin-sub">老闆後台登入</div>
      <div class="pin-dots" id="pin-dots">
        ${[0,1,2,3,4,5].map(() => `<span class="pin-dot"></span>`).join('')}
      </div>
      <div class="pin-keypad" id="pin-keypad">
        ${['1','2','3','4','5','6','7','8','9','','0','⌫'].map(k => {
          if (k === '') return `<div class="pin-key empty"></div>`;
          const isFunc = k === '⌫';
          return `<button class="pin-key ${isFunc ? 'func' : ''}" data-key="${k}">${k}</button>`;
        }).join('')}
      </div>
      <div class="pin-lock-msg" id="pin-lock-msg"></div>
    </div>
    <div class="pin-version">v${APP_VERSION}（假資料展示版，PIN：123456）</div>
  `);

  updatePinLockUI();

  root.querySelectorAll('[data-key]').forEach(btn => {
    btn.addEventListener('click', () => handlePinKey(btn.getAttribute('data-key')));
  });
}

function updatePinLockUI() {
  const msg = document.getElementById('pin-lock-msg');
  const keypad = document.getElementById('pin-keypad');
  if (!msg || !keypad) return;
  const remain = Math.ceil((pinLockUntil - Date.now()) / 1000);
  if (remain > 0) {
    msg.textContent = `輸入錯誤次數過多，請於 ${remain} 秒後再試`;
    keypad.style.pointerEvents = 'none';
    keypad.style.opacity = '0.4';
    if (!pinLockTimer) {
      pinLockTimer = setInterval(() => {
        if (Date.now() >= pinLockUntil) {
          clearInterval(pinLockTimer);
          pinLockTimer = null;
          pinFailCount = 0;
          updatePinLockUI();
        } else {
          updatePinLockUI();
        }
      }, 1000);
    }
  } else {
    msg.textContent = '';
    keypad.style.pointerEvents = '';
    keypad.style.opacity = '';
  }
}

function handlePinKey(key) {
  if (Date.now() < pinLockUntil) return;
  if (key === '⌫') {
    pinBuffer = pinBuffer.slice(0, -1);
    renderPinDots();
    return;
  }
  if (pinBuffer.length >= 6) return;
  pinBuffer += key;
  renderPinDots();
  if (pinBuffer.length === 6) {
    setTimeout(checkPin, 120);
  }
}

function renderPinDots(errorState = false) {
  const dotsWrap = document.getElementById('pin-dots');
  if (!dotsWrap) return;
  const dots = dotsWrap.querySelectorAll('.pin-dot');
  dots.forEach((d, i) => {
    d.classList.toggle('filled', i < pinBuffer.length && !errorState);
    d.classList.toggle('error', errorState);
  });
}

function checkPin() {
  if (pinBuffer === PIN_CODE) {
    setToken();
    navigate('dashboard');
    return;
  }
  pinFailCount++;
  renderPinDots(true);
  const dotsWrap = document.getElementById('pin-dots');
  dotsWrap.classList.add('shake');
  if (navigator.vibrate) navigator.vibrate(200);
  setTimeout(() => {
    pinBuffer = '';
    dotsWrap.classList.remove('shake');
    renderPinDots(false);
    if (pinFailCount >= 5) {
      pinLockUntil = Date.now() + 60 * 1000;
      updatePinLockUI();
    }
  }, 400);
}

// ================== 🏠 今日 Dashboard ==================
function renderDashboard() {
  const s = Store.state;
  const activeCampaign = s.campaigns.find(c => c.status === 'active');
  const todayOrders = s.orders.filter(o => o.createdAt.startsWith('2026-08-10'));
  const pendingPayment = s.orders.filter(o => o.paymentStatus === 'pending' && o.orderStatus === 'active');
  const orderedPct = activeCampaign ? Math.min(100, Math.round(getCampaignOrderedQty(activeCampaign.id) / activeCampaign.cap * 100)) : 0;

  const todoItems = pendingPayment.slice(0, 5).map(o => `
    <button class="todo-item card-tap" style="width:100%;" data-nav="orders/${o.id}">
      <div class="todo-icon">💰</div>
      <div class="todo-main">
        <div class="todo-title">${escapeHtml(o.customerName)} · ${fmtMoney(o.total)}</div>
        <div class="todo-sub">${o.id} · 待確認付款</div>
      </div>
      <div class="todo-chevron">›</div>
    </button>
  `).join('');

  const prepProducts = (activeCampaign ? s.products.filter(p => p.campaignId === activeCampaign.id) : s.products.slice())
    .map(p => ({ ...p, orderedQty: getProductOrderedQty(p) }))
    .sort((a, b) => b.orderedQty - a.orderedQty);
  const prepRows = prepProducts.map(p => `
    <div class="prep-row">
      <div class="prep-name">${p.photo} ${escapeHtml(p.name)}</div>
      <div class="prep-count">${p.orderedQty}</div>
    </div>
  `).join('');

  setContent(`
    <div class="topbar">
      <div class="brand-row" style="margin-bottom:0;">
        <div class="brand-logo">🍞</div>
        <div>
          <div class="brand-name">${escapeHtml(s.shop.name)}</div>
          <div class="brand-status">
            <span class="status-dot ${s.preorderOpen ? '' : 'paused'}"></span>
            ${s.preorderOpen ? '預購開放中' : '預購已暫停'}
          </div>
        </div>
      </div>
    </div>
    <div class="page">
      <div class="section">
        <div class="section-title">今日摘要</div>
        <div class="summary-grid">
          <button class="summary-card card-tap" data-nav="orders">
            <div class="num">${todayOrders.length}</div>
            <div class="label">今日新訂單</div>
          </button>
          <button class="summary-card card-tap" data-nav="orders">
            <div class="num">${pendingPayment.length}</div>
            <div class="label">待確認付款</div>
          </button>
          <button class="summary-card card-tap" data-nav="more/campaigns">
            <div class="num">${orderedPct}%</div>
            <div class="label">已訂購量</div>
          </button>
        </div>
        ${activeCampaign ? `
          <div class="card" style="margin-top:10px;">
            <div class="order-line" style="margin-top:0;">
              <span>${escapeHtml(activeCampaign.name)}</span>
              <span>${getCampaignOrderedQty(activeCampaign.id)} / ${activeCampaign.cap}</span>
            </div>
            <div class="progress-bar"><div class="progress-bar-fill" style="width:${orderedPct}%"></div></div>
          </div>
        ` : ''}
      </div>

      <div class="section">
        <div class="section-title">待處理事項</div>
        <div class="card" style="padding:4px 16px;">
          ${todoItems || `<div class="empty-state" style="padding:24px 0;"><div class="icon">✅</div>目前沒有待處理事項</div>`}
        </div>
      </div>

      <div class="section">
        <div class="section-title">備料總覽（依已訂購量排序）</div>
        <div class="card" style="padding:4px 16px;">
          ${prepRows || `<div class="empty-state" style="padding:24px 0;"><div class="icon">🥯</div>目前檔期尚無商品</div>`}
        </div>
      </div>

      <div class="section">
        <div class="section-title">快捷功能</div>
        <div class="quick-grid">
          <button class="quick-btn" data-nav="more/announcement"><span class="icon">📢</span>編輯公告</button>
          <button class="quick-btn" data-nav="products"><span class="icon">🥖</span>商品管理</button>
          <button class="quick-btn" data-nav="more/campaigns"><span class="icon">📅</span>檔期設定</button>
          <button class="quick-btn" data-act="quick-toggle"><span class="icon">🔴</span>預購開關</button>
        </div>
      </div>
    </div>
  `);

  root.querySelector('[data-act="quick-toggle"]').addEventListener('click', () => {
    confirmTogglePreorder();
  });
}

function confirmTogglePreorder() {
  const s = Store.state;
  const willOpen = !s.preorderOpen;
  showDialog({
    title: willOpen ? '確定要開放預購嗎？' : '確定要暫停預購嗎？',
    body: willOpen ? '開放後，顧客即可在預購網站正常下單。' : '暫停後，顧客端將顯示暫停訊息，無法送出新訂單。',
    danger: !willOpen,
    onConfirm: () => {
      s.preorderOpen = willOpen;
      Store.save();
      showToast(willOpen ? '已開放預購' : '已暫停預購');
      render();
    }
  });
}

// ================== 📦 訂單列表 ==================
const ORDER_STATUS_LABEL = {
  active: '進行中', picked_up: '已取貨', cancelled: '已取消'
};
let orderFilter = { chip: 'all', search: '' };

function renderOrdersList() {
  const s = Store.state;
  const chips = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待確認付款' },
    { key: 'confirmed', label: '已確認' },
    { key: 'picked_up', label: '已取貨' },
    { key: 'cancelled', label: '已取消' }
  ];

  let list = s.orders.slice();
  if (orderFilter.chip === 'pending') list = list.filter(o => o.paymentStatus === 'pending' && o.orderStatus === 'active');
  else if (orderFilter.chip === 'confirmed') list = list.filter(o => o.paymentStatus === 'confirmed' && o.orderStatus === 'active');
  else if (orderFilter.chip === 'picked_up') list = list.filter(o => o.orderStatus === 'picked_up');
  else if (orderFilter.chip === 'cancelled') list = list.filter(o => o.orderStatus === 'cancelled');

  if (orderFilter.search.trim()) {
    const q = orderFilter.search.trim();
    list = list.filter(o => o.customerName.includes(q) || o.id.includes(q) || o.customerPhone.includes(q));
  }

  const cards = list.map(o => {
    const badge = o.orderStatus === 'cancelled' ? `<span class="badge badge-cancelled">已取消</span>`
      : o.orderStatus === 'picked_up' ? `<span class="badge badge-done">已取貨</span>`
      : o.paymentStatus === 'pending' ? `<span class="badge badge-pending">待確認付款</span>`
      : `<span class="badge badge-confirmed">已確認</span>`;
    const itemsSummary = o.items.map(i => `${i.name} x${i.qty}`).join('、');
    return `
      <button class="card card-tap" data-nav="orders/${o.id}">
        <div class="order-card-top">
          <div>
            <div class="order-id">${o.id}</div>
            <div class="order-customer">${escapeHtml(o.customerName)}</div>
          </div>
          ${badge}
        </div>
        <div class="order-line"><span>取貨時段</span><span>${escapeHtml(o.pickupSlot)}</span></div>
        <div class="order-line"><span>品項</span><span>${escapeHtml(itemsSummary)}</span></div>
        <div class="order-amount">${fmtMoney(o.total)}</div>
      </button>
    `;
  }).join('');

  setContent(`
    <div class="topbar"><div class="topbar-title">訂單列表</div></div>
    <div class="page">
      <input class="search-input" id="order-search" placeholder="搜尋訂單編號 / 姓名 / 電話" value="${escapeHtml(orderFilter.search)}" />
      <div class="chip-row">
        ${chips.map(c => `<button class="chip ${orderFilter.chip === c.key ? 'active' : ''}" data-chip="${c.key}">${c.label}</button>`).join('')}
      </div>
      ${cards || `<div class="empty-state"><div class="icon">📭</div>沒有符合條件的訂單</div>`}
    </div>
  `);

  root.querySelectorAll('[data-chip]').forEach(btn => {
    btn.addEventListener('click', () => {
      orderFilter.chip = btn.getAttribute('data-chip');
      renderOrdersList();
    });
  });
  const searchInput = root.querySelector('#order-search');
  searchInput.addEventListener('input', () => {
    orderFilter.search = searchInput.value;
    renderOrdersList();
    root.querySelector('#order-search').focus();
    const val = root.querySelector('#order-search').value;
    root.querySelector('#order-search').setSelectionRange(val.length, val.length);
  });
}

function renderOrderDetail(id) {
  const s = Store.state;
  const o = s.orders.find(x => x.id === id);
  if (!o) { navigate('orders'); return; }

  const badge = o.orderStatus === 'cancelled' ? `<span class="badge badge-cancelled">已取消</span>`
    : o.orderStatus === 'picked_up' ? `<span class="badge badge-done">已取貨</span>`
    : o.paymentStatus === 'pending' ? `<span class="badge badge-pending">待確認付款</span>`
    : `<span class="badge badge-confirmed">已確認</span>`;

  const itemsHtml = o.items.map(i => `
    <div class="order-line" style="font-size:14px; color:var(--color-text);">
      <span>${escapeHtml(i.name)} x${i.qty}</span>
      <span>${fmtMoney(i.price * i.qty)}</span>
    </div>
  `).join('');

  const canConfirmPayment = o.paymentStatus === 'pending' && o.orderStatus === 'active';
  const canMarkPickedUp = o.orderStatus === 'active' && o.paymentStatus === 'confirmed';
  const canCancel = o.orderStatus === 'active';

  setContent(`
    ${topbar({ title: '訂單詳情', back: 'orders' })}
    <div class="page">
      <div class="card">
        <div class="order-card-top">
          <div>
            <div class="order-id">${o.id}</div>
            <div class="order-customer">${escapeHtml(o.customerName)}</div>
          </div>
          ${badge}
        </div>
        <div class="order-line"><span>電話</span><span>${escapeHtml(o.customerPhone)}</span></div>
        <div class="order-line"><span>取貨時段</span><span>${escapeHtml(o.pickupSlot)}</span></div>
        <div class="order-line"><span>建立時間</span><span>${escapeHtml(o.createdAt)}</span></div>
      </div>

      <div class="card">
        <div class="section-title" style="margin-bottom:10px;">品項明細</div>
        ${itemsHtml}
        <div class="order-amount">總計 ${fmtMoney(o.total)}</div>
      </div>

      ${o.note ? `
        <div class="card">
          <div class="section-title" style="margin-bottom:6px;">備註</div>
          <div style="font-size:14px;">${escapeHtml(o.note)}</div>
        </div>
      ` : ''}

      <div class="section" style="margin-top:20px;">
        ${canConfirmPayment ? `<button class="btn btn-primary" data-act="confirm-payment" style="margin-bottom:10px;">✅ 確認付款</button>` : ''}
        ${canMarkPickedUp ? `<button class="btn btn-outline" data-act="mark-pickedup" style="margin-bottom:10px;">📦 標記已取貨</button>` : ''}
        ${canCancel ? `<button class="btn btn-danger" data-act="cancel-order">取消訂單</button>` : ''}
      </div>
      <div class="field-hint" style="text-align:left; margin-top:4px;">如需修改品項，請客戶取消後重新下單。</div>
    </div>
  `);

  root.querySelector('[data-act="confirm-payment"]')?.addEventListener('click', () => {
    showDialog({
      title: '確認已收到付款？',
      body: `訂單 ${o.id}，金額 ${fmtMoney(o.total)}`,
      confirmText: '確認付款',
      onConfirm: () => {
        o.paymentStatus = 'confirmed';
        Store.save();
        showToast('已確認付款');
        renderOrderDetail(id);
      }
    });
  });
  root.querySelector('[data-act="mark-pickedup"]')?.addEventListener('click', () => {
    o.orderStatus = 'picked_up';
    Store.save();
    showToast('已標記為已取貨');
    renderOrderDetail(id);
  });
  root.querySelector('[data-act="cancel-order"]')?.addEventListener('click', () => {
    showDialog({
      title: '確定要取消此訂單？',
      body: '取消後將無法復原，若客戶要重新訂購請請他重新送出訂單。',
      danger: true,
      confirmText: '取消訂單',
      onConfirm: () => {
        o.orderStatus = 'cancelled';
        Store.save();
        showToast('訂單已取消');
        renderOrderDetail(id);
      }
    });
  });
}

// ================== 🥖 商品管理 ==================
let productFilterCampaign = 'all';

function renderProductsList() {
  const s = Store.state;
  const chips = [{ id: 'all', name: '全部檔期' }, ...s.campaigns];

  let list = s.products.slice();
  if (productFilterCampaign !== 'all') list = list.filter(p => p.campaignId === productFilterCampaign);

  const cards = list.map(p => `
    <div class="card">
      <div class="product-card">
        <button class="card-tap" data-nav="products/${p.id}" style="display:flex; gap:12px; flex:1; min-width:0; align-items:center;">
          <div class="product-thumb">${p.photo}</div>
          <div class="product-main">
            <div class="product-name">${escapeHtml(p.name)}</div>
            <div class="product-meta">${fmtMoney(p.price)} · 限購 ${p.maxPerOrder} 個</div>
            <div class="product-ordered">已訂購 ${getProductOrderedQty(p)}</div>
          </div>
        </button>
        <div class="product-side">
          <div class="switch ${p.active ? 'on' : ''}" data-toggle-active="${p.id}"></div>
        </div>
      </div>
    </div>
  `).join('');

  setContent(`
    <div class="topbar">
      <div class="topbar-title">商品管理</div>
      <button class="topbar-action" data-nav="products/new">+ 新增</button>
    </div>
    <div class="page">
      <div class="chip-row">
        ${chips.map(c => `<button class="chip ${productFilterCampaign === c.id ? 'active' : ''}" data-chip="${c.id}">${escapeHtml(c.name)}</button>`).join('')}
      </div>
      ${cards || `<div class="empty-state"><div class="icon">🥯</div>此檔期尚無商品</div>`}
    </div>
  `);

  root.querySelectorAll('[data-chip]').forEach(btn => {
    btn.addEventListener('click', () => {
      productFilterCampaign = btn.getAttribute('data-chip');
      renderProductsList();
    });
  });
  root.querySelectorAll('[data-toggle-active]').forEach(sw => {
    sw.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = sw.getAttribute('data-toggle-active');
      const p = s.products.find(x => x.id === id);
      p.active = !p.active;
      Store.save();
      showToast(p.active ? `${p.name} 已上架` : `${p.name} 已下架`);
      renderProductsList();
    });
  });
}

function renderProductEdit(id) {
  const s = Store.state;
  const isNew = id === 'new';
  const p = isNew ? { id: null, name: '', desc: '', price: '', maxPerOrder: '', campaignId: s.campaigns[0]?.id, active: true, photo: '🥖' } : s.products.find(x => x.id === id);
  if (!p) { navigate('products'); return; }

  setContent(`
    ${topbar({ title: isNew ? '新增商品' : '編輯商品', back: 'products' })}
    <div class="page">
      <div class="field">
        <div class="photo-upload">
          <div class="icon">${p.photo || '📷'}</div>
          <div>點擊上傳商品照片（展示版不可上傳）</div>
        </div>
      </div>
      <div class="field">
        <label class="field-label">商品名稱</label>
        <input class="field-input" id="f-name" value="${escapeHtml(p.name)}" placeholder="例：原味貝果" />
      </div>
      <div class="field">
        <label class="field-label">描述</label>
        <textarea class="field-textarea" id="f-desc" placeholder="簡短介紹商品特色">${escapeHtml(p.desc)}</textarea>
      </div>
      <div class="field">
        <label class="field-label">價格</label>
        <input class="field-input" id="f-price" type="number" inputmode="numeric" value="${p.price}" placeholder="0" />
      </div>
      <div class="field">
        <label class="field-label">單筆訂單限購數量</label>
        <input class="field-input" id="f-max" type="number" inputmode="numeric" value="${p.maxPerOrder}" placeholder="0" />
      </div>
      <div class="field">
        <label class="field-label">所屬檔期</label>
        <select class="field-select" id="f-campaign">
          ${s.campaigns.map(c => `<option value="${c.id}" ${c.id === p.campaignId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <div class="field-row">
          <label class="field-label" style="margin-bottom:0;">上架狀態</label>
          <div class="switch ${p.active ? 'on' : ''}" id="f-active"></div>
        </div>
      </div>

      <div class="sticky-footer">
        <button class="btn btn-primary" id="btn-save">儲存</button>
        ${!isNew ? `<button class="btn btn-danger" id="btn-delete" style="margin-top:10px;">刪除商品</button>` : ''}
      </div>
    </div>
  `);

  let activeVal = p.active;
  root.querySelector('#f-active').addEventListener('click', () => {
    activeVal = !activeVal;
    root.querySelector('#f-active').classList.toggle('on', activeVal);
  });

  root.querySelector('#btn-save').addEventListener('click', () => {
    const name = root.querySelector('#f-name').value.trim();
    if (!name) { showToast('請輸入商品名稱'); return; }
    const data = {
      name,
      desc: root.querySelector('#f-desc').value.trim(),
      price: Number(root.querySelector('#f-price').value) || 0,
      maxPerOrder: Number(root.querySelector('#f-max').value) || 0,
      campaignId: root.querySelector('#f-campaign').value,
      active: activeVal
    };
    if (isNew) {
      const newId = 'P' + String(Date.now()).slice(-6);
      s.products.push({ id: newId, photo: '🥖', ...data });
    } else {
      Object.assign(p, data);
    }
    Store.save();
    showToast('已儲存');
    navigate('products');
  });

  root.querySelector('#btn-delete')?.addEventListener('click', () => {
    showDialog({
      title: '確定要刪除此商品？',
      body: `「${escapeHtml(p.name)}」刪除後無法復原。`,
      danger: true,
      confirmText: '刪除',
      onConfirm: () => {
        s.products = s.products.filter(x => x.id !== p.id);
        Store.save();
        showToast('已刪除商品');
        navigate('products');
      }
    });
  });
}

// ================== ☰ 更多選單 ==================
function renderMoreMenu() {
  const items = [
    { icon: '📢', label: '公告設定', nav: 'more/announcement' },
    { icon: '📅', label: '預購檔期設定', nav: 'more/campaigns' },
    { icon: '🏪', label: '店家資料', nav: 'more/shop' },
    { icon: '🔴', label: '預購開關', nav: 'more/toggle' }
  ];
  setContent(`
    <div class="topbar"><div class="topbar-title">更多</div></div>
    <div class="page">
      <div class="card menu-list" style="padding:4px 12px;">
        ${items.map(i => `
          <button class="menu-item" data-nav="${i.nav}">
            <div class="icon">${i.icon}</div>
            <div class="title">${i.label}</div>
            <div class="chevron">›</div>
          </button>
        `).join('')}
      </div>
      <div class="card menu-list" style="padding:4px 12px; margin-top:16px;">
        <button class="menu-item" data-act="logout">
          <div class="icon">🚪</div>
          <div class="title">登出</div>
          <div class="chevron">›</div>
        </button>
      </div>
      <div class="field-hint" style="text-align:center; margin-top:16px;">Phase 1 假資料展示版 · v${APP_VERSION}</div>
    </div>
  `);
  root.querySelector('[data-act="logout"]').addEventListener('click', () => {
    showDialog({
      title: '確定要登出嗎？',
      body: '登出後需要重新輸入 PIN 碼才能進入後台。',
      confirmText: '登出',
      danger: true,
      onConfirm: () => {
        clearToken();
        navigate('login');
      }
    });
  });
}

// ================== 📢 公告設定 ==================
function renderAnnouncement() {
  const s = Store.state;
  const MAX_LEN = 200;

  function paint() {
    const text = root.querySelector('#f-text').value;
    root.querySelector('#char-count').textContent = `${text.length} / ${MAX_LEN}`;
    root.querySelector('#preview').textContent = text || '（尚未輸入公告內容）';
  }

  setContent(`
    ${topbar({ title: '公告設定', back: 'more' })}
    <div class="page">
      <div class="field">
        <div class="field-row">
          <label class="field-label" style="margin-bottom:0;">顯示於顧客端</label>
          <div class="switch ${s.announcement.visible ? 'on' : ''}" id="f-visible"></div>
        </div>
      </div>
      <div class="field">
        <label class="field-label">公告內容</label>
        <textarea class="field-textarea" id="f-text" maxlength="${MAX_LEN}" style="min-height:140px;">${escapeHtml(s.announcement.text)}</textarea>
        <div class="field-hint" id="char-count">0 / ${MAX_LEN}</div>
      </div>
      <div class="field">
        <div class="preview-label">顧客端預覽</div>
        <div class="preview-box" id="preview"></div>
      </div>
      <div class="sticky-footer">
        <button class="btn btn-primary" id="btn-save">儲存</button>
      </div>
    </div>
  `);

  let visibleVal = s.announcement.visible;
  root.querySelector('#f-visible').addEventListener('click', () => {
    visibleVal = !visibleVal;
    root.querySelector('#f-visible').classList.toggle('on', visibleVal);
  });
  root.querySelector('#f-text').addEventListener('input', paint);
  paint();

  root.querySelector('#btn-save').addEventListener('click', () => {
    s.announcement.text = root.querySelector('#f-text').value;
    s.announcement.visible = visibleVal;
    Store.save();
    showToast('公告已儲存');
  });
}

// ================== 📅 預購檔期設定 ==================
const CAMPAIGN_STATUS_LABEL = { active: '進行中', upcoming: '即將開始', ended: '已結束' };
const CAMPAIGN_STATUS_BADGE = { active: 'badge-active', upcoming: 'badge-upcoming', ended: 'badge-ended' };

function renderCampaignsList() {
  const s = Store.state;
  const cards = s.campaigns.map(c => {
    const ordered = getCampaignOrderedQty(c.id);
    const pct = Math.min(100, Math.round((ordered / c.cap) * 100));
    return `
      <button class="card card-tap" data-nav="more/campaigns/${c.id}">
        <div class="order-card-top">
          <div class="order-customer">${escapeHtml(c.name)}</div>
          <span class="badge ${CAMPAIGN_STATUS_BADGE[c.status]}">${CAMPAIGN_STATUS_LABEL[c.status]}</span>
        </div>
        <div class="order-line"><span>預購期間</span><span>${c.start} ~ ${c.end}</span></div>
        <div class="order-line"><span>取貨日</span><span>${c.pickupSlots.map(p => p.date).join('、')}</span></div>
        <div class="order-line"><span>已訂購量</span><span>${ordered} / ${c.cap}</span></div>
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      </button>
    `;
  }).join('');

  setContent(`
    <div class="topbar">
      <button class="topbar-back" data-nav="more">‹</button>
      <div class="topbar-title">預購檔期設定</div>
      <button class="topbar-action" data-nav="more/campaigns/new">+ 新增</button>
    </div>
    <div class="page">${cards}</div>
  `);
}

function renderCampaignEdit(id) {
  const s = Store.state;
  const isNew = id === 'new';
  const c = isNew ? { id: null, name: '', start: '', end: '', pickupSlots: [], cap: '', status: 'upcoming' } : s.campaigns.find(x => x.id === id);
  if (!c) { navigate('more/campaigns'); return; }

  const hasOrders = !isNew && s.orders.some(o => o.campaignId === c.id);
  let slots = c.pickupSlots.map(s => ({ ...s }));

  function renderSlots() {
    const wrap = root.querySelector('#slots-wrap');
    wrap.innerHTML = slots.map((slot, idx) => `
      <div class="slot-row">
        <input class="field-input" type="date" value="${slot.date}" data-slot-date="${idx}" style="flex:1;" />
        <input class="field-input" value="${escapeHtml(slot.time)}" placeholder="14:00-18:00" data-slot-time="${idx}" style="flex:1;" />
        <div class="slot-remove" data-slot-remove="${idx}">✕</div>
      </div>
    `).join('');
    wrap.querySelectorAll('[data-slot-date]').forEach(inp => {
      inp.addEventListener('change', () => { slots[+inp.getAttribute('data-slot-date')].date = inp.value; });
    });
    wrap.querySelectorAll('[data-slot-time]').forEach(inp => {
      inp.addEventListener('input', () => { slots[+inp.getAttribute('data-slot-time')].time = inp.value; });
    });
    wrap.querySelectorAll('[data-slot-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        slots.splice(+btn.getAttribute('data-slot-remove'), 1);
        renderSlots();
      });
    });
  }

  setContent(`
    ${topbar({ title: isNew ? '新增檔期' : '編輯檔期', back: 'more/campaigns' })}
    <div class="page">
      <div class="field">
        <label class="field-label">檔期名稱</label>
        <input class="field-input" id="f-name" value="${escapeHtml(c.name)}" placeholder="例：8月第3週檔期" />
      </div>
      <div class="field">
        <label class="field-label">預購起訖日</label>
        <div style="display:flex; gap:10px;">
          <input class="field-input" type="date" id="f-start" value="${c.start}" />
          <input class="field-input" type="date" id="f-end" value="${c.end}" />
        </div>
      </div>
      <div class="field">
        <label class="field-label">取貨日期／時段</label>
        <div id="slots-wrap"></div>
        <button class="add-slot-btn" id="btn-add-slot">+ 新增取貨時段</button>
      </div>
      <div class="field">
        <label class="field-label">總量上限</label>
        <input class="field-input" id="f-cap" type="number" inputmode="numeric" value="${c.cap}" placeholder="0" />
      </div>
      <div class="field">
        <label class="field-label">檔期狀態</label>
        <select class="field-select" id="f-status">
          <option value="upcoming" ${c.status === 'upcoming' ? 'selected' : ''}>即將開始</option>
          <option value="active" ${c.status === 'active' ? 'selected' : ''}>進行中</option>
          <option value="ended" ${c.status === 'ended' ? 'selected' : ''}>已結束</option>
        </select>
      </div>

      <div class="sticky-footer">
        <button class="btn btn-primary" id="btn-save">儲存</button>
        ${!isNew ? (hasOrders
          ? `<button class="btn btn-outline" id="btn-end" style="margin-top:10px;">結束檔期</button>`
          : `<button class="btn btn-danger" id="btn-delete" style="margin-top:10px;">刪除檔期</button>`) : ''}
      </div>
      ${hasOrders ? `<div class="field-hint" style="text-align:left;">此檔期已有訂單，無法刪除，僅能結束檔期</div>` : ''}
    </div>
  `);

  renderSlots();
  root.querySelector('#btn-add-slot').addEventListener('click', () => {
    slots.push({ id: 'S' + Date.now(), date: '', time: '' });
    renderSlots();
  });

  root.querySelector('#btn-save').addEventListener('click', () => {
    const name = root.querySelector('#f-name').value.trim();
    if (!name) { showToast('請輸入檔期名稱'); return; }
    const data = {
      name,
      start: root.querySelector('#f-start').value,
      end: root.querySelector('#f-end').value,
      pickupSlots: slots,
      cap: Number(root.querySelector('#f-cap').value) || 0,
      status: root.querySelector('#f-status').value
    };
    if (isNew) {
      const newId = 'C' + String(Date.now()).slice(-6);
      s.campaigns.push({ id: newId, ...data });
    } else {
      Object.assign(c, data);
    }
    Store.save();
    showToast('已儲存');
    navigate('more/campaigns');
  });

  root.querySelector('#btn-delete')?.addEventListener('click', () => {
    showDialog({
      title: '確定要刪除此檔期？',
      body: `「${escapeHtml(c.name)}」刪除後無法復原。`,
      danger: true,
      confirmText: '刪除',
      onConfirm: () => {
        s.campaigns = s.campaigns.filter(x => x.id !== c.id);
        Store.save();
        showToast('已刪除檔期');
        navigate('more/campaigns');
      }
    });
  });

  root.querySelector('#btn-end')?.addEventListener('click', () => {
    showDialog({
      title: '確定要結束此檔期？',
      body: '結束後顧客端將無法再看到此檔期的商品。',
      confirmText: '結束檔期',
      onConfirm: () => {
        c.status = 'ended';
        Store.save();
        showToast('已結束檔期');
        navigate('more/campaigns');
      }
    });
  });
}

// ================== 🏪 店家資料 ==================
function renderShop() {
  const s = Store.state;
  setContent(`
    ${topbar({ title: '店家資料', back: 'more' })}
    <div class="page">
      <div class="section">
        <div class="section-title">基本資訊</div>
        <div class="field">
          <label class="field-label">店名</label>
          <input class="field-input" id="f-shopname" value="${escapeHtml(s.shop.name)}" />
        </div>
        <div class="field">
          <div class="photo-upload">
            <div class="icon">🖼️</div>
            <div>點擊上傳 Logo（展示版不可上傳）</div>
          </div>
        </div>
        <div class="field">
          <label class="field-label">簡介</label>
          <textarea class="field-textarea" id="f-intro" style="min-height:80px;">${escapeHtml(s.shop.intro)}</textarea>
        </div>
      </div>

      <div class="section">
        <div class="section-title">聯絡資訊</div>
        <div class="field">
          <label class="field-label">LINE 官方帳號</label>
          <input class="field-input" id="f-line" value="${escapeHtml(s.shop.line)}" />
        </div>
        <div class="field">
          <label class="field-label">電話</label>
          <input class="field-input" id="f-phone" value="${escapeHtml(s.shop.phone)}" />
        </div>
        <div class="field">
          <label class="field-label">地址</label>
          <input class="field-input" id="f-address" value="${escapeHtml(s.shop.address)}" />
        </div>
      </div>

      <div class="section">
        <div class="section-title">匯款資訊</div>
        <div class="field">
          <label class="field-label">銀行</label>
          <input class="field-input" id="f-bank" value="${escapeHtml(s.shop.bank)}" />
        </div>
        <div class="field">
          <label class="field-label">帳號</label>
          <input class="field-input" id="f-bankaccount" value="${escapeHtml(s.shop.bankAccount)}" />
        </div>
        <div class="field">
          <label class="field-label">戶名</label>
          <input class="field-input" id="f-bankowner" value="${escapeHtml(s.shop.bankOwner)}" />
        </div>
      </div>

      <div class="sticky-footer">
        <button class="btn btn-primary" id="btn-save">儲存</button>
      </div>
    </div>
  `);

  root.querySelector('#btn-save').addEventListener('click', () => {
    Object.assign(s.shop, {
      name: root.querySelector('#f-shopname').value.trim(),
      intro: root.querySelector('#f-intro').value.trim(),
      line: root.querySelector('#f-line').value.trim(),
      phone: root.querySelector('#f-phone').value.trim(),
      address: root.querySelector('#f-address').value.trim(),
      bank: root.querySelector('#f-bank').value.trim(),
      bankAccount: root.querySelector('#f-bankaccount').value.trim(),
      bankOwner: root.querySelector('#f-bankowner').value.trim()
    });
    Store.save();
    showToast('店家資料已儲存');
  });
}

// ================== 🔴 預購開關 ==================
function renderToggle() {
  const s = Store.state;
  setContent(`
    ${topbar({ title: '預購開關', back: 'more' })}
    <div class="page">
      <div class="card toggle-hero">
        <div class="state-icon">${s.preorderOpen ? '🟢' : '🔴'}</div>
        <div class="state-title">${s.preorderOpen ? '預購開放中' : '預購已暫停'}</div>
        <div class="state-sub">${s.preorderOpen ? '顧客可正常瀏覽並下單' : '顧客端將顯示暫停訊息，無法送出訂單'}</div>
        <div class="switch-wrap">
          <div class="switch big ${s.preorderOpen ? 'on' : ''}" id="f-toggle"></div>
        </div>
      </div>

      <div class="section" style="margin-top:20px;">
        <div class="section-title">暫停時顧客端顯示訊息</div>
        <div class="field">
          <textarea class="field-textarea" id="f-pausemsg" style="min-height:90px;">${escapeHtml(s.pauseMessage)}</textarea>
        </div>
        <button class="btn btn-outline" id="btn-save-msg">儲存暫停訊息</button>
      </div>
    </div>
  `);

  root.querySelector('#f-toggle').addEventListener('click', () => {
    confirmTogglePreorder();
  });
  root.querySelector('#btn-save-msg').addEventListener('click', () => {
    s.pauseMessage = root.querySelector('#f-pausemsg').value;
    Store.save();
    showToast('暫停訊息已儲存');
  });
}

// ================== Service Worker 更新提示 ==================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(newWorker);
          }
        });
      });
    }).catch(() => {});
  });
}

function showUpdateBanner(newWorker) {
  if (document.querySelector('.update-banner')) return;
  const banner = el(`
    <div class="update-banner">
      <span>有新版本可以更新</span>
      <button>立即更新</button>
    </div>
  `);
  banner.querySelector('button').addEventListener('click', () => {
    newWorker.postMessage({ type: 'SKIP_WAITING' });
    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'activated') location.reload();
    });
  });
  document.body.appendChild(banner);
}
