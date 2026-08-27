import { Feather } from "@expo/vector-icons";
import {
  getListFacesetsQueryKey,
  getListJobsQueryKey,
  getListModelsQueryKey,
  useCreateJob,
  useListFacesets,
  useListJobs,
  useListModels,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type QuickActionProps = {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  detail: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
};

function QuickAction({ icon, title, detail, onPress, colors }: QuickActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={[styles.actionTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.actionDetail, { color: colors.mutedForeground }]}>{detail}</Text>
      <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} style={styles.actionArrow} />
    </Pressable>
  );
}

function Metric({ value, label, colors }: { value: string; label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function StatusDot({ status, colors }: { status: string; colors: ReturnType<typeof useColors> }) {
  const dotColor =
    status === "completed" || status === "ready"
      ? colors.primary
      : status === "failed"
        ? colors.destructive
        : colors.accent;
  return <View style={[styles.statusDot, { backgroundColor: dotColor }]} />;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showQuickStart, setShowQuickStart] = useState(false);
  const models = useListModels();
  const facesets = useListFacesets();
  const jobs = useListJobs();
  const createJob = useCreateJob();

  const modelList = models.data?.models ?? [];
  const facesetList = facesets.data?.facesets ?? [];
  const jobList = jobs.data?.jobs ?? [];
  const activeJobs = jobList.filter((job) => job.status === "processing" || job.status === "queued");
  const recentJobs = jobList.slice(0, 3);
  const isRefreshing = models.isRefetching || facesets.isRefetching || jobs.isRefetching;
  const hasError = models.isError || facesets.isError || jobs.isError;

  const initials = useMemo(() => "DS", []);

  const refresh = async () => {
    await Promise.all([models.refetch(), facesets.refetch(), jobs.refetch()]);
  };

  const startDraft = async (type: "swap_image" | "swap_video_small") => {
    try {
      await createJob.mutateAsync({ data: { type } });
      await queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
      setShowQuickStart(false);
      Alert.alert("Draft ready", "Your new project is ready in Activity.");
      router.push("/activity");
    } catch {
      Alert.alert("Could not start", "The project could not be created right now.");
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 104 }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>DEEPFAKE STUDIO</Text>
            <Text style={[styles.greeting, { color: colors.foreground }]}>Your creative lab</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
          </View>
        </View>

        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroGlow} />
          <Text style={[styles.heroKicker, { color: colors.primaryForeground }]}>MAKE THE CUT</Text>
          <Text style={[styles.heroTitle, { color: colors.primaryForeground }]}>
            Turn a good idea into a{"\n"}frame worth keeping.
          </Text>
          <Text style={[styles.heroText, { color: colors.primaryForeground }]}>
            Build facesets, train your model, and create your next transformation.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a new project"
            onPress={() => setShowQuickStart(true)}
            style={({ pressed }) => [styles.heroButton, { backgroundColor: colors.primaryForeground }, pressed && styles.pressed]}
          >
            <Text style={[styles.heroButtonText, { color: colors.primary }]}>Start a project</Text>
            <Feather name="arrow-right" size={17} color={colors.primary} />
          </Pressable>
        </LinearGradient>

        <View style={[styles.metrics, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Metric value={`${modelList.length}`} label="models" colors={colors} />
          <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
          <Metric value={`${facesetList.length}`} label="facesets" colors={colors} />
          <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
          <Metric value={`${activeJobs.length}`} label="in progress" colors={colors} />
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Create something</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>Pick up where your idea starts</Text>
          </View>
          <Feather name="star" size={19} color={colors.accent} />
        </View>
        <View style={styles.actionsGrid}>
          <QuickAction icon="image" title="Swap an image" detail="Start with a still" onPress={() => startDraft("swap_image")} colors={colors} />
          <QuickAction icon="film" title="Swap a video" detail="Bring motion to life" onPress={() => startDraft("swap_video_small")} colors={colors} />
          <QuickAction icon="cpu" title="Train a model" detail="Teach your look" onPress={() => router.push("/models")} colors={colors} />
          <QuickAction icon="layers" title="Build a faceset" detail="Organize source faces" onPress={() => router.push("/library")} colors={colors} />
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent activity</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>Your latest work, at a glance</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="See all activity" onPress={() => router.push("/activity")}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </Pressable>
        </View>
        <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {hasError ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Connect to the studio to load your activity.</Text>
          ) : recentJobs.length === 0 ? (
            <View style={styles.emptyBlock}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="activity" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your canvas is clear</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Start a project and your work will appear here.</Text>
            </View>
          ) : (
            recentJobs.map((job, index) => (
              <View key={job.id} style={[styles.activityRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={[styles.jobIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name={job.type.includes("video") ? "film" : "image"} size={17} color={colors.primary} />
                </View>
                <View style={styles.jobCopy}>
                  <Text style={[styles.jobTitle, { color: colors.foreground }]} numberOfLines={1}>{formatJobType(job.type)}</Text>
                  <Text style={[styles.jobMeta, { color: colors.mutedForeground }]}>{formatDate(job.createdAt)}</Text>
                </View>
                <View style={styles.jobStatus}>
                  <StatusDot status={job.status} colors={colors} />
                  <Text style={[styles.statusText, { color: colors.mutedForeground }]}>{formatStatus(job.status)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {showQuickStart ? (
        <View style={styles.quickStartOverlay}>
          <Pressable style={styles.overlayDismiss} onPress={() => setShowQuickStart(false)} accessibilityLabel="Close project picker" />
          <View style={[styles.quickStartSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 22 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>What are you making?</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>Choose a starting point. You can add your media next.</Text>
            <Pressable style={[styles.sheetOption, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => startDraft("swap_image")}>
              <View style={[styles.sheetOptionIcon, { backgroundColor: colors.secondary }]}><Feather name="image" size={20} color={colors.primary} /></View>
              <View style={styles.sheetOptionCopy}><Text style={[styles.sheetOptionTitle, { color: colors.foreground }]}>Image transformation</Text><Text style={[styles.sheetOptionText, { color: colors.mutedForeground }]}>A focused still frame</Text></View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
            <Pressable style={[styles.sheetOption, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => startDraft("swap_video_small")}>
              <View style={[styles.sheetOptionIcon, { backgroundColor: colors.secondary }]}><Feather name="film" size={20} color={colors.primary} /></View>
              <View style={styles.sheetOptionCopy}><Text style={[styles.sheetOptionTitle, { color: colors.foreground }]}>Video transformation</Text><Text style={[styles.sheetOptionText, { color: colors.mutedForeground }]}>A short moving scene</Text></View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
            {createJob.isPending ? <ActivityIndicator color={colors.primary} style={styles.sheetLoader} /> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function formatJobType(type: string) {
  return type.startsWith("swap_video") ? "Video transformation" : type === "swap_image" ? "Image transformation" : type.replaceAll("_", " ");
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 22 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1.8 },
  greeting: { fontSize: 27, lineHeight: 33, fontFamily: "Inter_700Bold", marginTop: 5 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  hero: { borderRadius: 26, padding: 22, minHeight: 222, overflow: "hidden", justifyContent: "flex-end" },
  heroGlow: { position: "absolute", width: 170, height: 170, borderRadius: 85, right: -42, top: -50, backgroundColor: "rgba(255,255,255,0.15)" },
  heroKicker: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.8, opacity: 0.78 },
  heroTitle: { fontSize: 27, lineHeight: 31, fontFamily: "Inter_700Bold", marginTop: 7 },
  heroText: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", maxWidth: 295, marginTop: 9, opacity: 0.86 },
  heroButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 12, paddingHorizontal: 15, borderRadius: 14, marginTop: 17 },
  heroButtonText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  metrics: { borderWidth: 1, borderRadius: 18, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  metric: { alignItems: "center", minWidth: 78 },
  metricValue: { fontSize: 21, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 3 },
  metricDivider: { width: 1, height: 28 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  sectionTitle: { fontSize: 19, fontFamily: "Inter_700Bold" },
  sectionSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  seeAll: { fontSize: 12, fontFamily: "Inter_700Bold" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  actionCard: { borderWidth: 1, borderRadius: 18, padding: 14, width: "48.2%", minHeight: 139, position: "relative" },
  actionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  actionTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  actionDetail: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  actionArrow: { position: "absolute", right: 14, top: 16 },
  activityCard: { borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  activityRow: { flexDirection: "row", alignItems: "center", padding: 14, minHeight: 73 },
  jobIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 11 },
  jobCopy: { flex: 1, minWidth: 0 },
  jobTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  jobMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  jobStatus: { alignItems: "flex-end", gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  emptyBlock: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 20 },
  emptyIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  emptyTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  emptyText: { textAlign: "center", fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", marginTop: 5 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  quickStartOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  overlayDismiss: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,32,31,0.48)" },
  quickStartSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  sheetHandle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, marginBottom: 8 },
  sheetTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  sheetSubtitle: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", marginBottom: 4 },
  sheetOption: { borderWidth: 1, borderRadius: 17, flexDirection: "row", alignItems: "center", padding: 13 },
  sheetOptionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 12 },
  sheetOptionCopy: { flex: 1 },
  sheetOptionTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  sheetOptionText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  sheetLoader: { marginTop: 2 },
});