import { getAccessToken } from "./googleAuth.js";
import { getValues } from "./sheets.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Phase 3-1 驗收用：確認 Worker 能透過 Service Account 讀到 Sheets 的一筆資料。
    // 之後的 Phase 3-2 會把這個測試 endpoint 換成真正的 GET /products、GET /campaigns 等。
    if (url.pathname === "/api/test-sheets") {
      try {
        const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
        const accessToken = await getAccessToken(serviceAccount);
        const values = await getValues(accessToken, env.SPREADSHEET_ID, "Settings!A1:B2");

        return Response.json({ ok: true, values });
      } catch (err) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
