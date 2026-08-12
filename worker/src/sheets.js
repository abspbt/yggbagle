// 用 access token 讀 Google Sheets 某個範圍的值。
export async function getValues(accessToken, spreadsheetId, range) {
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
export async function getSheetRows(accessToken, spreadsheetId, sheetName) {
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
