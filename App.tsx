import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { mockChannels, mockHealth, mockJobs, mockSessions } from './src/mock/data';
import { GatewayWsClient } from './src/services/gatewayWs';
import { ChannelItem, GatewayHealth, JobItem, SessionItem } from './src/types';

type TabKey = 'dashboard' | 'jobs' | 'sessions' | 'channels' | 'settings';

const STORAGE_KEYS = {
  gatewayUrl: 'mission_control.gateway_url',
  gatewayToken: 'mission_control.gateway_token',
};

const tabs: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Home' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'channels', label: 'Channels' },
  { key: 'settings', label: 'Settings' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [jobs, setJobs] = useState<JobItem[]>(mockJobs);
  const [channels, setChannels] = useState<ChannelItem[]>(mockChannels);
  const [sessions, setSessions] = useState<SessionItem[]>(mockSessions);
  const [health, setHealth] = useState<GatewayHealth>(mockHealth);

  const [gatewayUrl, setGatewayUrl] = useState('');
  const [token, setToken] = useState('');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [liveMode, setLiveMode] = useState(false);

  const [hydrating, setHydrating] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedUrl, savedToken] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.gatewayUrl),
          AsyncStorage.getItem(STORAGE_KEYS.gatewayToken),
        ]);

        if (savedUrl) {
          setGatewayUrl(savedUrl);
          setLiveMode(true);
        }
        if (savedToken) setToken(savedToken);
        setNeedsOnboarding(!savedUrl);
      } finally {
        setHydrating(false);
      }
    };

    loadSettings();
  }, []);

  const normalizeJobs = (input: any): JobItem[] => {
    const rows = Array.isArray(input?.jobs) ? input.jobs : Array.isArray(input) ? input : [];
    return rows.slice(0, 50).map((j: any, idx: number) => ({
      id: String(j.id ?? j.jobId ?? `job-${idx}`),
      name: String(j.name ?? j.title ?? 'Unnamed job'),
      status: (j.status ?? (j.running ? 'running' : 'queued')) as JobItem['status'],
      startedAt: String(j.startedAt ?? j.updatedAt ?? j.nextRunAt ?? '—'),
    }));
  };

  const normalizeSessions = (input: any): SessionItem[] => {
    const rows = Array.isArray(input?.sessions) ? input.sessions : Array.isArray(input) ? input : [];
    return rows.slice(0, 100).map((s: any, idx: number) => ({
      id: String(s.key ?? s.id ?? `session-${idx}`),
      name: String(s.label ?? s.key ?? 'session'),
      state: (s.active ? 'active' : 'idle') as 'active' | 'idle',
      model: String(s.model ?? s.defaultModel ?? 'unknown'),
    }));
  };

  const normalizeChannels = (input: any): ChannelItem[] => {
    const accounts = input?.channelAccounts ?? input?.channels ?? {};
    const out: ChannelItem[] = [];
    for (const [channelName, list] of Object.entries(accounts)) {
      if (Array.isArray(list)) {
        list.forEach((row: any, idx: number) => {
          out.push({
            id: String(row.accountId ?? `${channelName}-${idx}`),
            name: String(row.accountId ?? row.name ?? `${channelName} account`),
            type: (channelName as ChannelItem['type']) ?? 'telegram',
            enabled: row.enabled !== false,
          });
        });
      }
    }
    return out.length ? out : mockChannels;
  };

  const refreshData = async () => {
    if (!liveMode) {
      setSaveMsg('Mock mode refreshed ✅');
      return;
    }
    if (!gatewayUrl.trim()) {
      setSaveMsg('Add gateway URL first.');
      return;
    }

    setLoadingData(true);
    const client = new GatewayWsClient(gatewayUrl.trim(), token.trim());
    try {
      await client.connect();
      const [statusRes, healthRes, sessionsRes, cronRes, channelsRes] = await Promise.all([
        client.request<any>('status', {}),
        client.request<any>('health', {}),
        client.request<any>('sessions.list', { includeGlobal: true, includeUnknown: true, limit: 100 }),
        client.request<any>('cron.list', { includeDisabled: true }),
        client.request<any>('channels.status', { probe: false, timeoutMs: 5000 }),
      ]);

      const nextSessions = normalizeSessions(sessionsRes);
      const nextJobs = normalizeJobs(cronRes);
      const nextChannels = normalizeChannels(channelsRes);

      setSessions(nextSessions.length ? nextSessions : mockSessions);
      setJobs(nextJobs.length ? nextJobs : mockJobs);
      setChannels(nextChannels.length ? nextChannels : mockChannels);
      setHealth({
        status: 'online',
        uptime: String(statusRes?.uptime ?? healthRes?.uptime ?? 'online'),
        activeSessions: nextSessions.length,
        runningJobs: nextJobs.filter((j) => j.status === 'running').length,
      });
      setSaveMsg('Live data updated ✅');
    } catch (err) {
      setSaveMsg(`Live refresh failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      client.close();
      setLoadingData(false);
    }
  };

  const saveConnection = async () => {
    if (!gatewayUrl.trim()) {
      setSaveMsg('Enter a gateway URL first.');
      return;
    }

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.gatewayUrl, gatewayUrl.trim()),
      AsyncStorage.setItem(STORAGE_KEYS.gatewayToken, token.trim()),
    ]);

    setSaveMsg('Saved ✅');
    setNeedsOnboarding(false);
  };

  const testConnection = async () => {
    if (!gatewayUrl.trim()) {
      setSaveMsg('Enter gateway URL first.');
      return;
    }
    if (!liveMode) {
      setSaveMsg('Mock mode enabled ✅');
      return;
    }

    setLoadingData(true);
    const client = new GatewayWsClient(gatewayUrl.trim(), token.trim());
    try {
      await client.connect();
      await client.request('status', {});
      setSaveMsg('Connection OK ✅');
    } catch (err) {
      setSaveMsg(`Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      client.close();
      setLoadingData(false);
    }
  };

  const runningJobs = useMemo(() => jobs.filter((job) => job.status === 'running').length, [jobs]);
  const addDemoJob = () => setJobs((prev) => [{ id: `j${Date.now()}`, name: 'Manual run-now task', status: 'queued', startedAt: 'queued' }, ...prev]);
  const toggleChannel = (id: string) => setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
  const removeChannel = (id: string) => setChannels((prev) => prev.filter((c) => c.id !== id));
  const addChannel = () => setChannels((prev) => [{ id: `c${Date.now()}`, name: `New Channel ${prev.length + 1}`, type: 'telegram', enabled: true }, ...prev]);

  if (hydrating) return <SafeAreaView style={styles.safeCenter}><StatusBar barStyle="light-content" /><ActivityIndicator color="#7aa2ff" /><Text style={styles.subtitle}>Loading Mission Control...</Text></SafeAreaView>;

  if (needsOnboarding) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}><Text style={styles.title}>Mission Control</Text><Text style={styles.subtitle}>First-time setup</Text></View>
        <View style={[styles.content, { paddingHorizontal: 14 }]}>
          <Card>
            <Text style={styles.cardTitle}>Connect your Gateway</Text>
            <Text style={styles.helper}>Paste tunnel URL + token. You can edit both later in Settings.</Text>
            <TextInput style={styles.input} value={gatewayUrl} onChangeText={setGatewayUrl} placeholder="https://ghostclaw.ghostyt7582.online" placeholderTextColor="#7f8aa3" autoCapitalize="none" />
            <TextInput style={styles.input} value={token} onChangeText={setToken} placeholder="Gateway token" placeholderTextColor="#7f8aa3" secureTextEntry autoCapitalize="none" />
            <TouchableOpacity style={styles.primaryBtn} onPress={saveConnection}><Text style={styles.primaryBtnText}>Continue</Text></TouchableOpacity>
            {!!saveMsg && <Text style={styles.helper}>{saveMsg}</Text>}
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}><Text style={styles.title}>Mission Control</Text><Text style={styles.subtitle}>OpenClaw Mobile Ops</Text></View>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
        {activeTab === 'dashboard' && <View style={styles.gap}><Card><Text style={styles.cardTitle}>Gateway Health</Text><StatRow label="Status" value={health.status.toUpperCase()} good={health.status === 'online'} /><StatRow label="Runtime" value={health.uptime} /><StatRow label="Running jobs" value={String(runningJobs)} /><StatRow label="Sessions active" value={String(sessions.length || health.activeSessions)} /></Card><Card><Text style={styles.cardTitle}>Quick Actions</Text><View style={styles.rowWrap}><ActionPill label="Run Job" onPress={addDemoJob} /><ActionPill label="Refresh" onPress={refreshData} /><ActionPill label="Restart Gateway" danger /></View></Card><Card><Text style={styles.cardTitle}>Live Queue</Text>{jobs.slice(0, 4).map((job) => <JobRow key={job.id} job={job} />)}</Card></View>}
        {activeTab === 'jobs' && <Card><Text style={styles.cardTitle}>Jobs Queue</Text><Text style={styles.helper}>Running + pending + recent outcomes</Text>{jobs.map((job) => <JobRow key={job.id} job={job} />)}<TouchableOpacity style={styles.primaryBtn} onPress={addDemoJob}><Text style={styles.primaryBtnText}>+ Queue Test Job</Text></TouchableOpacity></Card>}
        {activeTab === 'sessions' && <View style={styles.gap}><Card><Text style={styles.cardTitle}>Session Control</Text>{sessions.map((s) => <SessionRow key={s.id} name={s.name} state={s.state} model={s.model} />)}</Card><Card><Text style={styles.cardTitle}>Fast Command</Text><TextInput style={styles.input} placeholder="Send quick command to session..." placeholderTextColor="#7f8aa3" /><TouchableOpacity style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Send</Text></TouchableOpacity></Card></View>}
        {activeTab === 'channels' && <Card><Text style={styles.cardTitle}>Channels</Text><Text style={styles.helper}>Advanced mode required for add/remove</Text>{channels.map((channel) => <View key={channel.id} style={styles.channelRow}><View><Text style={styles.channelName}>{channel.name}</Text><Text style={styles.channelMeta}>{channel.type.toUpperCase()}</Text></View><View style={styles.rowWrap}><ActionPill label={channel.enabled ? 'Disable' : 'Enable'} onPress={() => toggleChannel(channel.id)} />{advancedMode && <ActionPill label="Remove" danger onPress={() => removeChannel(channel.id)} />}</View></View>)}{advancedMode ? <TouchableOpacity style={styles.primaryBtn} onPress={addChannel}><Text style={styles.primaryBtnText}>+ Add Channel</Text></TouchableOpacity> : <Text style={styles.warning}>Enable advanced mode in Settings to modify channel list.</Text>}</Card>}
        {activeTab === 'settings' && <View style={styles.gap}><Card><Text style={styles.cardTitle}>Gateway Connection</Text><TextInput style={styles.input} value={gatewayUrl} onChangeText={setGatewayUrl} placeholder="Gateway URL" placeholderTextColor="#7f8aa3" autoCapitalize="none" /><TextInput style={styles.input} value={token} onChangeText={setToken} placeholder="Gateway Token" placeholderTextColor="#7f8aa3" secureTextEntry autoCapitalize="none" /><TouchableOpacity style={styles.primaryBtn} onPress={saveConnection}><Text style={styles.primaryBtnText}>Save Connection</Text></TouchableOpacity><TouchableOpacity style={styles.primaryBtnMuted} onPress={testConnection}><Text style={styles.primaryBtnText}>{loadingData ? 'Testing...' : 'Test Connection'}</Text></TouchableOpacity><TouchableOpacity style={styles.primaryBtnMuted} onPress={() => setLiveMode((p) => !p)}><Text style={styles.primaryBtnText}>{liveMode ? 'Live Mode: ON' : 'Live Mode: OFF (Mock)'}</Text></TouchableOpacity><TouchableOpacity style={styles.primaryBtnMuted} onPress={refreshData}><Text style={styles.primaryBtnText}>{loadingData ? 'Refreshing...' : 'Refresh Data'}</Text></TouchableOpacity>{!!saveMsg && <Text style={styles.helper}>{saveMsg}</Text>}</Card><Card><Text style={styles.cardTitle}>Safety Controls</Text><Text style={styles.helper}>Protect channel/config actions with explicit opt-in</Text><TouchableOpacity style={[styles.toggleBtn, advancedMode ? styles.toggleOn : styles.toggleOff]} onPress={() => setAdvancedMode((prev) => !prev)}><Text style={styles.toggleText}>{advancedMode ? 'Advanced Mode ON' : 'Advanced Mode OFF'}</Text></TouchableOpacity></Card></View>}
      </ScrollView>
      <View style={styles.tabBar}>{tabs.map((tab) => <TouchableOpacity key={tab.key} style={styles.tabBtn} onPress={() => setActiveTab(tab.key)}><Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text></TouchableOpacity>)}</View>
    </SafeAreaView>
  );
}

function Card({ children }: { children: React.ReactNode }) { return <View style={styles.card}>{children}</View>; }
function StatRow({ label, value, good = false }: { label: string; value: string; good?: boolean }) { return <View style={styles.statRow}><Text style={styles.label}>{label}</Text><Text style={[styles.value, good && styles.good]}>{value}</Text></View>; }
function JobRow({ job }: { job: JobItem }) { return <View style={styles.jobRow}><View><Text style={styles.jobName}>{job.name}</Text><Text style={styles.jobMeta}>{job.startedAt}</Text></View><Text style={[styles.badge, job.status === 'failed' && styles.badgeFail]}>{job.status}</Text></View>; }
function SessionRow({ name, state, model }: { name: string; state: 'active' | 'idle'; model: string }) { return <View style={styles.jobRow}><View><Text style={styles.jobName}>{name}</Text><Text style={styles.jobMeta}>{model}</Text></View><Text style={[styles.badge, state === 'active' ? styles.badgeActive : styles.badgeIdle]}>{state}</Text></View>; }
function ActionPill({ label, danger, onPress }: { label: string; danger?: boolean; onPress?: () => void }) { return <TouchableOpacity style={[styles.pill, danger && styles.pillDanger]} onPress={onPress}><Text style={styles.pillText}>{label}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1020' }, safeCenter: { flex: 1, backgroundColor: '#0b1020', alignItems: 'center', justifyContent: 'center', gap: 10 }, header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 }, title: { color: 'white', fontSize: 28, fontWeight: '800' }, subtitle: { color: '#9caad1', marginTop: 2 }, content: { paddingHorizontal: 14 }, gap: { gap: 12 }, card: { backgroundColor: '#141c33', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#202c4d' }, cardTitle: { color: 'white', fontSize: 17, fontWeight: '700', marginBottom: 10 }, helper: { color: '#8ea0ca', marginBottom: 8 }, warning: { color: '#f6bf6d', marginTop: 10 }, statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, label: { color: '#9caad1' }, value: { color: 'white', fontWeight: '700' }, good: { color: '#6fe4a9' }, rowWrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, pill: { backgroundColor: '#24345f', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 }, pillDanger: { backgroundColor: '#66324a' }, pillText: { color: 'white', fontWeight: '600' }, jobRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#273761', paddingVertical: 10 }, jobName: { color: 'white', fontWeight: '600' }, jobMeta: { color: '#8ea0ca', marginTop: 2, fontSize: 12 }, badge: { backgroundColor: '#2a3a66', color: '#dbe6ff', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden', textTransform: 'capitalize' }, badgeFail: { backgroundColor: '#69354d', color: '#ffd7de' }, badgeActive: { backgroundColor: '#1f6449', color: '#caf9e3' }, badgeIdle: { backgroundColor: '#2a3a66', color: '#dbe6ff' }, channelRow: { borderTopWidth: 1, borderTopColor: '#273761', paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, channelName: { color: 'white', fontWeight: '600' }, channelMeta: { color: '#8ea0ca', fontSize: 12, marginTop: 2 }, input: { backgroundColor: '#10172c', borderWidth: 1, borderColor: '#273761', borderRadius: 12, color: 'white', paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10 }, primaryBtn: { backgroundColor: '#3d7dff', borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginTop: 6 }, primaryBtnMuted: { backgroundColor: '#2a3a66', borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginTop: 6 }, primaryBtnText: { color: 'white', fontWeight: '700' }, toggleBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 6 }, toggleOn: { backgroundColor: '#2f6a52' }, toggleOff: { backgroundColor: '#4a3f2b' }, toggleText: { color: 'white', fontWeight: '700' }, tabBar: { position: 'absolute', left: 14, right: 14, bottom: 12, backgroundColor: '#111a31', borderWidth: 1, borderColor: '#24345f', borderRadius: 14, flexDirection: 'row', paddingVertical: 6 }, tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 8 }, tabText: { color: '#8ea0ca', fontWeight: '600', fontSize: 12 }, tabTextActive: { color: 'white' },
});
