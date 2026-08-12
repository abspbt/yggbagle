// 這份檔案是給「直接在 Cloudflare Dashboard 網頁編輯器貼上」用的整合版本，
// 把 src/index.js、src/googleAuth.js、src/sheets.js 三個檔案的內容合併成一份。
// 開發時請改 src/ 底下的檔案；這份檔案只在改動後手動同步、貼到 Dashboard。

// ---- 以下對應 src/googleAuth.js ----

function base64url(input) {
  let bytes;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signJWT(serviceAccount, scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claimSet))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );

  return `${unsigned}.${base64url(signature)}`;
}

async function getAccessToken(serviceAccount, scope = "https://www.googleapis.com/auth/spreadsheets") {
  const jwt = await signJWT(serviceAccount, scope);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`向 Google 換 access token 失敗 (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

// ---- 以下對應 src/sheets.js ----

async function getValues(accessToken, spreadsheetId, range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`讀取 Google Sheets 失敗 (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.values || [];
}

// 讀一整張表，用第一列當欄位名稱，把每一列轉成物件。
// 傳整個分頁名稱當 range（例如 "Products"）就會讀到該分頁所有已使用的儲存格。
async function getSheetRows(accessToken, spreadsheetId, sheetName) {
  const values = await getValues(accessToken, spreadsheetId, sheetName);
  if (values.length === 0) return [];

  const [header, ...rows] = values;
  return rows
    .filter((row) => row.some((cell) => cell !== "" && cell !== undefined))
    .map((row) => {
      const obj = {};
      header.forEach((key, i) => {
        obj[key] = row[i] !== undefined ? row[i] : "";
      });
      return obj;
    });
}

// 把資料列附加到某張表的最後面。rows 是二維陣列，每個內層陣列的欄位順序
// 要跟該分頁的欄位標題列一致（呼叫端負責對齊順序，這裡不做欄位名稱轉換）。
async function appendRows(accessToken, spreadsheetId, sheetName, rows) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    sheetName
  )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: rows }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`寫入 Google Sheets 失敗 (${res.status}): ${text}`);
  }

  return res.json();
}

// ---- 以下對應 src/index.js ----

// 顧客網站（Phase 4）跟老闆 PWA（Phase 6）會從不同網域打這個 Worker，開放 CORS。
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init.headers || {}) },
  });
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Products.active 是 Google Sheets 的核取方塊欄位，讀回來可能是布林值或字串，兩種都接受。
function isActive(value) {
  return value === true || value === "TRUE";
}

async function getAuthedContext(env) {
  const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const accessToken = await getAccessToken(serviceAccount);
  return { accessToken, spreadsheetId: env.SPREADSHEET_ID };
}

// 台北時區的日期（給訂單編號用）跟 ISO 格式時間（給 created_at 用）。
function nowInTaipei() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));

  return {
    dateCompact: `${parts.year}${parts.month}${parts.day}`,
    isoLocal: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`,
  };
}

// 訂單編號格式 ORD-YYYYMMDD-XXXX，同一天內流水號遞增。
// 這裡是簡單的「讀了再寫」，跟 Phase 5 的總量控制一樣不做原子鎖：
// 極端情況下（幾乎同時送出兩張訂單）可能撞號重試，機率很低，先接受這個風險。
function generateOrderId(existingOrders, dateCompact) {
  const prefix = `ORD-${dateCompact}-`;
  let maxSeq = 0;

  for (const order of existingOrders) {
    if (typeof order.order_id === "string" && order.order_id.startsWith(prefix)) {
      const seq = parseInt(order.order_id.slice(prefix.length), 10);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }
  }

  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

// POST /orders：顧客下單，商品單價一律以 Sheets 上的 Products 資料為準，不採信前端傳來的價格。
// 這裡只驗證「檔期是否開放、時段是否屬於這個檔期、單一商品是否超過 max_per_order」，
// 檔期/時段的總量上限檢查留給 Phase 5 處理。
async function handleCreateOrder(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "請求格式錯誤，需要 JSON" }, { status: 400 });
  }

  const { campaign_id, customer_name, customer_phone, pickup_slot_id, note, items } = body || {};

  if (!campaign_id || !customer_name || !customer_phone || !pickup_slot_id) {
    return json(
      { ok: false, error: "缺少必要欄位（campaign_id、customer_name、customer_phone、pickup_slot_id）" },
      { status: 400 }
    );
  }
  if (!Array.isArray(items) || items.length === 0) {
    return json({ ok: false, error: "訂單至少要有一項商品" }, { status: 400 });
  }

  const { accessToken, spreadsheetId } = await getAuthedContext(env);

  const [campaigns, slots, products, existingOrders] = await Promise.all([
    getSheetRows(accessToken, spreadsheetId, "Campaigns"),
    getSheetRows(accessToken, spreadsheetId, "PickupSlots"),
    getSheetRows(accessToken, spreadsheetId, "Products"),
    getSheetRows(accessToken, spreadsheetId, "Orders"),
  ]);

  const campaign = campaigns.find((c) => c.campaign_id === campaign_id);
  if (!campaign || campaign.status !== "active") {
    return json({ ok: false, error: "此檔期目前未開放預購" }, { status: 400 });
  }

  const slot = slots.find((s) => s.slot_id === pickup_slot_id && s.campaign_id === campaign_id);
  if (!slot) {
    return json({ ok: false, error: "取貨時段不存在，或不屬於這個檔期" }, { status: 400 });
  }

  const productsById = new Map(products.map((p) => [p.product_id, p]));
  const orderItems = [];

  for (const rawItem of items) {
    const product = productsById.get(rawItem && rawItem.product_id);
    if (!product || product.campaign_id !== campaign_id || !isActive(product.active)) {
      return json({ ok: false, error: `商品不存在或已下架：${rawItem && rawItem.product_id}` }, { status: 400 });
    }

    const quantity = toNumber(rawItem.quantity);
    if (quantity <= 0) {
      return json({ ok: false, error: `${product.name} 的數量必須大於 0` }, { status: 400 });
    }

    const maxPerOrder = toNumber(product.max_per_order);
    if (maxPerOrder > 0 && quantity > maxPerOrder) {
      return json({ ok: false, error: `${product.name} 每筆訂單最多只能訂 ${maxPerOrder} 個` }, { status: 400 });
    }

    const unitPrice = toNumber(product.price);
    orderItems.push({
      product_id: product.product_id,
      product_name_snapshot: product.name,
      unit_price: unitPrice,
      quantity,
      subtotal: unitPrice * quantity,
    });
  }

  const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const { dateCompact, isoLocal } = nowInTaipei();
  const orderId = generateOrderId(existingOrders, dateCompact);

  await appendRows(accessToken, spreadsheetId, "Orders", [
    [
      orderId,
      campaign_id,
      isoLocal,
      customer_name,
      customer_phone,
      pickup_slot_id,
      total,
      "pending",
      "new",
      note || "",
    ],
  ]);

  await appendRows(
    accessToken,
    spreadsheetId,
    "Order_Items",
    orderItems.map((item) => [
      orderId,
      item.product_id,
      item.product_name_snapshot,
      item.unit_price,
      item.quantity,
      item.subtotal,
    ])
  );

  return json(
    {
      ok: true,
      order: {
        order_id: orderId,
        campaign_id,
        created_at: isoLocal,
        customer_name,
        customer_phone,
        pickup_slot_id,
        total,
        payment_status: "pending",
        order_status: "new",
        note: note || "",
        items: orderItems.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name_snapshot,
          unit_price: item.unit_price,
          quantity: item.quantity,
          subtotal: item.subtotal,
        })),
      },
    },
    { status: 201 }
  );
}

// GET /campaigns：目前 active 的檔期，含各自的取貨時段。
async function handleCampaigns(env) {
  const { accessToken, spreadsheetId } = await getAuthedContext(env);
  const [campaigns, slots] = await Promise.all([
    getSheetRows(accessToken, spreadsheetId, "Campaigns"),
    getSheetRows(accessToken, spreadsheetId, "PickupSlots"),
  ]);

  const active = campaigns
    .filter((c) => c.status === "active")
    .map((c) => ({
      campaign_id: c.campaign_id,
      name: c.name,
      status: c.status,
      start_date: c.start_date,
      end_date: c.end_date,
      total_quantity_cap: toNumber(c.total_quantity_cap),
      pickup_slots: slots
        .filter((s) => s.campaign_id === c.campaign_id)
        .map((s) => ({ slot_id: s.slot_id, date: s.date, time_range: s.time_range })),
    }));

  return json({ ok: true, campaigns: active });
}

// GET /products：目前 active 檔期、且上架中的商品，已訂購量從 Order_Items 即時加總
// （只算未取消的訂單），不讀任何預先存好的彙總欄位。
async function handleProducts(env) {
  const { accessToken, spreadsheetId } = await getAuthedContext(env);
  const [campaigns, products, orders, orderItems] = await Promise.all([
    getSheetRows(accessToken, spreadsheetId, "Campaigns"),
    getSheetRows(accessToken, spreadsheetId, "Products"),
    getSheetRows(accessToken, spreadsheetId, "Orders"),
    getSheetRows(accessToken, spreadsheetId, "Order_Items"),
  ]);

  const activeCampaignIds = new Set(
    campaigns.filter((c) => c.status === "active").map((c) => c.campaign_id)
  );

  const countedOrderIds = new Set(
    orders
      .filter((o) => activeCampaignIds.has(o.campaign_id) && o.order_status !== "cancelled")
      .map((o) => o.order_id)
  );

  const orderedQtyByProduct = {};
  for (const item of orderItems) {
    if (!countedOrderIds.has(item.order_id)) continue;
    orderedQtyByProduct[item.product_id] =
      (orderedQtyByProduct[item.product_id] || 0) + toNumber(item.quantity);
  }

  const list = products
    .filter((p) => activeCampaignIds.has(p.campaign_id) && isActive(p.active))
    .map((p) => ({
      product_id: p.product_id,
      campaign_id: p.campaign_id,
      name: p.name,
      category: p.category,
      price: toNumber(p.price),
      max_per_order: toNumber(p.max_per_order),
      ordered_quantity: orderedQtyByProduct[p.product_id] || 0,
    }));

  return json({ ok: true, products: list });
}

// GET /orders：給老闆後台看的訂單列表，含每張訂單的品項明細，新訂單排前面。
async function handleOrders(env) {
  const { accessToken, spreadsheetId } = await getAuthedContext(env);
  const [orders, orderItems] = await Promise.all([
    getSheetRows(accessToken, spreadsheetId, "Orders"),
    getSheetRows(accessToken, spreadsheetId, "Order_Items"),
  ]);

  const itemsByOrderId = {};
  for (const item of orderItems) {
    if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
    itemsByOrderId[item.order_id].push({
      product_id: item.product_id,
      product_name: item.product_name_snapshot,
      unit_price: toNumber(item.unit_price),
      quantity: toNumber(item.quantity),
      subtotal: toNumber(item.subtotal),
    });
  }

  const list = orders
    .map((o) => ({
      order_id: o.order_id,
      campaign_id: o.campaign_id,
      created_at: o.created_at,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      pickup_slot_id: o.pickup_slot_id,
      total: toNumber(o.total),
      payment_status: o.payment_status,
      order_status: o.order_status,
      note: o.note,
      items: itemsByOrderId[o.order_id] || [],
    }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return json({ ok: true, orders: list });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      if (url.pathname === "/orders" && request.method === "POST") {
        return await handleCreateOrder(request, env);
      }

      if (request.method !== "GET") {
        return json({ ok: false, error: "Method not allowed" }, { status: 405 });
      }

      // Phase 3-1 驗收用的測試 endpoint，繼續保留方便之後排錯。
      if (url.pathname === "/api/test-sheets") {
        const { accessToken, spreadsheetId } = await getAuthedContext(env);
        const values = await getValues(accessToken, spreadsheetId, "Settings!A1:B2");
        return json({ ok: true, values });
      }

      if (url.pathname === "/products") return await handleProducts(env);
      if (url.pathname === "/campaigns") return await handleCampaigns(env);
      if (url.pathname === "/orders") return await handleOrders(env);

      return json({ ok: false, error: "Not found" }, { status: 404 });
    } catch (err) {
      return json({ ok: false, error: err.message }, { status: 500 });
    }
  },
};
