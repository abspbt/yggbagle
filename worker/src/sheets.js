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
