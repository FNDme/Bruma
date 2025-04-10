import CryptoJS from "crypto-js";
import { invoke } from "@tauri-apps/api/core";

declare global {
  interface Window {
    __TAURI__: {
      invoke: (command: string, args?: any) => Promise<any>;
    };
  }
}

const ITERATIONS = 100000;
const KEY_SIZE = 256 / 32; // 256 bits = 32 bytes

export class EncryptionService {
  private static instance: EncryptionService;
  private masterKey: string | null = null;

  private constructor() {}

  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  public async initializeVault(password: string): Promise<void> {
    const salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
    const hashedPassword = CryptoJS.PBKDF2(password, salt, {
      keySize: KEY_SIZE,
      iterations: ITERATIONS,
    }).toString();

    await invoke("save_vault_credentials", {
      credentials: {
        salt,
        hashed_password: hashedPassword,
      },
    });

    this.masterKey = hashedPassword;
  }

  public async encrypt(data: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error("Vault not initialized");
    }

    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = CryptoJS.AES.encrypt(data, this.masterKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return JSON.stringify({
      iv: iv.toString(),
      data: encrypted.toString(),
    });
  }

  public async decrypt(encryptedData: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error("Vault not initialized");
    }

    const { iv, data } = JSON.parse(encryptedData);
    const decrypted = CryptoJS.AES.decrypt(data, this.masterKey, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  public async unlockVault(password: string): Promise<boolean> {
    try {
      const credentials = await invoke("get_vault_credentials");
      if (!credentials) return false;

      const { salt, hashed_password } = credentials as {
        salt: string;
        hashed_password: string;
      };
      const testHash = CryptoJS.PBKDF2(password, salt, {
        keySize: KEY_SIZE,
        iterations: ITERATIONS,
      }).toString();

      if (testHash === hashed_password) {
        this.masterKey = hashed_password;
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  public async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    try {
      // First verify the current password and get the old key
      const success = await this.unlockVault(currentPassword);
      if (!success) return false;

      // Store the old key temporarily
      const oldKey = this.masterKey;
      if (!oldKey) return false;

      // Get all notes before changing the password
      const notes = JSON.parse(
        localStorage.getItem("bruma_secure_notes") || "{}"
      );

      // Generate new salt and hash for the new password
      const salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
      const hashedPassword = CryptoJS.PBKDF2(newPassword, salt, {
        keySize: KEY_SIZE,
        iterations: ITERATIONS,
      }).toString();

      // Re-encrypt all notes with the new key
      const reencryptedNotes: Record<string, string> = {};
      for (const [id, encryptedNote] of Object.entries(notes)) {
        try {
          // Decrypt with old key
          const { iv, data } = JSON.parse(encryptedNote as string);
          const decrypted = CryptoJS.AES.decrypt(data, oldKey, {
            iv: CryptoJS.enc.Hex.parse(iv),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          });
          const decryptedNote = decrypted.toString(CryptoJS.enc.Utf8);

          // Re-encrypt with new key
          const newIv = CryptoJS.lib.WordArray.random(128 / 8);
          const reencrypted = CryptoJS.AES.encrypt(
            decryptedNote,
            hashedPassword,
            {
              iv: newIv,
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7,
            }
          );
          reencryptedNotes[id] = JSON.stringify({
            iv: newIv.toString(),
            data: reencrypted.toString(),
          });
        } catch (error) {
          console.error(`Error re-encrypting note ${id}:`, error);
          continue;
        }
      }

      // Save re-encrypted notes
      localStorage.setItem(
        "bruma_secure_notes",
        JSON.stringify(reencryptedNotes)
      );

      // Save the new credentials
      await invoke("save_vault_credentials", {
        credentials: {
          salt,
          hashed_password: hashedPassword,
        },
      });

      // Update the master key last
      this.masterKey = hashedPassword;

      return true;
    } catch (error) {
      console.error("Error changing password:", error);
      return false;
    }
  }

  public async isVaultInitialized(): Promise<boolean> {
    try {
      return (await invoke("has_vault_credentials")) as boolean;
    } catch (error) {
      return false;
    }
  }
}
