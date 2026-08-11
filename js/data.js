// 假資料（Phase 1：純前端，不接後端）
// 互動狀態存 localStorage，重新整理仍保留，方便老闆試用時感受操作邏輯

const STORAGE_KEY = 'ykj_pwa_state_v1';

function defaultState() {
  return {
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
        cap: 150,
        ordered: 98
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
        cap: 120,
        ordered: 0
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
        cap: 100,
        ordered: 100
      }
    ],
    products: [
      { id: 'P001', campaignId: 'C001', name: '原味貝果', desc: '經典原味，外脆內Q', price: 45, maxPerOrder: 6, active: true, ordered: 32, photo: '🥯' },
      { id: 'P002', campaignId: 'C001', name: '肉桂捲', desc: '肉桂糖霜手工捲', price: 65, maxPerOrder: 4, active: true, ordered: 21, photo: '🥐' },
      { id: 'P003', campaignId: 'C001', name: '歐式裸麥麵包', desc: '低糖低油，適合搭餐', price: 120, maxPerOrder: 2, active: true, ordered: 15, photo: '🍞' },
      { id: 'P004', campaignId: 'C001', name: '巧克力可頌', desc: '法式奶油可頌夾巧克力', price: 55, maxPerOrder: 6, active: false, ordered: 30, photo: '🥐' },
      { id: 'P005', campaignId: 'C002', name: '南瓜起司貝果', desc: '季節限定口味', price: 55, maxPerOrder: 6, active: true, ordered: 0, photo: '🥯' }
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
          { name: '原味貝果', qty: 4, price: 45 },
          { name: '肉桂捲', qty: 2, price: 65 }
        ],
        total: 310,
        paymentStatus: 'pending',
        orderStatus: 'active',
        note: '麻煩幫我切半，謝謝！'
      },
      {
        id: 'ORD-20260810-0006',
        campaignId: 'C001',
        createdAt: '2026-08-10 08:55',
        customerName: '陳先生',
        customerPhone: '0922-333-444',
        pickupSlot: '8/16 16:00-18:00',
        items: [
          { name: '歐式裸麥麵包', qty: 2, price: 120 }
        ],
        total: 240,
        paymentStatus: 'pending',
        orderStatus: 'active',
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
          { name: '原味貝果', qty: 6, price: 45 },
          { name: '巧克力可頌', qty: 3, price: 55 }
        ],
        total: 435,
        paymentStatus: 'confirmed',
        orderStatus: 'active',
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
          { name: '肉桂捲', qty: 4, price: 65 }
        ],
        total: 260,
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
          { name: '巧克力可頌', qty: 2, price: 55 }
        ],
        total: 110,
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
      this.state = raw ? JSON.parse(raw) : defaultState();
    } catch (e) {
      this.state = defaultState();
    }
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
