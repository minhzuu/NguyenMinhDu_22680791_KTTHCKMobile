import { useState, useCallback, useMemo } from "react";
import { Alert } from "react-native";
import {
  getAllContacts,
  Contact,
  getDatabase,
  addContact,
  updateContact,
  deleteContact,
} from "../database/db";

export const useContacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      await getDatabase();
      const allContacts = await getAllContacts();
      setContacts(allContacts);
    } catch (error) {
      console.error("Error loading contacts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddContact = useCallback(
    async (name: string, phone?: string, email?: string) => {
      try {
        await addContact(name, phone, email);
        await loadContacts();
      } catch (error) {
        console.error("Error adding contact:", error);
        Alert.alert("Lỗi", "Không thể thêm liên hệ. Vui lòng thử lại.");
        throw error;
      }
    },
    [loadContacts]
  );

  const handleUpdateContact = useCallback(
    async (id: number, name: string, phone?: string, email?: string) => {
      try {
        await updateContact(id, name, phone, email);
        await loadContacts();
      } catch (error) {
        console.error("Error updating contact:", error);
        Alert.alert("Lỗi", "Không thể cập nhật liên hệ. Vui lòng thử lại.");
        throw error;
      }
    },
    [loadContacts]
  );

  const handleToggleFavorite = useCallback(
    async (id: number, currentFavorite: number) => {
      try {
        const newFavorite = currentFavorite === 1 ? 0 : 1;
        await updateContact(id, undefined, undefined, undefined, newFavorite);
        await loadContacts();
      } catch (error) {
        console.error("Error toggling favorite:", error);
        Alert.alert("Lỗi", "Không thể cập nhật yêu thích. Vui lòng thử lại.");
        throw error;
      }
    },
    [loadContacts]
  );

  const handleDeleteContact = useCallback(
    (contact: Contact) => {
      if (!contact || !contact.id) {
        console.error("Invalid contact for deletion");
        return;
      }

      Alert.alert(
        "Xác nhận xóa",
        `Bạn có chắc chắn muốn xóa liên hệ "${contact.name}"?`,
        [
          {
            text: "Hủy",
            style: "cancel",
          },
          {
            text: "Xóa",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteContact(contact.id!);
                await loadContacts();
              } catch (error) {
                console.error("Error deleting contact:", error);
                Alert.alert("Lỗi", "Không thể xóa liên hệ. Vui lòng thử lại.");
              }
            },
          },
        ],
        { cancelable: true }
      );
    },
    [loadContacts]
  );

  const handleImportFromAPI = useCallback(async () => {
    setImporting(true);
    setImportError(null);

    try {
      const response = await fetch(
        "https://67e2d23197fc65f53537ba62.mockapi.io/simple_contact"
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Map dữ liệu từ API response
      const apiContacts = data.map((item: any) => {
        let phone = "";
        if (item.phone) {
          phone = item.phone.replace(/\D/g, "");
        }

        return {
          name: item.name || "",
          phone: phone,
          email: item.email || "",
        };
      });

      // Lấy danh sách contacts hiện tại để kiểm tra trùng lặp
      const currentContacts = await getAllContacts();
      const existingPhones = new Set(
        currentContacts
          .map((c) => {
            if (c.phone) {
              return c.phone.replace(/\D/g, "");
            }
            return "";
          })
          .filter((phone) => phone.length > 0)
      );

      // Lọc bỏ các contact trùng lặp (theo phone)
      const newContacts = apiContacts.filter((contact: { phone?: string }) => {
        if (!contact.phone) return true;
        const normalizedPhone = contact.phone.replace(/\D/g, "");
        return (
          normalizedPhone.length === 0 || !existingPhones.has(normalizedPhone)
        );
      });

      // Thêm các contact mới vào database
      let addedCount = 0;
      let skippedCount = apiContacts.length - newContacts.length;

      for (const contact of newContacts) {
        if (contact.name) {
          await addContact(contact.name, contact.phone, contact.email);
          addedCount++;
        }
      }

      // Refresh danh sách
      await loadContacts();

      // Hiển thị kết quả
      Alert.alert(
        "Import thành công",
        `Đã thêm ${addedCount} liên hệ mới.${
          skippedCount > 0 ? ` Bỏ qua ${skippedCount} liên hệ trùng lặp.` : ""
        }`
      );
    } catch (error) {
      console.error("Error importing contacts:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Không thể import liên hệ. Vui lòng thử lại.";
      setImportError(errorMessage);
      Alert.alert("Lỗi", errorMessage);
    } finally {
      setImporting(false);
    }
  }, [loadContacts]);

  // Filter contacts với useMemo để tối ưu performance
  const filteredContacts = useMemo(() => {
    let result = contacts;

    // Filter theo favorite nếu bật
    if (showFavoritesOnly) {
      result = result.filter((contact) => contact.favorite === 1);
    }

    // Filter theo search text (name hoặc phone)
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      result = result.filter(
        (contact) =>
          contact.name.toLowerCase().includes(searchLower) ||
          (contact.phone && contact.phone.includes(searchText.trim()))
      );
    }

    return result;
  }, [contacts, searchText, showFavoritesOnly]);

  return {
    // State
    contacts,
    filteredContacts,
    loading,
    searchText,
    showFavoritesOnly,
    importing,
    importError,
    // Actions
    loadContacts,
    setSearchText,
    setShowFavoritesOnly,
    handleAddContact,
    handleUpdateContact,
    handleToggleFavorite,
    handleDeleteContact,
    handleImportFromAPI,
  };
};

