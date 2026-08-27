import { Feather } from "@expo/vector-icons";
import {
  getListModelsQueryKey,
  useCreateModel,
  useListFacesets,
  useListModels,
  useTrainModel,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
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

export default function ModelsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const models = useListModels();
  const facesets = useListFacesets();
  const createModel = useCreateModel();
  const trainModel = useTrainModel();
  const [isModalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFacesetId, setSelectedFacesetId] = useState<string | undefined>();

  const modelList = models.data?.models ?? [];
  const facesetList = facesets.data?.facesets ?? [];

  const resetForm = () => {
    setName("");
    setDescription("");
    setSelectedFacesetId(facesetList[0]?.id);
  };

  const submitModel = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Name your model", "Add a name before saving.");
      return;
    }
    try {
      await createModel.mutateAsync({
        data: {
          name: trimmedName,
          description: description.trim() || undefined,
          facesetId: selectedFacesetId,
          qualityPreset: "balanced",
          resolution: "256",
          targetIterations: 1000,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListModelsQueryKey() });
      setModalVisible(false);
      resetForm();
    } catch {
      Alert.alert("Could not save", "The model could not be created right now.");
    }
  };

  const train = async (id: string) => {
    try {
      await trainModel.mutateAsync({ id, data: { iterations: 1000, batchSize: 4, saveInterval: 250 } });
      await queryClient.invalidateQueries({ queryKey: getListModelsQueryKey() });
    } catch {
      Alert.alert("Training unavailable", "Add a ready faceset to this model before training.");
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 104 }]}
        refreshControl={<RefreshControl refreshing={models.isRefetching} onRefresh={() => models.refetch()} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR LAB</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Models</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Create a model" onPress={() => { resetForm(); setModalVisible(true); }} style={[styles.addButton, { backgroundColor: colors.primary }]}>
            <Feather name="plus" size={20} color={colors.primaryForeground} />
          </Pressable>
        </View>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>Your trained looks, ready when inspiration strikes.</Text>

        <View style={[styles.banner, { backgroundColor: colors.secondary }]}>
          <View style={[styles.bannerIcon, { backgroundColor: colors.primary }]}>
            <Feather name="cpu" size={18} color={colors.primaryForeground} />
          </View>
          <View style={styles.bannerCopy}>
            <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Train with intention</Text>
            <Text style={[styles.bannerText, { color: colors.mutedForeground }]}>A ready faceset gives every model a stronger point of view.</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open faceset library" onPress={() => router.push("/library")}>
            <Feather name="arrow-up-right" size={18} color={colors.primary} />
          </Pressable>
        </View>

        {models.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
        {modelList.length === 0 && !models.isLoading ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}><Feather name="aperture" size={22} color={colors.primary} /></View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No models yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Create a model and connect a faceset to start training.</Text>
            <Pressable onPress={() => { resetForm(); setModalVisible(true); }} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Create your first model</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {modelList.map((model) => {
              const isBusy = model.status === "queued" || model.status === "training";
              const progress = Math.min(100, Math.round((model.iterations / Math.max(model.targetIterations, 1)) * 100));
              return (
                <View key={model.id} style={[styles.modelCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cardTop}>
                    <View style={[styles.modelIcon, { backgroundColor: model.status === "ready" ? colors.secondary : colors.muted }]}>
                      <Feather name={model.status === "ready" ? "check" : "cpu"} size={20} color={model.status === "ready" ? colors.primary : colors.mutedForeground} />
                    </View>
                    <View style={styles.modelCopy}>
                      <Text style={[styles.modelName, { color: colors.foreground }]} numberOfLines={1}>{model.name}</Text>
                      <Text style={[styles.modelDescription, { color: colors.mutedForeground }]} numberOfLines={1}>{model.description || "Balanced 256px model"}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: model.status === "ready" ? colors.secondary : colors.muted }]}>
                      <Text style={[styles.statusPillText, { color: model.status === "ready" ? colors.primary : colors.mutedForeground }]}>{formatStatus(model.status)}</Text>
                    </View>
                  </View>
                  <View style={styles.modelMeta}>
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{model.faceCount} faces</Text>
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>256px</Text>
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{model.qualityPreset}</Text>
                  </View>
                  {isBusy ? (
                    <View style={styles.progressArea}>
                      <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.max(progress, 5)}%` }]} /></View>
                      <Text style={[styles.progressText, { color: colors.mutedForeground }]}>{progress}% trained</Text>
                    </View>
                  ) : model.status === "untrained" ? (
                    <Pressable disabled={trainModel.isPending} onPress={() => train(model.id)} style={[styles.trainButton, { backgroundColor: colors.primary }]}>
                      {trainModel.isPending ? <ActivityIndicator color={colors.primaryForeground} /> : <><Feather name="play" size={15} color={colors.primaryForeground} /><Text style={[styles.trainButtonText, { color: colors.primaryForeground }]}>Start training</Text></>}
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </KeyboardAwareScrollViewCompat>

      <Modal visible={isModalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.background }]}>
          <KeyboardAwareScrollViewCompat contentContainerStyle={[styles.modalContent, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <View><Text style={[styles.eyebrow, { color: colors.primary }]}>NEW CREATION</Text><Text style={[styles.modalTitle, { color: colors.foreground }]}>Create a model</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close create model" onPress={() => setModalVisible(false)} style={styles.closeButton}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Model name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Editorial look" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]} autoCapitalize="words" />
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Description <Text style={{ color: colors.mutedForeground }}>(optional)</Text></Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="What makes this look yours?" placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.multiline, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]} multiline textAlignVertical="top" />
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Faceset</Text>
            {facesetList.length === 0 ? (
              <View style={[styles.noFaceset, { backgroundColor: colors.muted }]}><Text style={[styles.noFacesetText, { color: colors.mutedForeground }]}>Create a faceset first in Library.</Text></View>
            ) : facesetList.map((faceset) => (
              <Pressable key={faceset.id} onPress={() => setSelectedFacesetId(faceset.id)} style={[styles.facesetOption, { backgroundColor: selectedFacesetId === faceset.id ? colors.secondary : colors.card, borderColor: selectedFacesetId === faceset.id ? colors.primary : colors.border }]}>
                <View style={[styles.radio, { borderColor: selectedFacesetId === faceset.id ? colors.primary : colors.input }]}>{selectedFacesetId === faceset.id ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}</View>
                <Text style={[styles.facesetName, { color: colors.foreground }]}>{faceset.name}</Text>
                <Text style={[styles.facesetCount, { color: colors.mutedForeground }]}>{faceset.faceCount} faces</Text>
              </Pressable>
            ))}
            <Pressable disabled={createModel.isPending} onPress={submitModel} style={[styles.saveButton, { backgroundColor: colors.primary }]}>
              {createModel.isPending ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>Create model</Text>}
            </Pressable>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </View>
  );
}

function formatStatus(status: string) {
  return status === "untrained" ? "Not trained" : status.charAt(0).toUpperCase() + status.slice(1);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 17 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.7 },
  title: { fontSize: 30, lineHeight: 36, fontFamily: "Inter_700Bold", marginTop: 4 },
  intro: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", marginTop: -6 },
  addButton: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  banner: { borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 11 },
  bannerIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  bannerCopy: { flex: 1 },
  bannerTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  bannerText: { fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", marginTop: 3 },
  loader: { marginVertical: 30 },
  list: { gap: 12 },
  modelCard: { borderWidth: 1, borderRadius: 19, padding: 15 },
  cardTop: { flexDirection: "row", alignItems: "center" },
  modelIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 11 },
  modelCopy: { flex: 1, minWidth: 0 },
  modelName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  modelDescription: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  statusPill: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, marginLeft: 8 },
  statusPillText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  modelMeta: { flexDirection: "row", gap: 14, marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(128,150,145,0.18)" },
  metaText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  progressArea: { marginTop: 14 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 6 },
  trainButton: { marginTop: 14, borderRadius: 12, minHeight: 39, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  trainButtonText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  empty: { borderWidth: 1, borderRadius: 20, alignItems: "center", padding: 28, marginTop: 3 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyText: { textAlign: "center", fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", marginTop: 6, maxWidth: 260 },
  primaryButton: { paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12, marginTop: 17 },
  primaryButtonText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  modalBackdrop: { flex: 1 },
  modalContent: { paddingHorizontal: 20, gap: 11 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  modalTitle: { fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 4 },
  closeButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_700Bold", marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 13, minHeight: 48, paddingHorizontal: 14, fontSize: 13, fontFamily: "Inter_400Regular" },
  multiline: { minHeight: 92, paddingTop: 13 },
  noFaceset: { borderRadius: 13, padding: 14 },
  noFacesetText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  facesetOption: { borderWidth: 1, borderRadius: 13, padding: 12, flexDirection: "row", alignItems: "center" },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginRight: 10 },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  facesetName: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  facesetCount: { fontSize: 11, fontFamily: "Inter_400Regular" },
  saveButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, marginTop: 17 },
  saveButtonText: { fontSize: 13, fontFamily: "Inter_700Bold" },
});