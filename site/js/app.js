(function () {
  "use strict";

  var API_BASE = "https://ygg-hidden-star-9fe8.drum3126.workers.dev";

  var els = {
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
    stepProducts: document.getElementById("step-products"),
    productList: document.getElementById("product-list"),
    stepSlot: document.getElementById("step-slot"),
    slotList: document.getElementById("slot-list"),
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
    copyOrderIdBtn: document.getElementById("copy-order-id"),
    doneBankInfo: document.getElementById("done-bank-info"),
    doneLineLink: document.getElementById("done-line-link"),
    restartBtn: document.getElementById("restart-btn"),
    cartBar: document.getElementById("cart-bar"),
    cartCount: document.getElementById("cart-count"),
    cartTotal: document.getElementById("cart-total"),
    cartNextBtn: document.getElementById("cart-next-btn"),
  };

  var STEPS = ["products", "slot", "form", "summary"];
  var stepSections = {
    products: els.stepProducts,
    slot: els.stepSlot,
    form: els.stepForm,
    summary: els.stepSummary,
  };

  var state = {
    settings: {},
    campaign: null,
    products: [],
    cart: {}, // product_id -> quantity
    selectedSlotId: null,
    currentStep: 0,
    submitting: false,
  };

  function isTrue(v) {
    return v === true || v === "TRUE" || v === "true" || v === "1";
  }

  function money(n) {
    return "NT$ " + Number(n || 0).toLocaleString("zh-Hant-TW");
  }

  function showOnly(el) {
    [els.loading, els.paused, els.empty, els.error].forEach(function (e) {
      e.classList.add("hidden");
    });
    if (el) el.classList.remove("hidden");
  }

  function setStepsVisible(visible) {
    STEPS.forEach(function (key) {
      if (!visible) stepSections[key].classList.add("hidden");
    });
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
    els.cartBar.classList.add("hidden");

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
  }

  function startOrderFlow() {
    renderProducts();
    renderSlots();
    state.currentStep = 0;
    setStepsVisible(true);
    STEPS.forEach(function (key, i) {
      stepSections[key].classList.toggle("hidden", i !== 0);
    });
    updateCartBar();
  }

  function renderProducts() {
    els.productList.innerHTML = "";
    state.products.forEach(function (p) {
      var remaining =
        p.max_per_order > 0 ? p.max_per_order : Infinity;
      var qty = state.cart[p.product_id] || 0;

      var card = document.createElement("div");
      card.className = "product-card";

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

      card.appendChild(info);
      card.appendChild(stepper);
      els.productList.appendChild(card);
    });
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

  function cartItems() {
    return Object.keys(state.cart).map(function (productId) {
      var product = state.products.find(function (p) {
        return p.product_id === productId;
      });
      var quantity = state.cart[productId];
      return {
        product_id: productId,
        name: product ? product.name : productId,
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

  function updateCartBar() {
    var count = cartCount();
    var stepKey = STEPS[state.currentStep];

    if (count === 0 || stepKey === "summary") {
      els.cartBar.classList.add("hidden");
      return;
    }

    els.cartBar.classList.remove("hidden");
    els.cartCount.textContent = count + " 項";
    els.cartTotal.textContent = money(cartTotal());

    var labels = {
      products: "下一步：選時段",
      slot: "下一步：填資料",
      form: "下一步：確認訂單",
    };
    els.cartNextBtn.textContent = labels[stepKey] || "下一步";
  }

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

  function goToStep(index) {
    state.currentStep = index;
    STEPS.forEach(function (key, i) {
      stepSections[key].classList.toggle("hidden", i !== index);
    });
    if (STEPS[index] === "summary") renderSummary();
    updateCartBar();
    stepSections[STEPS[index]].scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function validateCurrentStep() {
    var key = STEPS[state.currentStep];
    if (key === "products") {
      if (cartCount() === 0) return "請至少選擇一項商品";
    } else if (key === "slot") {
      if (!state.selectedSlotId) return "請選擇取貨時段";
    } else if (key === "form") {
      if (!els.customerName.value.trim()) return "請填寫姓名";
      if (!els.customerPhone.value.trim()) return "請填寫電話";
    }
    return null;
  }

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
    els.summaryTotalAmount.textContent = money(cartTotal());
    els.submitBtn.disabled = state.submitting;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  els.cartNextBtn.addEventListener("click", function () {
    var err = validateCurrentStep();
    if (err) {
      alert(err);
      return;
    }
    goToStep(state.currentStep + 1);
  });

  els.retryBtn.addEventListener("click", init);

  els.submitBtn.addEventListener("click", async function () {
    var err = validateCurrentStep();
    // form 步驟已經在前進到 summary 前驗證過，這裡再保險檢查一次資料完整。
    if (!els.customerName.value.trim() || !els.customerPhone.value.trim() || cartCount() === 0 || !state.selectedSlotId) {
      goToStep(0);
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
        pickup_slot_id: state.selectedSlotId,
        note: els.customerNote.value.trim(),
        items: cartItems().map(function (item) {
          return { product_id: item.product_id, quantity: item.quantity };
        }),
      };

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

  function showDone(order) {
    setStepsVisible(false);
    els.stepDone.classList.remove("hidden");
    els.cartBar.classList.add("hidden");

    els.doneOrderId.textContent = order.order_id;

    var s = state.settings;
    els.doneBankInfo.innerHTML =
      bankRow("銀行", s.bank_name) +
      bankRow("帳號", s.bank_account) +
      bankRow("戶名", s.bank_owner) +
      bankRow("金額", money(order.total));

    var lineHandle = s.shop_line || "";
    if (lineHandle) {
      var lineUrl = lineHandle.indexOf("http") === 0
        ? lineHandle
        : "https://line.me/R/ti/p/" + encodeURIComponent(lineHandle);
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

  els.copyOrderIdBtn.addEventListener("click", async function () {
    var text = els.doneOrderId.textContent;
    try {
      await navigator.clipboard.writeText(text);
      els.copyOrderIdBtn.textContent = "已複製！";
    } catch {
      els.copyOrderIdBtn.textContent = "複製失敗，請手動選取";
    }
    setTimeout(function () {
      els.copyOrderIdBtn.textContent = "複製訂單編號";
    }, 2000);
  });

  els.restartBtn.addEventListener("click", function () {
    state.cart = {};
    state.selectedSlotId = null;
    els.customerName.value = "";
    els.customerPhone.value = "";
    els.customerNote.value = "";
    els.stepDone.classList.add("hidden");
    init();
  });

  init();
})();
