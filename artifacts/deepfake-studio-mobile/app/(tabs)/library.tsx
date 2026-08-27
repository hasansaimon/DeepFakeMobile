import { Feather } from "@expo/vector-icons";
import {
  getListFacesetsQueryKey,
  useCreateFaceset,
  useListFacesets,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const facesets = useListFacesets();
  const createFaceset = useCreateFaceset();
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const list = facesets.data?.facesets ?? [];

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Name your faceset", "Add a name before saving.");
      return;
    }
    try {
      await createFaceset.mutateAsync({ data: { name: trimmedName, description: description.trim() || undefined } });
      await queryClient.invalidateQueries({ queryKey: getListFacesetsQueryKey() });
      setModalVisible(false);
      setName("");
      setDescription("");
    } catch {
      Alert.alert("Could not save", "The faceset could not be created right now.");
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 104 }]}
        refreshControl={<RefreshControl refreshing={facesets.isRefetching} onRefresh={() => facesets.refetch()} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View><Text style={[styles.eyebrow, { color: colors.primary }]}>SOURCE LIBRARY</Text><Text style={[styles.title, { color: colors.foreground }]}>Facesets</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Create a faceset" onPress={() => setModalVisible(true)} style={[styles.addButton, { backgroundColor: colors.primary }]}><Feather name="plus" size={20} color={colors.primaryForeground} /></Pressable>
        </View>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>Keep the faces that define your next transformation close.</Text>
        <View style={[styles.libraryNote, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={[styles.noteIcon, { backgroundColor: colors.accent }]}><Feather name="layers" size={17} color={colors.accentForeground} /></View>
          <View style={styles.noteCopy}><Text style={[styles.noteTitle, { color: colors.foreground }]}>One faceset, one point of view</Text><Text style={[styles.noteText, { color: colors.mutedForeground }]}>Use clear, consistent source images for better results.</Text></View>
        </View>
        {facesets.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
        {list.length === 0 && !facesets.isLoading ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}><Feather name="users" size={22} color={colors.primary} /></View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your library is empty</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Create a faceset now, then add source images to begin training.</Text>
            <Pressable onPress={() => setModalVisible(true)} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Create a faceset</Text></Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {list.map((faceset) => (
              <View key={faceset.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.faceIcon, { backgroundColor: colors.secondary }]}><Feather name="users" size={19} color={colors.primary} /></View>
                  <View style={styles.cardCopy}><Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{faceset.name}</Text><Text style={[styles.cardText, { color: colors.mutedForeground }]} numberOfLines={1}>{faceset.description || "A curated source collection"}</Text></View>
                  <View style={[styles.readyPill, { backgroundColor: faceset.status === "ready" ? colors.secondary : colors.muted }]}><View style={[styles.dot, { backgroundColor: faceset.status === "ready" ? colors.primary : colors.accent }]} /><Text style={[styles.readyText, { color: faceset.status === "ready" ? colors.primary : colors.mutedForeground }]}>{formatStatus(faceset.status)}</Text></View>
                </View>
                <View style={[styles.cardBottom, { borderTopColor: colors.border }]}>
                  <View style={styles.stat}><Text style={[styles.statValue, { color: colors.foreground }]}>{faceset.imageCount}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>images</Text></View>
                  <View style={styles.stat}><Text style={[styles.statValue, { color: colors.foreground }]}>{faceset.faceCount}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>faces</Text></View>
                  <View style={styles.cardAction}><Feather name="arrow-up-right" size={17} color={colors.primary} /></View>
                </View>
              </View>
            ))}
          </View>
        )}
      </KeyboardAwareScrollViewCompat>
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <KeyboardAwareScrollViewCompat contentContainerStyle={[styles.modalContent, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}><View><Text style={[styles.eyebrow, { color: colors.primary }]}>NEW COLLECTION</Text><Text style={[styles.modalTitle, { color: colors.foreground }]}>Create a faceset</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close create faceset" onPress={() => setModalVisible(false)} style={styles.close}><Feather name="x" size={22} color={colors.foreground} /></Pressable></View>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Faceset name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Studio portraits" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]} autoCapitalize="words" />
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Description <Text style={{ color: colors.mutedForeground }}>(optional)</Text></Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="A note to future you" placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.multiline, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]} multiline textAlignVertical="top" />
            <View style={[styles.uploadHint, { backgroundColor: colors.secondary }]}><Feather name="upload-cloud" size={18} color={colors.primary} /><Text style={[styles.uploadText, { color: colors.secondaryForeground }]}>Add images from the faceset detail view after creating it.</Text></View>
            <Pressable disabled={createFaceset.isPending} onPress={submit} style={[styles.save, { backgroundColor: colors.primary }]}>{createFaceset.isPending ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.saveText, { color: colors.primaryForeground }]}>Create faceset</Text>}</Pressable>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </View>
  );
}

function formatStatus(status: string) {
  return status === "pending" ? "Pending" : status.charAt(0).toUpperCase() + status.slice(1);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 17 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.7 },
  title: { fontSize: 30, lineHeight: 36, fontFamily: "Inter_700Bold", marginTop: 4 },
  intro: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", marginTop: -6 },
  addButton: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  libraryNote: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", gap: 11, alignItems: "center" },
  noteIcon: { width: 37, height: 37, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  noteCopy: { flex: 1 },
  noteTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  noteText: { fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", marginTop: 3 },
  loader: { marginVertical: 30 },
  list: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 19, padding: 15 },
  cardTop: { flexDirection: "row", alignItems: "center" },
  faceIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 11 },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  cardText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  readyPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, marginLeft: 7 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  readyText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  cardBottom: { borderTopWidth: 1, marginTop: 14, paddingTop: 12, flexDirection: "row", alignItems: "center" },
  stat: { flexDirection: "row", alignItems: "baseline", gap: 4, marginRight: 18 },
  statValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  cardAction: { marginLeft: "auto" },
  empty: { borderWidth: 1, borderRadius: 20, alignItems: "center", padding: 28 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyText: { textAlign: "center", fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", marginTop: 6, maxWidth: 260 },
  primaryButton: { paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12, marginTop: 17 },
  primaryButtonText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  modal: { flex: 1 },
  modalContent: { paddingHorizontal: 20, gap: 11 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  modalTitle: { fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 4 },
  close: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_700Bold", marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 13, minHeight: 48, paddingHorizontal: 14, fontSize: 13, fontFamily: "Inter_400Regular" },
  multiline: { minHeight: 92, paddingTop: 13 },
  uploadHint: { borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 7 },
  uploadText: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: "Inter_500Medium" },
  save: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 17 },
  saveText: { fontSize: 13, fontFamily: "Inter_700Bold" },
});