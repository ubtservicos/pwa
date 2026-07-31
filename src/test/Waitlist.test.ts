import { describe, it, expect } from "vitest";

// Port of sha256 and User-Agent parsing logic from Index.tsx for testing validation
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseUserAgent(userAgent: string) {
  let device_type = "Desktop";
  if (/mobile/i.test(userAgent)) device_type = "Mobile";
  if (/tablet/i.test(userAgent)) device_type = "Tablet";
  
  let browser = "Outro";
  if (/chrome|crios/i.test(userAgent)) browser = "Chrome";
  else if (/firefox|fxios/i.test(userAgent)) browser = "Firefox";
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = "Safari";
  else if (/edge|edg/i.test(userAgent)) browser = "Edge";
  
  let os = "Outro";
  if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS";
  else if (/windows/i.test(userAgent)) os = "Windows";
  else if (/macintosh|mac os x/i.test(userAgent)) os = "MacOS";
  else if (/android/i.test(userAgent)) os = "Android";

  return { device_type, browser, os };
}

describe("Waitlist Helpers & Data Sanitization", () => {
  it("should hash IP seed securely via SHA-256 without exposing raw inputs", async () => {
    const seed1 = "Mozilla/5.0-pt-BR-1920x1080";
    const seed2 = "Mozilla/5.0-en-US-1024x768";
    
    const hash1 = await sha256(seed1);
    const hash2 = await sha256(seed2);

    expect(hash1).toHaveLength(64);
    expect(hash2).toHaveLength(64);
    expect(hash1).not.toBe(hash2);
    expect(hash1).toBe("30b94c43c714a5242056706d6102ebe52312e00913c0d00660ca32d48b2ade6e");
  });

  it("should correctly identify Mobile devices, Safari browser, and iOS operating system", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
    const parsed = parseUserAgent(ua);

    expect(parsed.device_type).toBe("Mobile");
    expect(parsed.browser).toBe("Safari");
    expect(parsed.os).toBe("iOS");
  });

  it("should correctly identify Desktop devices, Chrome browser, and Windows operating system", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
    const parsed = parseUserAgent(ua);

    expect(parsed.device_type).toBe("Desktop");
    expect(parsed.browser).toBe("Chrome");
    expect(parsed.os).toBe("Windows");
  });
});
