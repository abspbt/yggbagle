// 假資料（Phase 1：純前端，不接後端）
// 互動狀態存 localStorage，重新整理仍保留，方便老闆試用時感受操作邏輯

const STORAGE_KEY = 'ykj_pwa_state_v1';
// 假資料內容（菜單、示範訂單等）改版時要跟著往上加，
// 讓手機裡已經存過舊假資料的裝置能自動換成新內容，不用手動清資料
const DATA_VERSION = 4;

function defaultState() {
  return {
    dataVersion: DATA_VERSION,
    shop: {
      name: '歪嘴雞烘焙',
      intro: '手工窯烤麵包，每週三、六限量預購。',
      line: '@ykjbakery',
      phone: '0912-345-678',
      address: '台中市西區美村路一段123號',
      bank: '玉山銀行 808',
      bankAccount: '1234-567-890123',
      bankOwner: '陳O雯'
    },
    announcement: {
      text: '本週六（8/16）預購開放中！\n數量有限，賣完為止 🍞\n取貨時間 14:00–18:00，請準時至店內取貨。',
      visible: true
    },
    preorderOpen: true,
    pauseMessage: '目前暫停接單，恢復時間將於粉絲頁公告，謝謝您的支持！',
    campaigns: [
      {
        id: 'C001',
        name: '8月第3週檔期',
        status: 'active',
        start: '2026-08-10',
        end: '2026-08-14',
        pickupSlots: [
          { id: 'S1', date: '2026-08-16', time: '14:00-16:00' },
          { id: 'S2', date: '2026-08-16', time: '16:00-18:00' }
        ],
        cap: 150
      },
      {
        id: 'C002',
        name: '8月第4週檔期',
        status: 'upcoming',
        start: '2026-08-17',
        end: '2026-08-21',
        pickupSlots: [
          { id: 'S3', date: '2026-08-23', time: '14:00-18:00' }
        ],
        cap: 120
      },
      {
        id: 'C000',
        name: '7月第4週檔期',
        status: 'ended',
        start: '2026-07-20',
        end: '2026-07-24',
        pickupSlots: [
          { id: 'S0', date: '2026-07-26', time: '14:00-18:00' }
        ],
        cap: 100
      }
    ],
    products: [
      // 有餡系列
      { id: 'P001', campaignId: 'C001', name: '（有餡）原味卡士達（大 5顆/袋）', desc: '有餡系列', price: 250, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P002', campaignId: 'C001', name: '（有餡）原味卡士達（小 8顆/袋）', desc: '有餡系列', price: 280, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P003', campaignId: 'C001', name: '（有餡）古早味芝麻（大 5顆/袋）', desc: '有餡系列', price: 250, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P004', campaignId: 'C001', name: '（有餡）古早味芝麻（小 8顆/袋）', desc: '有餡系列', price: 280, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P005', campaignId: 'C001', name: '（有餡）蔓莓法芙娜（大 5顆/袋）', desc: '有餡系列', price: 280, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P006', campaignId: 'C001', name: '（有餡）蔓莓法芙娜（小 8顆/袋）', desc: '有餡系列', price: 300, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P007', campaignId: 'C001', name: '（有餡）乳酪檸檬香（大 5顆/袋）', desc: '有餡系列', price: 280, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P008', campaignId: 'C001', name: '（有餡）乳酪檸檬香（小 8顆/袋）', desc: '有餡系列', price: 300, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P009', campaignId: 'C001', name: '（有餡）玫瑰核乳酪（大 5顆/袋）', desc: '有餡系列', price: 300, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P010', campaignId: 'C001', name: '（有餡）玫瑰核乳酪（小 8顆/袋）', desc: '有餡系列', price: 310, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P011', campaignId: 'C001', name: '（有餡）野莓果乳酪（大 5顆/袋）', desc: '有餡系列', price: 300, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P012', campaignId: 'C001', name: '（有餡）野莓果乳酪（小 8顆/袋）', desc: '有餡系列', price: 330, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P013', campaignId: 'C001', name: '（有餡）甜蜜蘋果派（大 5顆/袋）', desc: '有餡系列', price: 300, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P014', campaignId: 'C001', name: '（有餡）甜蜜蘋果派（小 8顆/袋）', desc: '有餡系列', price: 330, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P015', campaignId: 'C001', name: '（有餡）草莓果乳酪（大 5顆/袋）', desc: '有餡系列', price: 300, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P016', campaignId: 'C001', name: '（有餡）草莓果乳酪（小 8顆/袋）', desc: '有餡系列', price: 330, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P017', campaignId: 'C001', name: '（有餡）洋蔥乳酪丁（大 5顆/袋）', desc: '有餡系列', price: 300, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P018', campaignId: 'C001', name: '（有餡）洋蔥乳酪丁（小 8顆/袋）', desc: '有餡系列', price: 330, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P019', campaignId: 'C001', name: '（有餡）乳酪濃起司（大 5顆/袋）', desc: '有餡系列', price: 320, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P020', campaignId: 'C001', name: '（有餡）乳酪濃起司（小 8顆/袋）', desc: '有餡系列', price: 350, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P021', campaignId: 'C001', name: '（有餡）起司剝辣椒（大 5顆/袋）', desc: '有餡系列', price: 330, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P022', campaignId: 'C001', name: '（有餡）起司剝辣椒（小 8顆/袋）', desc: '有餡系列', price: 360, maxPerOrder: 5, active: true, photo: '🍪' },
      // 無餡系列
      { id: 'P023', campaignId: 'C001', name: '（無餡）原味牛奶糖（大 5顆/袋）', desc: '無餡系列', price: 200, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P024', campaignId: 'C001', name: '（無餡）原味牛奶糖（小 8顆/袋）', desc: '無餡系列', price: 220, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P025', campaignId: 'C001', name: '（無餡）健康芝芝麻（大 5顆/袋）', desc: '無餡系列', price: 220, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P026', campaignId: 'C001', name: '（無餡）健康芝芝麻（小 8顆/袋）', desc: '無餡系列', price: 240, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P027', campaignId: 'C001', name: '（無餡）抹茶成熟味（大 5顆/袋）', desc: '無餡系列', price: 220, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P028', campaignId: 'C001', name: '（無餡）抹茶成熟味（小 8顆/袋）', desc: '無餡系列', price: 240, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P029', campaignId: 'C001', name: '（無餡）阿薩姆紅茶（大 5顆/袋）', desc: '無餡系列', price: 220, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P030', campaignId: 'C001', name: '（無餡）阿薩姆紅茶（小 8顆/袋）', desc: '無餡系列', price: 240, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P031', campaignId: 'C001', name: '（無餡）岩燒乳酪絲（大 5顆/袋）', desc: '無餡系列', price: 220, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P032', campaignId: 'C001', name: '（無餡）岩燒乳酪絲（小 8顆/袋）', desc: '無餡系列', price: 240, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P033', campaignId: 'C001', name: '（無餡）戀愛野莓果（大 5顆/袋）', desc: '無餡系列', price: 250, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P034', campaignId: 'C001', name: '（無餡）戀愛野莓果（小 8顆/袋）', desc: '無餡系列', price: 270, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P035', campaignId: 'C001', name: '（無餡）經典法芙娜（可可）（大 5顆/袋）', desc: '無餡系列', price: 250, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P036', campaignId: 'C001', name: '（無餡）經典法芙娜（可可）（小 8顆/袋）', desc: '無餡系列', price: 270, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P037', campaignId: 'C001', name: '（無餡）草莓香果粒（大 5顆/袋）', desc: '無餡系列', price: 260, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P038', campaignId: 'C001', name: '（無餡）草莓香果粒（小 8顆/袋）', desc: '無餡系列', price: 280, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P039', campaignId: 'C001', name: '（無餡）伯爵紅茶香（大 5顆/袋）', desc: '無餡系列', price: 260, maxPerOrder: 5, active: true, photo: '🍪' },
      { id: 'P040', campaignId: 'C001', name: '（無餡）伯爵紅茶香（小 8顆/袋）', desc: '無餡系列', price: 280, maxPerOrder: 5, active: true, photo: '🍪' }
    ],
    orders: [
      {
        id: 'ORD-20260810-0007',
        campaignId: 'C001',
        createdAt: '2026-08-10 09:12',
        customerName: '林small姐',
        customerPhone: '0933-111-222',
        pickupSlot: '8/16 14:00-16:00',
        items: [
          { name: '（有餡）原味卡士達（大 5顆/袋）', qty: 2, price: 250 },
          { name: '（有餡）蔓莓法芙娜（小 8顆/袋）', qty: 1, price: 300 }
        ],
        total: 800,
        paymentStatus: 'pending',
        orderStatus: 'new',
        note: ''
      },
      {
        id: 'ORD-20260810-0006',
        campaignId: 'C001',
        createdAt: '2026-08-10 08:55',
        customerName: '陳先生',
        customerPhone: '0922-333-444',
        pickupSlot: '8/16 16:00-18:00',
        items: [
          { name: '（有餡）起司剝辣椒（大 5顆/袋）', qty: 1, price: 330 }
        ],
        total: 330,
        paymentStatus: 'pending',
        orderStatus: 'new',
        note: ''
      },
      {
        id: 'ORD-20260809-0012',
        campaignId: 'C001',
        createdAt: '2026-08-09 20:31',
        customerName: '王太太',
        customerPhone: '0955-666-777',
        pickupSlot: '8/16 14:00-16:00',
        items: [
          { name: '（有餡）原味卡士達（大 5顆/袋）', qty: 3, price: 250 },
          { name: '（無餡）經典法芙娜（可可）（小 8顆/袋）', qty: 2, price: 270 }
        ],
        total: 1290,
        paymentStatus: 'confirmed',
        orderStatus: 'prepping_done',
        note: ''
      },
      {
        id: 'ORD-20260809-0011',
        campaignId: 'C001',
        createdAt: '2026-08-09 18:02',
        customerName: 'Amy',
        customerPhone: '0966-888-999',
        pickupSlot: '8/16 16:00-18:00',
        items: [
          { name: '（有餡）古早味芝麻（大 5顆/袋）', qty: 2, price: 250 }
        ],
        total: 500,
        paymentStatus: 'confirmed',
        orderStatus: 'picked_up',
        note: '已提前取貨'
      },
      {
        id: 'ORD-20260808-0003',
        campaignId: 'C001',
        createdAt: '2026-08-08 11:20',
        customerName: '張先生',
        customerPhone: '0977-000-111',
        pickupSlot: '8/16 14:00-16:00',
        items: [
          { name: '（有餡）玫瑰核乳酪（小 8顆/袋）', qty: 1, price: 310 }
        ],
        total: 310,
        paymentStatus: 'pending',
        orderStatus: 'cancelled',
        note: '客人要求取消'
      }
    ]
  };
}

const Store = {
  state: null,
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      this.state = (saved && saved.dataVersion === DATA_VERSION) ? saved : defaultState();
    } catch (e) {
      this.state = defaultState();
    }
    this.save();
    return this.state;
  },
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  },
  reset() {
    this.state = defaultState();
    this.save();
  }
};

Store.load();
