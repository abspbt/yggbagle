(function () {
  "use strict";

  var API_BASE = "https://ygg-hidden-star-9fe8.drum3126.workers.dev";

  var els = {
    topInfo: document.getElementById("top-info"),
    shopName: document.getElementById("shop-name"),
    shopIntro: document.getElementById("shop-intro"),
    announcement: document.getElementById("announcement"),
    loading: document.getElementById("loading"),
    paused: document.getElementById("paused"),
    pauseMessage: document.getElementById("pause-message"),
    empty: document.getElementById("empty"),
    error: document.getElementById("error"),
    errorMessage: document.getElementById("error-message"),
    retryBtn: document.getElementById("retry-btn"),

    cartSummary: document.getElementById("cart-summary"),
    cartDetails: document.getElementById("cart-details"),
    cartDetailList: document.getElementById("cart-detail-list"),
    cartCount: document.getElementById("cart-count"),
    cartTotal: document.getElementById("cart-total"),
    cartNextBtn: document.getElementById("cart-next-btn"),
    categoryTabs: document.getElementById("category-tabs"),

    stepProducts: document.getElementById("step-products"),
    productList: document.getElementById("product-list"),

    stepDelivery: document.getElementById("step-delivery"),
    deliveryFeeSub: document.getElementById("delivery-fee-sub"),

    stepSlot: document.getElementById("step-slot"),
    slotList: document.getElementById("slot-list"),

    stepAddress: document.getElementById("step-address"),
    deliveryAddress: document.getElementById("delivery-address"),

    stepForm: document.getElementById("step-form"),
    customerName: document.getElementById("customer-name"),
    customerPhone: document.getElementById("customer-phone"),
    customerNote: document.getElementById("customer-note"),

    stepSummary: document.getElementById("step-summary"),
    summaryItems: document.getElementById("summary-items"),
    summaryTotalAmount: document.getElementById("summary-total-amount"),
    submitError: document.getElementById("submit-error"),
    submitBtn: document.getElementById("submit-btn"),

    stepDone: document.getElementById("step-done"),
    doneOrderId: document.getElementById("done-order-id"),
    doneFulfillment: document.getElementById("done-fulfillment"),
    doneOrderItems: document.getElementById("done-order-items"),
    doneOrderTotal: document.getElementById("done-order-total"),
    saveShareBtn: document.getElementById("save-share-btn"),
    saveShareStatus: document.getElementById("save-share-status"),
    doneBankInfo: document.getElementById("done-bank-info"),
    doneLineLink: document.getElementById("done-line-link"),
    restartBtn: document.getElementById("restart-btn"),
    headerLineLink: document.getElementById("header-line-link"),
  };

  var stepSections = {
    products: els.stepProducts,
    delivery: els.stepDelivery,
    slot: els.stepSlot,
    address: els.stepAddress,
    form: els.stepForm,
    summary: els.stepSummary,
  };

  var STEP_LABELS = {
    products: "選商品",
    delivery: "選擇取貨方式",
    slot: "選取貨時段",
    address: "填寫收件地址",
    form: "填寫聯絡資訊",
  };

  var state = {
    settings: {},
    campaign: null,
    products: [],
    cart: {}, // product_id -> quantity
    activeCategory: null,
    selectedSlotId: null,
    deliveryMethod: null, // "pickup" | "delivery"
    currentStepKey: "products",
    submitting: false,
    lastOrder: null,
  };

  function isTrue(v) {
    return v === true || v === "TRUE" || v === "true" || v === "1";
  }

  function money(n) {
    return "NT$ " + Number(n || 0).toLocaleString("zh-Hant-TW");
  }

  function shippingFee() {
    return Number(state.settings.shipping_fee) || 0;
  }

  function showOnly(el) {
    [els.loading, els.paused, els.empty, els.error].forEach(function (e) {
      e.classList.add("hidden");
    });
    if (el) el.classList.remove("hidden");
  }

  function setStepsVisible(visible) {
    Object.keys(stepSections).forEach(function (key) {
      if (!visible) stepSections[key].classList.add("hidden");
    });
  }

  function syncCartBarHeight() {
    var h = els.cartSummary.classList.contains("hidden") ? 0 : els.cartSummary.offsetHeight;
    document.documentElement.style.setProperty("--cartbar-h", h + "px");
  }

  function syncTopInfoHeight() {
    document.documentElement.style.setProperty("--topinfo-h", els.topInfo.offsetHeight + "px");
  }

  async function fetchJson(path, options) {
    var res = await fetch(API_BASE + path, options);
    var data;
    try {
      data = await res.json();
    } catch {
      throw new Error("伺服器回應格式錯誤");
    }
    if (!res.ok || !data.ok) {
      throw new Error(data && data.error ? data.error : "發生未知錯誤（" + res.status + "）");
    }
    return data;
  }

  async function init() {
    showOnly(els.loading);
    setStepsVisible(false);
    els.cartSummary.classList.add("hidden");
    els.categoryTabs.classList.add("hidden");
    syncCartBarHeight();

    try {
      var results = await Promise.all([
        fetchJson("/settings"),
        fetchJson("/campaigns"),
        fetchJson("/products"),
      ]);
      var settingsData = results[0];
      var campaignsData = results[1];
      var productsData = results[2];

      state.settings = settingsData.settings || {};
      applyShopInfo();

      if (!isTrue(state.settings.preorder_open)) {
        showOnly(els.paused);
        els.pauseMessage.textContent =
          state.settings.pause_message || "目前暫停接單，請稍後再回來看看。";
        return;
      }

      var campaigns = campaignsData.campaigns || [];
      state.products = productsData.products || [];

      if (campaigns.length === 0 || state.products.length === 0) {
        showOnly(els.empty);
        return;
      }

      // 目前只會有一個 active 檔期（Worker 端邏輯），取第一個。
      state.campaign = campaigns[0];

      showOnly(null);
      startOrderFlow();
    } catch (err) {
      showOnly(els.error);
      els.errorMessage.textContent = "連線發生問題：" + err.message + "\n請確認網路連線後再試一次。";
    }
  }

  function buildLineUrl(handle) {
    if (!handle) return "";
    // 從 Google Sheets 貼上時常見的資料問題：前後多餘空白、中文輸入法把「@」打成全形「＠」、
    // 忘記帶「@」開頭。這裡統一修正，避免加好友連結因為這些小狀況失效。
    var cleaned = String(handle).trim().replace(/＠/g, "@");
    if (cleaned.indexOf("http") === 0) return cleaned;
    if (cleaned.charAt(0) !== "@") cleaned = "@" + cleaned;
    return "https://line.me/R/ti/p/" + encodeURIComponent(cleaned);
  }

  function applyShopInfo() {
    var s = state.settings;
    if (s.shop_name) {
      els.shopName.textContent = s.shop_name;
      document.title = s.shop_name + "｜線上預購";
    }
    if (s.shop_intro) els.shopIntro.textContent = s.shop_intro;

    if (isTrue(s.announcement_visible) && s.announcement_text) {
      els.announcement.textContent = s.announcement_text;
      els.announcement.classList.remove("hidden");
    } else {
      els.announcement.classList.add("hidden");
    }

    var headerLineUrl = buildLineUrl(s.shop_line);
    if (headerLineUrl) {
      els.headerLineLink.href = headerLineUrl;
      els.headerLineLink.classList.remove("hidden");
    } else {
      els.headerLineLink.classList.add("hidden");
    }

    syncTopInfoHeight();
  }

  function startOrderFlow() {
    state.deliveryMethod = null;
    state.selectedSlotId = null;
    state.activeCategory = null;
    renderCategoryTabs();
    renderProducts();
    renderDeliveryOptions();
    renderSlots();
    goToStepKey("products", { scroll: false });
  }

  // ---------- 分類頁籤 ----------

  function categories() {
    var seen = {};
    var list = [];
    state.products.forEach(function (p) {
      var c = p.category || "";
      if (c && !seen[c]) {
        seen[c] = true;
        list.push(c);
      }
    });
    return list;
  }

  function renderCategoryTabs() {
    var cats = categories();
    if (cats.length < 2) {
      els.categoryTabs.classList.add("hidden");
      els.categoryTabs.innerHTML = "";
      syncCartBarHeight();
      return;
    }
    if (!state.activeCategory || cats.indexOf(state.activeCategory) === -1) {
      state.activeCategory = cats[0];
    }
    els.categoryTabs.classList.remove("hidden");
    els.categoryTabs.innerHTML = "";
    cats.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab" + (state.activeCategory === cat ? " active" : "");
      btn.textContent = cat;
      btn.addEventListener("click", function () {
        state.activeCategory = cat;
        renderCategoryTabs();
        renderProducts();
      });
      els.categoryTabs.appendChild(btn);
    });
    syncCartBarHeight();
  }

  function filteredProducts() {
    var cats = categories();
    if (cats.length < 2 || !state.activeCategory) return state.products;
    return state.products.filter(function (p) {
      return (p.category || "") === state.activeCategory;
    });
  }

  // ---------- 商品（含大／小規格分組）----------

  function productGroups() {
    var groups = [];
    var byKey = {};
    filteredProducts().forEach(function (p) {
      var key = p.variant_group || p.product_id;
      if (!byKey[key]) {
        byKey[key] = { key: key, name: p.name, items: [] };
        groups.push(byKey[key]);
      }
      byKey[key].items.push(p);
    });
    return groups;
  }

  function renderProducts() {
    els.productList.innerHTML = "";
    productGroups().forEach(function (group) {
      if (group.items.length === 1) {
        els.productList.appendChild(buildProductCard(group.items[0]));
      } else {
        els.productList.appendChild(buildVariantGroupCard(group));
      }
    });
  }

  function buildStepper(p, qty, remaining) {
    var stepper = document.createElement("div");
    stepper.className = "qty-stepper";

    var minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.className = "qty-btn";
    minusBtn.textContent = "−";
    minusBtn.setAttribute("aria-label", p.name + " 減少數量");
    minusBtn.disabled = qty <= 0;
    minusBtn.addEventListener("click", function () {
      setQty(p.product_id, qty - 1);
    });

    var qtyEl = document.createElement("span");
    qtyEl.className = "qty-value";
    qtyEl.textContent = String(qty);

    var plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.className = "qty-btn";
    plusBtn.textContent = "＋";
    plusBtn.setAttribute("aria-label", p.name + " 增加數量");
    plusBtn.disabled = qty >= remaining;
    plusBtn.addEventListener("click", function () {
      setQty(p.product_id, qty + 1);
    });

    stepper.appendChild(minusBtn);
    stepper.appendChild(qtyEl);
    stepper.appendChild(plusBtn);
    return stepper;
  }

  function buildProductCard(p) {
    var remaining = p.max_per_order > 0 ? p.max_per_order : Infinity;
    var qty = state.cart[p.product_id] || 0;

    var card = document.createElement("div");
    card.className = "product-card";

    var thumb = document.createElement("div");
    thumb.className = "product-thumb";

    var info = document.createElement("div");
    info.className = "product-info";
    var name = document.createElement("p");
    name.className = "product-name";
    name.textContent = p.name;
    var meta = document.createElement("p");
    meta.className = "product-meta";
    meta.innerHTML =
      '<span class="product-price">' +
      money(p.price) +
      "</span> / 袋" +
      (p.max_per_order ? "　每人限購 " + p.max_per_order + " 袋" : "");
    info.appendChild(name);
    info.appendChild(meta);

    card.appendChild(thumb);
    card.appendChild(info);
    card.appendChild(buildStepper(p, qty, remaining));
    return card;
  }

  function buildVariantGroupCard(group) {
    var card = document.createElement("div");
    card.className = "variant-group";

    var name = document.createElement("p");
    name.className = "variant-group-name";
    name.textContent = group.name;
    card.appendChild(name);

    var sizeRow = document.createElement("div");
    sizeRow.className = "variant-row";
    var priceRow = document.createElement("div");
    priceRow.className = "variant-row";
    var stepperRow = document.createElement("div");
    stepperRow.className = "variant-row";

    group.items.forEach(function (p) {
      var sizeBox = document.createElement("div");
      sizeBox.className = "variant-size-box";
      sizeBox.textContent = p.variant_label || p.name;
      sizeRow.appendChild(sizeBox);

      var priceBox = document.createElement("div");
      priceBox.className = "variant-price-box";
      priceBox.innerHTML =
        '<span class="price">' +
        money(p.price) +
        "</span>" +
        (p.max_per_order ? "每人限購 " + p.max_per_order + " 袋" : "");
      priceRow.appendChild(priceBox);

      var remaining = p.max_per_order > 0 ? p.max_per_order : Infinity;
      var qty = state.cart[p.product_id] || 0;
      var stepBox = document.createElement("div");
      stepBox.className = "variant-stepper-box";
      stepBox.appendChild(buildStepper(p, qty, remaining));
      stepperRow.appendChild(stepBox);
    });

    card.appendChild(sizeRow);
    card.appendChild(priceRow);
    card.appendChild(stepperRow);
    return card;
  }

  function setQty(productId, qty) {
    var product = state.products.find(function (p) {
      return p.product_id === productId;
    });
    if (!product) return;
    var max = product.max_per_order > 0 ? product.max_per_order : Infinity;
    qty = Math.max(0, Math.min(qty, max));
    if (qty === 0) {
      delete state.cart[productId];
    } else {
      state.cart[productId] = qty;
    }
    renderProducts();
    updateCartBar();
  }

  // ---------- 購物車 ----------

  function cartItems() {
    return Object.keys(state.cart).map(function (productId) {
      var product = state.products.find(function (p) {
        return p.product_id === productId;
      });
      var quantity = state.cart[productId];
      var name = product ? product.name : productId;
      if (product && product.variant_label) name += "（" + product.variant_label + "）";
      return {
        product_id: productId,
        name: name,
        price: product ? product.price : 0,
        quantity: quantity,
        subtotal: (product ? product.price : 0) * quantity,
      };
    });
  }

  function cartTotal() {
    return cartItems().reduce(function (sum, item) {
      return sum + item.subtotal;
    }, 0);
  }

  function cartCount() {
    return Object.values(state.cart).reduce(function (sum, q) {
      return sum + q;
    }, 0);
  }

  function estimatedTotal() {
    return cartTotal() + (state.deliveryMethod === "delivery" ? shippingFee() : 0);
  }

  function renderCartDetailList() {
    els.cartDetailList.innerHTML = "";
    cartItems().forEach(function (item) {
      var row = document.createElement("div");
      row.className = "cart-detail-row";
      row.innerHTML =
        "<span>" + escapeHtml(item.name) + " × " + item.quantity + "</span><span>" + money(item.subtotal) + "</span>";
      els.cartDetailList.appendChild(row);
    });
    if (state.deliveryMethod === "delivery") {
      var feeRow = document.createElement("div");
      feeRow.className = "cart-detail-row fee";
      feeRow.innerHTML = "<span>低溫宅配運費</span><span>" + money(shippingFee()) + "</span>";
      els.cartDetailList.appendChild(feeRow);
    }
  }

  var CART_NEXT_LABELS = {
    products: "下一步：選取貨方式",
    slot: "下一步：填資料",
    address: "下一步：填資料",
    form: "下一步：確認訂單",
  };

  function updateCartBar() {
    var count = cartCount();
    if (count === 0) {
      els.cartSummary.classList.add("hidden");
      syncCartBarHeight();
      return;
    }

    els.cartSummary.classList.remove("hidden");
    els.cartCount.textContent = String(count);
    els.cartTotal.textContent = money(estimatedTotal());
    renderCartDetailList();

    var key = state.currentStepKey;
    if (key === "summary") {
      els.cartNextBtn.classList.add("hidden");
    } else {
      els.cartNextBtn.classList.remove("hidden");
      var label = CART_NEXT_LABELS[key];
      if (key === "delivery") {
        label =
          state.deliveryMethod === "delivery"
            ? "下一步：填地址"
            : state.deliveryMethod === "pickup"
            ? "下一步：選時段"
            : "下一步";
      }
      els.cartNextBtn.textContent = label || "下一步";
    }
    syncCartBarHeight();
  }

  // ---------- 取貨方式 ----------

  function renderDeliveryOptions() {
    document.querySelectorAll(".delivery-card").forEach(function (card) {
      var opt = card.getAttribute("data-delivery-option");
      var input = card.querySelector("input");
      var selected = state.deliveryMethod === opt;
      card.classList.toggle("selected", selected);
      input.checked = selected;
    });
    var fee = shippingFee();
    els.deliveryFeeSub.textContent = fee > 0 ? "運費 + " + money(fee) : "運費另計";
  }

  document.querySelectorAll('input[name="delivery_method"]').forEach(function (input) {
    input.addEventListener("change", function () {
      state.deliveryMethod = input.value;
      renderDeliveryOptions();
      updateCartBar();
    });
  });

  // ---------- 取貨時段 ----------

  function renderSlots() {
    els.slotList.innerHTML = "";
    var slots = (state.campaign && state.campaign.pickup_slots) || [];
    slots.forEach(function (slot) {
      var label = document.createElement("label");
      label.className = "slot-option";
      if (state.selectedSlotId === slot.slot_id) label.classList.add("selected");

      var radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "pickup_slot";
      radio.value = slot.slot_id;
      radio.checked = state.selectedSlotId === slot.slot_id;
      radio.addEventListener("change", function () {
        state.selectedSlotId = slot.slot_id;
        renderSlots();
      });

      var text = document.createElement("span");
      text.textContent = slot.date + "　" + slot.time_range;

      label.appendChild(radio);
      label.appendChild(text);
      els.slotList.appendChild(label);
    });
  }

  // ---------- 步驟切換 ----------

  function activeSteps() {
    var steps = ["products", "delivery"];
    steps.push(state.deliveryMethod === "delivery" ? "address" : "slot");
    steps.push("form", "summary");
    return steps;
  }

  function updateStepTitles() {
    var steps = activeSteps();
    steps.forEach(function (key, i) {
      if (key === "summary") return;
      var el = document.getElementById("step-" + key + "-title");
      if (el) el.textContent = (i + 1) + ". " + STEP_LABELS[key];
    });
  }

  function renderStepVisibility() {
    var key = state.currentStepKey;
    Object.keys(stepSections).forEach(function (k) {
      stepSections[k].classList.toggle("hidden", k !== key);
    });
  }

  function refreshTabsVisibility() {
    var show = state.currentStepKey === "products" && categories().length >= 2;
    els.categoryTabs.classList.toggle("hidden", !show);
    syncCartBarHeight();
  }

  function goToStepKey(key, opts) {
    state.currentStepKey = key;
    renderStepVisibility();
    if (key === "summary") renderSummary();
    if (key === "delivery") renderDeliveryOptions();
    if (key === "slot") renderSlots();
    updateStepTitles();
    updateCartBar();
    refreshTabsVisibility();
    if (!opts || opts.scroll !== false) {
      stepSections[key].scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function validateCurrentStep() {
    var key = state.currentStepKey;
    if (key === "products") {
      if (cartCount() === 0) return "請至少選擇一項商品";
    } else if (key === "delivery") {
      if (!state.deliveryMethod) return "請選擇取貨方式";
    } else if (key === "slot") {
      if (!state.selectedSlotId) return "請選擇取貨時段";
    } else if (key === "address") {
      if (!els.deliveryAddress.value.trim()) return "請填寫收件地址";
    } else if (key === "form") {
      if (!els.customerName.value.trim()) return "請填寫姓名";
      if (!els.customerPhone.value.trim()) return "請填寫電話";
    }
    return null;
  }

  function goNext() {
    var err = validateCurrentStep();
    if (err) {
      alert(err);
      return;
    }
    var steps = activeSteps();
    var idx = steps.indexOf(state.currentStepKey);
    if (idx === -1 || idx === steps.length - 1) return;
    goToStepKey(steps[idx + 1]);
  }

  function goBack() {
    var steps = activeSteps();
    var idx = steps.indexOf(state.currentStepKey);
    if (idx <= 0) return;
    goToStepKey(steps[idx - 1]);
  }

  document.querySelectorAll("[data-next]").forEach(function (btn) {
    btn.addEventListener("click", goNext);
  });
  document.querySelectorAll("[data-back]").forEach(function (btn) {
    btn.addEventListener("click", goBack);
  });
  els.cartNextBtn.addEventListener("click", goNext);
  window.addEventListener("resize", syncCartBarHeight);
  window.addEventListener("resize", syncTopInfoHeight);
  els.cartDetails.addEventListener("toggle", syncCartBarHeight);

  els.retryBtn.addEventListener("click", init);

  // ---------- 訂單摘要 ----------

  function renderSummary() {
    els.summaryItems.innerHTML = "";
    cartItems().forEach(function (item) {
      var row = document.createElement("div");
      row.className = "summary-row";
      row.innerHTML =
        "<span>" +
        escapeHtml(item.name) +
        ' <span class="sub">× ' +
        item.quantity +
        "</span></span><span>" +
        money(item.subtotal) +
        "</span>";
      els.summaryItems.appendChild(row);
    });
    if (state.deliveryMethod === "delivery") {
      var feeRow = document.createElement("div");
      feeRow.className = "summary-row fee";
      feeRow.innerHTML = "<span>低溫宅配運費</span><span>" + money(shippingFee()) + "</span>";
      els.summaryItems.appendChild(feeRow);
    }
    els.summaryTotalAmount.textContent = money(estimatedTotal());
    els.submitBtn.disabled = state.submitting;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  els.submitBtn.addEventListener("click", async function () {
    var deliveryValid =
      state.deliveryMethod === "delivery"
        ? !!els.deliveryAddress.value.trim()
        : !!state.selectedSlotId;

    if (
      !els.customerName.value.trim() ||
      !els.customerPhone.value.trim() ||
      cartCount() === 0 ||
      !state.deliveryMethod ||
      !deliveryValid
    ) {
      goToStepKey("products");
      return;
    }

    state.submitting = true;
    els.submitBtn.disabled = true;
    els.submitBtn.textContent = "送出中…";
    els.submitError.classList.add("hidden");

    try {
      var body = {
        campaign_id: state.campaign.campaign_id,
        customer_name: els.customerName.value.trim(),
        customer_phone: els.customerPhone.value.trim(),
        note: els.customerNote.value.trim(),
        delivery_method: state.deliveryMethod,
        items: cartItems().map(function (item) {
          return { product_id: item.product_id, quantity: item.quantity };
        }),
      };
      if (state.deliveryMethod === "delivery") {
        body.delivery_address = els.deliveryAddress.value.trim();
      } else {
        body.pickup_slot_id = state.selectedSlotId;
      }

      var data = await fetchJson("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      showDone(data.order);
    } catch (e) {
      els.submitError.textContent = e.message;
      els.submitError.classList.remove("hidden");
    } finally {
      state.submitting = false;
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = "送出訂單";
    }
  });

  function fulfillmentSummaryText() {
    if (state.deliveryMethod === "delivery") {
      return "🚚 低溫宅配　" + els.deliveryAddress.value.trim();
    }
    var slots = (state.campaign && state.campaign.pickup_slots) || [];
    var slot = slots.find(function (s) {
      return s.slot_id === state.selectedSlotId;
    });
    return slot ? "🏠 自取　" + slot.date + "　" + slot.time_range : "🏠 自取";
  }

  function showDone(order) {
    setStepsVisible(false);
    els.stepDone.classList.remove("hidden");
    els.cartSummary.classList.add("hidden");
    syncCartBarHeight();

    els.doneOrderId.textContent = order.order_id;

    var fulfillment = fulfillmentSummaryText();
    els.doneFulfillment.textContent = fulfillment;

    // 訂單回傳的 product_name 是 Sheets 上的原始商品名稱，同一組大/小規格會共用同一個名稱，
    // 這裡比對還留在記憶體裡的商品清單，把 variant_label 補回去，避免明細看起來像是重複品項。
    var displayItems = (order.items || []).map(function (item) {
      var product = state.products.find(function (p) {
        return p.product_id === item.product_id;
      });
      var name = item.product_name;
      if (product && product.variant_label) name += "（" + product.variant_label + "）";
      return { name: name, quantity: item.quantity, subtotal: item.subtotal };
    });

    els.doneOrderItems.innerHTML = "";
    displayItems.forEach(function (item) {
      var row = document.createElement("div");
      row.className = "summary-row";
      row.innerHTML =
        "<span>" +
        escapeHtml(item.name) +
        ' <span class="sub">× ' +
        item.quantity +
        "</span></span><span>" +
        money(item.subtotal) +
        "</span>";
      els.doneOrderItems.appendChild(row);
    });
    // 後端 order.total 已經是商品小計 + 運費的最終金額（shipping_fee 是後端從 Settings
    // 讀到的運費，不是前端自己算的），這裡不用再加一次運費。
    var fee = Number(order.shipping_fee) || 0;
    if (fee > 0) {
      var feeRow = document.createElement("div");
      feeRow.className = "summary-row fee";
      feeRow.innerHTML = "<span>低溫宅配運費</span><span>" + money(fee) + "</span>";
      els.doneOrderItems.appendChild(feeRow);
    }
    var grandTotal = order.total || 0;
    els.doneOrderTotal.textContent = money(grandTotal);

    state.lastOrder = {
      order_id: order.order_id,
      fulfillment: fulfillment,
      items: displayItems,
      fee: fee,
      total: grandTotal,
    };
    setShareStatus("");

    var s = state.settings;
    els.doneBankInfo.innerHTML =
      bankRow("銀行", s.bank_name) +
      bankRow("帳號", s.bank_account) +
      bankRow("戶名", s.bank_owner) +
      bankRow("金額", money(grandTotal));

    var lineUrl = buildLineUrl(s.shop_line);
    if (lineUrl) {
      els.doneLineLink.href = lineUrl;
      els.doneLineLink.classList.remove("hidden");
    } else {
      els.doneLineLink.classList.add("hidden");
    }

    els.stepDone.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bankRow(label, value) {
    if (!value) return "";
    return (
      '<div class="row"><span class="label">' +
      label +
      "</span><span>" +
      escapeHtml(String(value)) +
      "</span></div>"
    );
  }

  // ---------- 完成頁：分享／儲存購買明細 ----------

  function setShareStatus(text) {
    if (!text) {
      els.saveShareStatus.classList.add("hidden");
      els.saveShareStatus.textContent = "";
      return;
    }
    els.saveShareStatus.textContent = text;
    els.saveShareStatus.classList.remove("hidden");
  }

  function buildOrderShareText(order) {
    var shopName = state.settings.shop_name || "訂購";
    var lines = [shopName + " 訂購明細", "訂單編號：" + order.order_id, order.fulfillment, ""];
    order.items.forEach(function (item) {
      lines.push(item.name + " × " + item.quantity + "　" + money(item.subtotal));
    });
    if (order.fee > 0) lines.push("低溫宅配運費　" + money(order.fee));
    lines.push("總計　" + money(order.total));
    return lines.join("\n");
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  // 這顆按鈕只做一件事：把明細複製成文字，行為固定、每支手機都一樣，
  // 不再嘗試判斷裝置支不支援分享/圖片，避免客人猜不到按下去會發生什麼事。
  els.saveShareBtn.addEventListener("click", async function () {
    var order = state.lastOrder;
    if (!order) return;

    setShareStatus("");
    try {
      await copyTextToClipboard(buildOrderShareText(order));
      setShareStatus("已複製，可以貼到 LINE 了。");
    } catch {
      setShareStatus("複製失敗，請直接截圖保留這個畫面。");
    }
  });

  els.restartBtn.addEventListener("click", function () {
    state.cart = {};
    state.selectedSlotId = null;
    state.deliveryMethod = null;
    els.customerName.value = "";
    els.customerPhone.value = "";
    els.customerNote.value = "";
    els.deliveryAddress.value = "";
    els.stepDone.classList.add("hidden");
    init();
  });

  init();
})();
