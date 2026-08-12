// 老闆登入用的短期 Token：HMAC-SHA256 簽章，純 Web Crypto API，不需要額外套件、
// 不需要 D1/KV 存 session（Token 本身帶著到期時間，Worker 只需要驗簽章 + 檢查有沒有過期）。
// Token 格式：base64url(JSON payload).base64url(HMAC 簽章)，payload 只放到期時間 exp。

const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 小時，過期要重新用 PIN 登入

function tokenBase64url(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function tokenBase64urlToBytes(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret, usages) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages
  );
}

// PIN 驗證成功後呼叫，回傳新 token 跟到期時間（unix 秒數）。
export async function signToken(secret) {
  const payload = { exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
  const payloadPart = tokenBase64url(new TextEncoder().encode(JSON.stringify(payload)));

  const key = await importHmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadPart));

  return { token: `${payloadPart}.${tokenBase64url(new Uint8Array(signature))}`, expiresAt: payload.exp };
}

// 驗證某支寫入 API 帶來的 token 是否有效（簽章正確且還沒過期）。
export async function verifyToken(token, secret) {
  if (typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadPart, signaturePart] = parts;

  let valid;
  try {
    const key = await importHmacKey(secret, ["verify"]);
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      tokenBase64urlToBytes(signaturePart),
      new TextEncoder().encode(payloadPart)
    );
  } catch {
    return false;
  }
  if (!valid) return false;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(tokenBase64urlToBytes(payloadPart)));
  } catch {
    return false;
  }

  return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
}
