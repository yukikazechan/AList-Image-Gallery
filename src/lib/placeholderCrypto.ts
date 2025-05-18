import CryptoJS from 'crypto-js';

// AES-256, PBKDF2 for key derivation
const KEY_SIZE_WORDS = 256 / 32; // Key size in 32-bit words
const PBKDF2_ITERATIONS = 1000;  // Iteration count for PBKDF2. Increase for better security if performance allows.
                               // For client-side, 1000 is low; production might use 10000-100000+ if acceptable.

interface EncryptedPayload {
  s: string; // salt (hex)
  iv: string; // iv (hex)
  ct: string; // ciphertext (base64)
}

/**
 * Encrypts data using AES-256-CBC with a password-derived key.
 * IMPORTANT: This is a client-side encryption example. Its security relies heavily
 * on the password's strength and how it's communicated.
 * The salt and IV are returned as part of the payload, which is standard practice.
 *
 * @param data The string data to encrypt.
 * @param password The password to derive the encryption key from.
 * @returns A Base64 encoded JSON string containing salt, IV, and ciphertext, or empty string on error or no password.
 */
export const placeholderEncrypt = (data: string, password?: string): string => {
  if (!password || password.trim().length === 0) {
    console.warn("[Crypto] placeholderEncrypt: Password is empty or not provided. Encryption cannot proceed securely. Returning empty string.");
    // Depending on requirements, you might throw an error or return unencrypted data (not recommended for sensitive info).
    // For this use case (encrypting config), a password should be mandatory.
    return ""; 
  }

  try {
    const salt = CryptoJS.lib.WordArray.random(128 / 8); // 128-bit salt
    const iv = CryptoJS.lib.WordArray.random(128 / 8);   // 128-bit IV for AES

    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: KEY_SIZE_WORDS,
      iterations: PBKDF2_ITERATIONS,
      hasher: CryptoJS.algo.SHA256 // Specify a hasher for PBKDF2
    });

    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv: iv,
      padding: CryptoJS.pad.Pkcs7,
      mode: CryptoJS.mode.CBC,
    });

    const payload: EncryptedPayload = {
      s: salt.toString(CryptoJS.enc.Hex),
      iv: iv.toString(CryptoJS.enc.Hex),
      ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
    };
    
    return btoa(JSON.stringify(payload)); // Base64 encode the JSON payload for URL safety
  } catch (e) {
    console.error("[Crypto] Encryption failed:", e);
    // In a real app, you might want to throw a more specific error or handle it.
    return ""; // Return empty or throw
  }
};

/**
 * Decrypts data encrypted with placeholderEncrypt.
 *
 * @param encryptedUrlSafeData A Base64 encoded JSON string containing salt, IV, and ciphertext.
 * @param password The password used for encryption.
 * @returns The decrypted string, or throws an error if decryption fails.
 */
export const placeholderDecrypt = (encryptedUrlSafeData: string, password?: string): string => {
  if (!password || password.trim().length === 0) {
    console.error("[Crypto] placeholderDecrypt: Password is empty or not provided. Decryption cannot proceed.");
    throw new Error("Password is required for decryption.");
  }

  if (!encryptedUrlSafeData || encryptedUrlSafeData.trim().length === 0) {
    console.error("[Crypto] placeholderDecrypt: Encrypted data is empty.");
    throw new Error("Encrypted data is missing.");
  }
  
  try {
    const payloadJson = atob(encryptedUrlSafeData); // Decode Base64 from URL param
    const payload: EncryptedPayload = JSON.parse(payloadJson);

    if (!payload.s || !payload.iv || !payload.ct) {
        throw new Error("Decryption failed: Invalid encrypted data structure (missing salt, iv, or ciphertext).");
    }

    const salt = CryptoJS.enc.Hex.parse(payload.s);
    const iv = CryptoJS.enc.Hex.parse(payload.iv);

    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: KEY_SIZE_WORDS,
      iterations: PBKDF2_ITERATIONS,
      hasher: CryptoJS.algo.SHA256
    });

    const decrypted = CryptoJS.AES.decrypt(
      payload.ct, // Ciphertext is already Base64, AES.decrypt handles it
      key, 
      {
        iv: iv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC,
      }
    );

    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);

    if (!decryptedText) {
      // This often indicates a wrong password as decryption results in an empty or malformed string
      // (CryptoJS might not throw an error but return an empty WordArray on bad decrypt)
      throw new Error("Decryption failed. Likely an invalid password or corrupted data (resulted in empty plaintext).");
    }
    return decryptedText;
  } catch (e: any) {
    console.error("[Crypto] Decryption failed:", e);
    // Catch JSON parse errors, or errors from crypto operations
    if (e.message && e.message.toLowerCase().includes("malformed utf-8 data")) {
         throw new Error("Decryption failed. Invalid password or corrupted data (malformed UTF-8).");
    }
    throw new Error(e.message || "Decryption process failed due to an unexpected error.");
  }
};