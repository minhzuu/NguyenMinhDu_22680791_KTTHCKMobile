import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getAllContacts,
  Contact,
  getDatabase,
  addContact,
  updateContact,
  deleteContact,
} from "../database/db";

export default function Page() {
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
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

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleAddContact = useCallback(
    async (name: string, phone?: string, email?: string) => {
      try {
        await addContact(name, phone, email);
        await loadContacts(); // Refresh danh sách
        setModalVisible(false);
      } catch (error) {
        console.error("Error adding contact:", error);
        Alert.alert("Lỗi", "Không thể thêm liên hệ. Vui lòng thử lại.");
      }
    },
    [loadContacts]
  );

  const handleToggleFavorite = useCallback(
    async (id: number, currentFavorite: number) => {
      try {
        const newFavorite = currentFavorite === 1 ? 0 : 1;
        await updateContact(id, undefined, undefined, undefined, newFavorite);
        await loadContacts(); // Refresh danh sách
      } catch (error) {
        console.error("Error toggling favorite:", error);
        Alert.alert("Lỗi", "Không thể cập nhật yêu thích. Vui lòng thử lại.");
      }
    },
    [loadContacts]
  );

  const handleEditContact = useCallback((contact: Contact) => {
    setEditingContact(contact);
    setEditModalVisible(true);
  }, []);

  const handleUpdateContact = useCallback(
    async (id: number, name: string, phone?: string, email?: string) => {
      try {
        await updateContact(id, name, phone, email);
        await loadContacts(); // Refresh danh sách
        setEditModalVisible(false);
        setEditingContact(null);
      } catch (error) {
        console.error("Error updating contact:", error);
        Alert.alert("Lỗi", "Không thể cập nhật liên hệ. Vui lòng thử lại.");
      }
    },
    [loadContacts]
  );

  const handleDeleteContact = useCallback((contact: Contact) => {
    console.log("handleDeleteContact called with:", contact);
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
          onPress: () => console.log("Delete cancelled"),
        },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              console.log("Deleting contact with id:", contact.id);
              await deleteContact(contact.id!);
              console.log("Contact deleted successfully");
              await loadContacts(); // Refresh danh sách
            } catch (error) {
              console.error("Error deleting contact:", error);
              Alert.alert("Lỗi", "Không thể xóa liên hệ. Vui lòng thử lại.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, []);

  const handleImportFromAPI = useCallback(async () => {
    setImporting(true);
    setImportError(null);

    try {
      // API endpoint mẫu - bạn có thể thay đổi URL này
      const response = await fetch(
        "https://67e2d23197fc65f53537ba62.mockapi.io/simple_contact"
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Map dữ liệu từ API response
      // API trả về: { id, name, phone, email, ... }
      const apiContacts = data.map((item: any) => {
        // Xử lý phone: loại bỏ ký tự đặc biệt, chỉ giữ số
        let phone = "";
        if (item.phone) {
          phone = item.phone.replace(/\D/g, ""); // Loại bỏ tất cả ký tự không phải số
        }

        return {
          name: item.name || "",
          phone: phone,
          email: item.email || "",
        };
      });

      // Lấy danh sách contacts hiện tại để kiểm tra trùng lặp
      const currentContacts = await getAllContacts();
      // Normalize phone numbers (chỉ giữ số) để so sánh
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
        if (!contact.phone) return true; // Nếu không có phone thì cho phép thêm
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
          // Chỉ thêm nếu có name
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

  return (
    <View className="flex flex-1">
      <Header />
      <SearchBar
        searchText={searchText}
        onSearchChange={setSearchText}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavorites={setShowFavoritesOnly}
      />
      <ContactsList
        contacts={filteredContacts}
        loading={loading}
        onRefresh={loadContacts}
        onToggleFavorite={handleToggleFavorite}
        onEdit={handleEditContact}
        onDelete={handleDeleteContact}
      />
      <AddContactModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={handleAddContact}
      />
      <EditContactModal
        visible={editModalVisible}
        contact={editingContact}
        onClose={() => {
          setEditModalVisible(false);
          setEditingContact(null);
        }}
        onUpdate={handleUpdateContact}
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.importButton, importing && styles.importButtonDisabled]}
        onPress={handleImportFromAPI}
        disabled={importing}
      >
        <Text style={styles.importButtonText}>
          {importing ? "Đang import..." : "Import từ API"}
        </Text>
      </TouchableOpacity>
      {importError && (
        <View style={styles.importErrorContainer}>
          <Text style={styles.importErrorText}>{importError}</Text>
        </View>
      )}
    </View>
  );
}

function ContactsList({
  contacts,
  loading,
  onRefresh,
  onToggleFavorite,
  onEdit,
  onDelete,
}: {
  contacts: Contact[];
  loading: boolean;
  onRefresh: () => void;
  onToggleFavorite: (id: number, currentFavorite: number) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}) {
  const renderContactItem = ({ item }: { item: Contact }) => {
    const isFavorite = item.favorite === 1;
    const favoriteValue = item.favorite || 0;

    return (
      <View style={styles.contactItem}>
        <TouchableOpacity
          style={styles.contactInfoContainer}
          onLongPress={() => onEdit(item)}
          activeOpacity={0.7}
        >
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{item.name}</Text>
            {item.phone && (
              <Text style={styles.contactPhone}>{item.phone}</Text>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.contactActions}>
          <TouchableOpacity
            onPress={() => onEdit(item)}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Sửa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              console.log("Delete button pressed for:", item);
              onDelete(item);
            }}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteButtonText}>Xóa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (item.id) {
                onToggleFavorite(item.id, favoriteValue);
              }
            }}
            style={styles.favoriteButton}
          >
            <Text style={styles.favoriteIcon}>{isFavorite ? "★" : "☆"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Chưa có liên hệ nào.</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={contacts}
        renderItem={renderContactItem}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={
          contacts.length === 0 ? styles.emptyListContainer : undefined
        }
      />
    </View>
  );
}

function AddContactModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, phone?: string, email?: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const validate = (): boolean => {
    const newErrors: { name?: string; email?: string } = {};

    // Validate name (bắt buộc)
    if (!name.trim()) {
      newErrors.name = "Tên không được để trống";
    }

    // Validate email (nếu có thì phải có @)
    if (email.trim() && !email.includes("@")) {
      newErrors.email = "Email phải chứa ký tự @";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onAdd(name.trim(), phone.trim() || undefined, email.trim() || undefined);
      // Reset form
      setName("");
      setPhone("");
      setEmail("");
      setErrors({});
    }
  };

  const handleClose = () => {
    setName("");
    setPhone("");
    setEmail("");
    setErrors({});
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.modalContainer}
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Thêm liên hệ mới</Text>

          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="Tên *"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name) {
                setErrors({ ...errors, name: undefined });
              }
            }}
            placeholderTextColor="#9ca3af"
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

          <TextInput
            style={styles.input}
            placeholder="Số điện thoại"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor="#9ca3af"
          />

          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) {
                setErrors({ ...errors, email: undefined });
              }
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#9ca3af"
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>
                Hủy
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
            >
              <Text style={[styles.buttonText, styles.saveButtonText]}>
                Lưu
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function EditContactModal({
  visible,
  contact,
  onClose,
  onUpdate,
}: {
  visible: boolean;
  contact: Contact | null;
  onClose: () => void;
  onUpdate: (id: number, name: string, phone?: string, email?: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  // Cập nhật form khi contact thay đổi
  useEffect(() => {
    if (contact) {
      setName(contact.name || "");
      setPhone(contact.phone || "");
      setEmail(contact.email || "");
      setErrors({});
    }
  }, [contact]);

  const validate = (): boolean => {
    const newErrors: { name?: string; email?: string } = {};

    // Validate name (bắt buộc)
    if (!name.trim()) {
      newErrors.name = "Tên không được để trống";
    }

    // Validate email (nếu có thì phải có @)
    if (email.trim() && !email.includes("@")) {
      newErrors.email = "Email phải chứa ký tự @";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate() && contact?.id) {
      onUpdate(
        contact.id,
        name.trim(),
        phone.trim() || undefined,
        email.trim() || undefined
      );
    }
  };

  const handleClose = () => {
    setName("");
    setPhone("");
    setEmail("");
    setErrors({});
    onClose();
  };

  if (!contact) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.modalContainer}
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Sửa liên hệ</Text>

          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="Tên *"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name) {
                setErrors({ ...errors, name: undefined });
              }
            }}
            placeholderTextColor="#9ca3af"
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

          <TextInput
            style={styles.input}
            placeholder="Số điện thoại"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor="#9ca3af"
          />

          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) {
                setErrors({ ...errors, email: undefined });
              }
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#9ca3af"
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>
                Hủy
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
            >
              <Text style={[styles.buttonText, styles.saveButtonText]}>
                Cập nhật
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function SearchBar({
  searchText,
  onSearchChange,
  showFavoritesOnly,
  onToggleFavorites,
}: {
  searchText: string;
  onSearchChange: (text: string) => void;
  showFavoritesOnly: boolean;
  onToggleFavorites: (value: boolean) => void;
}) {
  return (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm theo tên hoặc số điện thoại..."
          value={searchText}
          onChangeText={onSearchChange}
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => onSearchChange("")}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        onPress={() => onToggleFavorites(!showFavoritesOnly)}
        style={[
          styles.favoriteFilterButton,
          showFavoritesOnly && styles.favoriteFilterButtonActive,
        ]}
      >
        <Text
          style={[
            styles.favoriteFilterText,
            showFavoritesOnly && styles.favoriteFilterTextActive,
          ]}
        >
          {showFavoritesOnly ? "★" : "☆"} Yêu thích
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function Header() {
  const { top } = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: top, backgroundColor: "#f3f4f6" }}>
      <View className="px-4 lg:px-6 h-14 flex items-center flex-row justify-between border-b border-gray-200">
        <Text className="font-bold text-xl text-gray-900">
          Danh sách liên hệ
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  contactInfoContainer: {
    flex: 1,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: "#6b7280",
  },
  contactActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#e5e7eb",
    marginRight: 8,
  },
  editButtonText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#fee2e2",
    marginRight: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    color: "#dc2626",
    fontWeight: "500",
  },
  favoriteButton: {
    padding: 8,
  },
  favoriteIcon: {
    fontSize: 24,
    color: "#fbbf24",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 40,
  },
  addButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  addButtonText: {
    fontSize: 32,
    color: "#ffffff",
    fontWeight: "300",
    lineHeight: 32,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 24,
    width: "90%",
    maxWidth: 400,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: "#ffffff",
  },
  inputError: {
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: -12,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f3f4f6",
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: "#3b82f6",
    marginLeft: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButtonText: {
    color: "#374151",
  },
  saveButtonText: {
    color: "#ffffff",
  },
  searchContainer: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#f9fafb",
  },
  clearButton: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
  clearButtonText: {
    fontSize: 18,
    color: "#6b7280",
    fontWeight: "300",
  },
  favoriteFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    alignSelf: "flex-start",
  },
  favoriteFilterButtonActive: {
    backgroundColor: "#fef3c7",
  },
  favoriteFilterText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  favoriteFilterTextActive: {
    color: "#92400e",
    fontWeight: "600",
  },
  importButton: {
    position: "absolute",
    left: 20,
    bottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#10b981",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  importButtonDisabled: {
    backgroundColor: "#9ca3af",
    opacity: 0.6,
  },
  importButtonText: {
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "600",
  },
  importErrorContainer: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: "#fee2e2",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dc2626",
  },
  importErrorText: {
    fontSize: 14,
    color: "#dc2626",
    textAlign: "center",
  },
});
