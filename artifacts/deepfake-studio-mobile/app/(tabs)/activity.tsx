import { Feather } from "@expo/vector-icons";
import {
  getListJobsQueryKey,
  useCancelJob,
  useListJobs,
  useSubmitJob,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";

export default function ActivityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const jobs = useListJobs();
  const submitJob = useSubmitJob();
  const cancelJob = useCancelJob();
  const list = jobs.data?.jobs ?? [];

  const updateJobs = async () => {
    await queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
  };

  const submit = async (id: string) => {
    try {
      await submitJob.mutateAsync({ id });
      await updateJobs();
    } catch {
      Alert.alert("Could not submit", "This project needs a model and source media before it can run.");
    }
  };

  const cancel = async (id: string) => {
    try {
      await cancelJob.mutateAsync({ id });
      await updateJobs();
    } catch {
      Alert.alert("Could not cancel", "This project may already be complete.");
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 104 }]}
        refreshControl={<RefreshControl refreshing={jobs.isRefetching} onRefresh={() => jobs.refetch()} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}><View><Text style={[styles.eyebrow, { color: colors.primary }]}>WORK QUEUE</Text><Text style={[styles.title, { color: colors.foreground }]}>Activity</Text></View><View style={[styles.queueIcon, { backgroundColor: colors.secondary }]}><Feather name="activity" size={19} color={colors.primary} /></View></View>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>Every draft, render, and training run in one place.</Text>
        <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SummaryItem value={`${list.filter((job) => job.status === "processing").length}`} label="processing" colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SummaryItem value={`${list.filter((job) => job.status === "queued" || job.status === "draft").length}`} label="queued" colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SummaryItem value={`${list.filter((job) => job.status === "completed").length}`} label="complete" colors={colors} />
        </View>
        {jobs.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
        {list.length === 0 && !jobs.isLoading ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}><Feather name="clock" size={22} color={colors.primary} /></View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing in the queue</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>When you start a project, its progress will stay right here.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {list.map((job) => {
              const isPending = submitJob.isPending || cancelJob.isPending;
              const isRunning = job.status === "processing" || job.status === "queued";
              return (
                <View key={job.id} style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.jobTop}>
                    <View style={[styles.jobIcon, { backgroundColor: colors.secondary }]}><Feather name={job.type.includes("video") ? "film" : "image"} size={19} color={colors.primary} /></View>
                    <View style={styles.jobCopy}><Text style={[styles.jobTitle, { color: colors.foreground }]}>{formatType(job.type)}</Text><Text style={[styles.jobDate, { color: colors.mutedForeground }]}>{formatDate(job.createdAt)}</Text></View>
                    <View style={[styles.status, { backgroundColor: getStatusColor(job.status, colors) }]}><Text style={[styles.statusText, { color: getStatusTextColor(job.status, colors) }]}>{formatStatus(job.status)}</Text></View>
                  </View>
                  {isRunning ? <><View style={[styles.progressTrack, { backgroundColor: colors.muted }]}><View style={[styles.progress, { width: `${Math.max(job.progressPercent, 4)}%`, backgroundColor: colors.primary }]} /></View><View style={styles.progressRow}><Text style={[styles.progressText, { color: colors.mutedForeground }]}>{job.progressPercent}% complete</Text><Pressable disabled={isPending} onPress={() => cancel(job.id)}><Text style={[styles.cancelText, { color: colors.destructive }]}>Cancel</Text></Pressable></View></> : job.status === "draft" ? <Pressable disabled={isPending} onPress={() => submit(job.id)} style={[styles.submitButton, { backgroundColor: colors.primary }]}>{isPending ? <ActivityIndicator color={colors.primaryForeground} /> : <><Text style={[styles.submitText, { color: colors.primaryForeground }]}>Submit project</Text><Feather name="arrow-right" size={15} color={colors.primaryForeground} /></>}</Pressable> : job.errorMessage ? <Text style={[styles.errorText, { color: colors.destructive }]}>{job.errorMessage}</Text> : null}
                </View>
              );
            })}
          </View>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function SummaryItem({ value, label, colors }: { value: string; label: string; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.summaryItem}><Text style={[styles.summaryValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text></View>;
}

function formatType(type: string) {
  return type.startsWith("swap_video") ? "Video transformation" : type === "swap_image" ? "Image transformation" : type.replaceAll("_", " ");
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Just now" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getStatusColor(status: string, colors: ReturnType<typeof useColors>) {
  if (status === "completed") return colors.secondary;
  if (status === "failed") return colors.muted;
  if (status === "draft") return colors.accent;
  return colors.muted;
}

function getStatusTextColor(status: string, colors: ReturnType<typeof useColors>) {
  if (status === "completed") return colors.primary;
  if (status === "failed") return colors.destructive;
  if (status === "draft") return colors.accentForeground;
  return colors.mutedForeground;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 17 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1.7 },
  title: { fontSize: 30, lineHeight: 36, fontFamily: "Inter_700Bold", marginTop: 4 },
  intro: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", marginTop: -6 },
  queueIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  summary: { borderWidth: 1, borderRadius: 18, paddingVertical: 16, flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  summaryItem: { alignItems: "center", minWidth: 70 },
  summaryValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 3 },
  divider: { height: 28, width: 1 },
  loader: { marginVertical: 30 },
  list: { gap: 12 },
  jobCard: { borderWidth: 1, borderRadius: 19, padding: 15 },
  jobTop: { flexDirection: "row", alignItems: "center" },
  jobIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 11 },
  jobCopy: { flex: 1 },
  jobTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  jobDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  status: { borderRadius: 8, paddingVertical: 5, paddingHorizontal: 8 },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 16 },
  progress: { height: "100%", borderRadius: 3 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 7 },
  progressText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  cancelText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  submitButton: { borderRadius: 12, minHeight: 40, marginTop: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  submitText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  errorText: { fontSize: 11, lineHeight: 17, fontFamily: "Inter_500Medium", marginTop: 13 },
  empty: { borderWidth: 1, borderRadius: 20, alignItems: "center", padding: 28 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyText: { textAlign: "center", fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", marginTop: 6, maxWidth: 260 },
});