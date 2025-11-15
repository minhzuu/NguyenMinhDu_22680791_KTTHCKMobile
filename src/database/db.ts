import * as SQLite from "expo-sqlite";

export interface Contact {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  favorite?: number;
  created_at?: number;
}

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync("contacts.db");
    await initDatabase();
  }
  return db;
};

const initDatabase = async () => {
  if (!db) return;

  // Tạo bảng contacts nếu chưa có
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      favorite INTEGER DEFAULT 0,
      created_at INTEGER
    );
  `);

  // Seed dữ liệu mẫu nếu bảng trống
  await seedSampleData();
};

const seedSampleData = async () => {
  if (!db) return;

  // Kiểm tra xem đã có dữ liệu chưa
  const countResult = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM contacts"
  );

  // Nếu chưa có dữ liệu, seed 2-3 contact mẫu
  if (countResult && countResult.count === 0) {
    const sampleContacts = [
      { name: "Nguyễn Văn A", phone: "0901234567" },
      { name: "Trần Thị B", phone: "0987654321" },
      { name: "Lê Văn C", phone: "0912345678" },
    ];

    const created_at = Date.now();
    for (const contact of sampleContacts) {
      await db.runAsync(
        "INSERT INTO contacts (name, phone, favorite, created_at) VALUES (?, ?, ?, ?)",
        [contact.name, contact.phone, 0, created_at]
      );
    }
  }
};

export const addContact = async (
  name: string,
  phone?: string,
  email?: string,
  favorite: number = 0
): Promise<number> => {
  const database = await getDatabase();
  const created_at = Date.now();

  const result = await database.runAsync(
    "INSERT INTO contacts (name, phone, email, favorite, created_at) VALUES (?, ?, ?, ?, ?)",
    [name, phone || null, email || null, favorite, created_at]
  );

  return result.lastInsertRowId;
};

export const getAllContacts = async (): Promise<Contact[]> => {
  const database = await getDatabase();
  const result = await database.getAllAsync<Contact>(
    "SELECT * FROM contacts ORDER BY created_at DESC"
  );
  return result;
};

export const getContactById = async (id: number): Promise<Contact | null> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<Contact>(
    "SELECT * FROM contacts WHERE id = ?",
    [id]
  );
  return result || null;
};

export const updateContact = async (
  id: number,
  name?: string,
  phone?: string,
  email?: string,
  favorite?: number
): Promise<void> => {
  const database = await getDatabase();
  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push("name = ?");
    values.push(name);
  }
  if (phone !== undefined) {
    updates.push("phone = ?");
    values.push(phone);
  }
  if (email !== undefined) {
    updates.push("email = ?");
    values.push(email);
  }
  if (favorite !== undefined) {
    updates.push("favorite = ?");
    values.push(favorite);
  }

  if (updates.length > 0) {
    values.push(id);
    await database.runAsync(
      `UPDATE contacts SET ${updates.join(", ")} WHERE id = ?`,
      values
    );
  }
};

export const deleteContact = async (id: number): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM contacts WHERE id = ?", [id]);
};

export const getFavoriteContacts = async (): Promise<Contact[]> => {
  const database = await getDatabase();
  const result = await database.getAllAsync<Contact>(
    "SELECT * FROM contacts WHERE favorite = 1 ORDER BY created_at DESC"
  );
  return result;
};

