import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Camera,
  Check,
  ChevronRight,
  Coins,
  LogOut,
  Pencil,
  Trash2,
} from 'lucide-react';
import { DAILY_GOAL_OPTIONS, storeItem } from '@kanjigarden/shared';
import { api, apiUpload } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { applyTheme } from '../lib/theme.js';
import { clearReviews } from '../lib/offlineQueue.js';
import { useAuth } from '../stores/auth.js';
import { clearServerState } from '../components/ServerStateProvider.jsx';
import { AchievementIcon } from '../components/AchievementIcon.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs.jsx';
import { Toggle } from '../components/ui/Toggle.jsx';
import { useToast } from '../components/ui/Toast.jsx';

/** Profile — prompt.md §7.8 / §6.13. */

const TAB_VALUES = new Set(['profile', 'achievements', 'settings']);

const JLPT_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: '5', label: 'N5 — beginner' },
  { value: '4', label: 'N4 — elementary' },
  { value: '3', label: 'N3 — intermediate' },
];

const REVIEW_LIMIT_OPTIONS = [10, 20, 30, 50, 100].map((value) => ({
  value: String(value),
  label: `${value} reviews / day`,
}));

const THEME_OPTIONS = [
  { value: 'auto', label: 'Auto (follow system)' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const FURIGANA_OPTIONS = [
  { value: 'always', label: 'Always show' },
  { value: 'hover', label: 'On hover or focus' },
  { value: 'never', label: 'Never' },
];

const GOAL_OPTIONS = DAILY_GOAL_OPTIONS.map((value) => ({
  value: String(value),
  label: `${value} XP / day`,
}));

function formatDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

function LevelShield({ level }) {
  return (
    <svg
      width="44"
      height="50"
      viewBox="0 0 44 50"
      fill="none"
      role="img"
      aria-label={`Level ${level}`}
    >
      <path
        d="M22 2.5l17 6.2v14.6c0 10.6-7 18.8-17 23.2-10-4.4-17-12.6-17-23.2V8.7z"
        stroke="var(--accent-vermillion)"
        strokeWidth="2"
        fill="var(--bg-surface)"
      />
      <path d="M22 20.5v14" stroke="var(--border-subtle)" strokeWidth="1" />
      <text
        x="22"
        y="30"
        textAnchor="middle"
        fill="var(--ink-primary)"
        fontSize="15"
        fontFamily="'Geist Mono', ui-monospace, monospace"
        fontWeight="600"
      >
        {level}
      </text>
    </svg>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-card border border-line-subtle bg-surface p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.05em] text-ink-muted">{label}</p>
      {value === null || value === undefined ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className="mt-1 font-mono text-2xl text-ink-primary">{value.toLocaleString('en-US')}</p>
      )}
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function SettingsSection({ title, description, children }) {
  return (
    <section className="rounded-card border border-line-subtle bg-surface p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-ink-primary">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-primary">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ProgressBar({ current = 0, target = 1 }) {
  const percent = Math.min(100, Math.max(0, (current / Math.max(1, target)) * 100));
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-subtle">
        <div className="h-1 rounded-full bg-indigo" style={{ width: `${percent}%` }} />
      </div>
      <span className="font-mono text-[10px] text-ink-muted">
        {Math.min(current, target)}/{target}
      </span>
    </div>
  );
}

function AchievementCard({ achievement, onOpen }) {
  const progress = achievement.progress;
  return (
    <button
      type="button"
      onClick={() => onOpen(achievement)}
      className={cn(
        'flex h-full w-full flex-col rounded-card border border-line-subtle bg-surface p-4 text-left shadow-sm',
        'transition-colors duration-fast ease-out hover:border-line-strong',
        !achievement.unlocked && 'opacity-40'
      )}
    >
      <span className={cn(!achievement.unlocked && 'grayscale')}>
        <AchievementIcon id={achievement.icon ?? achievement.id} size={32} />
      </span>
      <span className="mt-3 font-display text-sm font-medium text-ink-primary">
        {achievement.name}
      </span>
      <span className="font-jp text-xs text-ink-muted">{achievement.nameJa}</span>
      <span className="mt-2 text-xs text-ink-muted">
        {achievement.unlocked
          ? (formatDate(achievement.unlockedAt) ?? 'Unlocked')
          : progress
            ? `${Math.min(progress.current, progress.target)} / ${progress.target}`
            : 'Locked'}
      </span>
      {!achievement.unlocked && progress ? (
        <ProgressBar current={progress.current} target={progress.target} />
      ) : null}
    </button>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { push: toast } = useToast();

  const user = useAuth((state) => state.user);
  const gamification = useAuth((state) => state.gamification);
  const mergeUser = useAuth((state) => state.mergeUser);
  const mergeGamification = useAuth((state) => state.mergeGamification);
  const logout = useAuth((state) => state.logout);

  const requestedTab = searchParams.get('tab');
  const tab = TAB_VALUES.has(requestedTab) ? requestedTab : 'profile';
  const setTab = (next) => {
    setSearchParams(next === 'profile' ? {} : { tab: next }, { replace: true });
  };

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.displayName ?? '');
  const [nameError, setNameError] = useState('');
  const [titlePickerOpen, setTitlePickerOpen] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteName, setDeleteName] = useState('');
  const [timezoneDraft, setTimezoneDraft] = useState(user?.timezone ?? 'UTC');
  const fileInputRef = useRef(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (!editingName) setNameDraft(user?.displayName ?? '');
  }, [editingName, user?.displayName]);

  useEffect(() => {
    setTimezoneDraft(user?.timezone ?? 'UTC');
  }, [user?.timezone]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  const progressQuery = useQuery({
    queryKey: ['progress', 'stats'],
    queryFn: () => api('/progress/stats'),
  });

  const achievementsQuery = useQuery({
    queryKey: ['gamification', 'achievements'],
    queryFn: () => api('/gamification/achievements'),
    enabled: tab === 'achievements',
  });

  const inventoryQuery = useQuery({
    queryKey: ['store', 'inventory'],
    queryFn: () => api('/store/inventory'),
    enabled: titlePickerOpen,
  });

  const profileMutation = useMutation({
    mutationFn: (updates) => api('/users/me', { method: 'PATCH', body: updates }),
    onSuccess: (data) => {
      mergeUser(data.user);
      toast({ message: 'Saved', tone: 'success', duration: 1800 });
    },
    onError: (err) => toast({ message: err.message, tone: 'info' }),
  });

  const preferencesMutation = useMutation({
    mutationFn: (patch) => api('/users/me/preferences', { method: 'PATCH', body: patch }),
    onSuccess: (data) => {
      mergeUser({ preferences: data.preferences });
      toast({ message: 'Saved', tone: 'success', duration: 1800 });
      queryClient.invalidateQueries({ queryKey: ['gamification', 'profile'] });
    },
    onError: (err) => toast({ message: err.message, tone: 'info' }),
  });

  const avatarMutation = useMutation({
    mutationFn: (file) => apiUpload('/users/me/avatar', file),
    onSuccess: (data) => {
      mergeUser({ avatarUrl: data.avatarUrl });
      toast({ message: 'Avatar updated.', tone: 'success' });
    },
    onError: (err) => toast({ message: err.message, tone: 'info' }),
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () => api('/users/me/avatar', { method: 'DELETE' }),
    onSuccess: () => {
      mergeUser({ avatarUrl: null });
      toast({ message: 'Avatar removed.', tone: 'success' });
    },
    onError: (err) => toast({ message: err.message, tone: 'info' }),
  });

  const equipMutation = useMutation({
    mutationFn: (itemId) =>
      api('/gamification/store/equip', { method: 'POST', body: { slot: 'title', itemId } }),
    onSuccess: (data) => {
      mergeGamification({
        equippedTitle: data.equippedTitle,
        equippedFrame: data.equippedFrame,
      });
      queryClient.invalidateQueries({ queryKey: ['store'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      toast({ message: 'Title updated.', tone: 'success' });
      setTitlePickerOpen(false);
    },
    onError: (err) => toast({ message: err.message, tone: 'info' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (confirmName) => api('/users/me', { method: 'DELETE', body: { confirmName } }),
    onSuccess: () => {
      // D24: queued ratings belong to the deleted account and must not linger.
      clearReviews(user.id).catch(() => {});
      clearServerState();
      useAuth.setState({ status: 'guest', user: null, gamification: null });
      navigate('/login', { replace: true });
    },
    onError: (err) => toast({ message: err.message, tone: 'info' }),
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-[880px] space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
      </div>
    );
  }

  const equippedTitleName = gamification?.equippedTitle
    ? storeItem(gamification.equippedTitle)?.name
    : null;
  const ownedTitles = (inventoryQuery.data?.items ?? []).filter((item) => item.type === 'title');

  function saveDisplayName(event) {
    event.preventDefault();
    const displayName = nameDraft.trim();
    if (!displayName) {
      setNameError('Display name is required.');
      return;
    }
    if (displayName.length > 32) {
      setNameError('Use 32 characters or fewer.');
      return;
    }
    setNameError('');
    profileMutation.mutate(
      { displayName },
      {
        onSuccess: () => setEditingName(false),
      }
    );
  }

  function updatePreference(patch) {
    const current = useAuth.getState().user?.preferences ?? {};
    mergeUser({ preferences: { ...current, ...patch } });
    if (patch.theme) applyTheme(patch.theme);
    if (patch.dailyGoalXP !== undefined) {
      mergeGamification({ dailyGoalXP: patch.dailyGoalXP });
    }
    preferencesMutation.mutate(patch);
  }

  function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({ message: 'Use a JPEG, PNG, or WebP image.', tone: 'info' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ message: 'Choose an image smaller than 2 MB.', tone: 'info' });
      return;
    }
    avatarMutation.mutate(file);
  }

  function saveTimezone() {
    const timezone = timezoneDraft.trim();
    if (!timezone || timezone === user.timezone) return;
    profileMutation.mutate({ timezone });
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="mx-auto w-full max-w-[880px] space-y-5">
      <h1 className="font-display text-3xl font-semibold text-ink-primary">Profile</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Profile sections">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* — Profile — */}
        <TabsContent value="profile" className="space-y-5">
          <section className="rounded-card border border-line-subtle bg-surface p-6 shadow-sm">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="relative shrink-0">
                <Avatar
                  size={128}
                  name={user.displayName}
                  src={user.avatarUrl}
                  frame={gamification?.equippedFrame}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-label="Choose avatar image"
                  onChange={handleAvatarChange}
                />
                <button
                  type="button"
                  aria-label="Upload avatar"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarMutation.isPending}
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-vermillion text-on-accent shadow-sm transition-colors duration-fast ease-out hover:bg-vermillion-hover disabled:opacity-50"
                >
                  <Camera size={15} aria-hidden="true" />
                </button>
                {user.avatarUrl ? (
                  <button
                    type="button"
                    onClick={() => removeAvatarMutation.mutate()}
                    disabled={removeAvatarMutation.isPending}
                    className="mt-3 block w-full text-center text-xs text-ink-muted transition-colors duration-fast ease-out hover:text-ink-secondary"
                  >
                    Remove photo
                  </button>
                ) : null}
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                {editingName ? (
                  <form onSubmit={saveDisplayName} className="mx-auto max-w-sm sm:mx-0">
                    <Input
                      ref={nameInputRef}
                      label="Display name"
                      name="displayName"
                      value={nameDraft}
                      maxLength={32}
                      error={nameError}
                      onChange={(event) => {
                        setNameDraft(event.target.value);
                        if (nameError) setNameError('');
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setEditingName(false);
                          setNameError('');
                        }
                      }}
                    />
                    <div className="mt-2 flex items-center justify-center gap-2 sm:justify-start">
                      <Button type="submit" size="md" disabled={profileMutation.isPending}>
                        Save name
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingName(false);
                          setNameError('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-center gap-2 sm:justify-start">
                    <h2 className="font-display text-2xl font-medium text-ink-primary">
                      {user.displayName}
                    </h2>
                    <button
                      type="button"
                      aria-label="Edit display name"
                      onClick={() => setEditingName(true)}
                      className="rounded-control p-1 text-ink-muted transition-colors duration-fast ease-out hover:bg-subtle hover:text-ink-primary"
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setTitlePickerOpen(true)}
                  className="mt-1 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors duration-fast ease-out hover:text-ink-primary"
                >
                  {equippedTitleName ?? 'No title equipped'}
                  <ChevronRight size={14} aria-hidden="true" />
                </button>

                <div className="mt-4 flex items-center justify-center gap-3 sm:justify-start">
                  <LevelShield level={gamification?.currentLevel ?? 1} />
                  <div className="text-left">
                    <p className="text-sm font-medium text-ink-primary">
                      Level {gamification?.currentLevel ?? 1}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Joined{' '}
                      {formatDate(user.createdAt, { month: 'long', year: 'numeric' }) ?? 'today'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Total XP" value={gamification?.totalXP ?? 0} />
            <StatCard label="Longest streak" value={gamification?.longestStreak ?? 0} hint="days" />
            <StatCard
              label="Kanji mastered"
              value={progressQuery.isLoading ? null : (progressQuery.data?.mastered ?? 0)}
            />
          </div>

          <p className="text-center text-xs text-ink-muted">
            Want a new look?{' '}
            <Link to="/store" className="font-medium text-vermillion hover:text-vermillion-hover">
              Visit the store
            </Link>{' '}
            for titles and frames.
          </p>
        </TabsContent>

        {/* — Achievements — */}
        <TabsContent value="achievements" className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink-primary">Achievements</h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                {achievementsQuery.data
                  ? `${achievementsQuery.data.unlockedCount} of ${achievementsQuery.data.items.length} unlocked`
                  : 'Your milestones in the garden.'}
              </p>
            </div>
          </div>

          {achievementsQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-36 rounded-card" />
              ))}
            </div>
          ) : achievementsQuery.isError ? (
            <EmptyState
              headline="Achievements are out of reach"
              description="We couldn't load your achievements. Try again in a moment."
              action={{ label: 'Retry', onClick: () => achievementsQuery.refetch() }}
            />
          ) : (achievementsQuery.data?.items ?? []).length === 0 ? (
            <EmptyState
              headline="No achievements yet"
              description="Nothing unlocked. Your first review unlocks Hajimemashite."
              action={{ label: 'Start reviewing', onClick: () => navigate('/review') }}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {achievementsQuery.data.items.map((achievement) => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  onOpen={setSelectedAchievement}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* — Settings — */}
        <TabsContent value="settings" className="space-y-4">
          <SettingsSection title="Account" description="How your garden is identified.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-ink-primary">Email</p>
                <p className="mt-1.5 rounded-control border border-line-subtle bg-subtle px-3 py-2 text-sm text-ink-secondary">
                  {user.email}
                </p>
              </div>
              <Select
                label="Japanese level"
                name="jlptLevel"
                value={user.jlptLevel ? String(user.jlptLevel) : ''}
                options={JLPT_OPTIONS}
                onChange={(event) =>
                  profileMutation.mutate({
                    jlptLevel: event.target.value ? Number(event.target.value) : null,
                  })
                }
              />
            </div>
            <Input
              label="Timezone"
              name="timezone"
              value={timezoneDraft}
              hint="Used for your daily reset and streak."
              onChange={(event) => setTimezoneDraft(event.target.value)}
              onBlur={saveTimezone}
            />
            <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-4">
              <Button variant="outline" onClick={handleLogout}>
                <LogOut size={15} aria-hidden="true" /> Log out
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection title="Learning" description="Tune the daily rhythm.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Daily goal"
                name="dailyGoalXP"
                value={String(user.preferences?.dailyGoalXP ?? 50)}
                options={GOAL_OPTIONS}
                onChange={(event) => updatePreference({ dailyGoalXP: Number(event.target.value) })}
              />
              <Select
                label="Daily review limit"
                name="dailyReviewLimit"
                value={String(user.preferences?.dailyReviewLimit ?? 20)}
                options={REVIEW_LIMIT_OPTIONS}
                onChange={(event) =>
                  updatePreference({ dailyReviewLimit: Number(event.target.value) })
                }
              />
            </div>
            <SettingRow
              label="Furigana readings"
              description="Show hiragana above kanji during reviews."
            >
              <Select
                label="Furigana readings"
                name="furigana"
                value={
                  user.preferences?.furigana === true
                    ? 'always'
                    : user.preferences?.furigana === false
                      ? 'never'
                      : (user.preferences?.furigana ?? 'always')
                }
                options={FURIGANA_OPTIONS}
                onChange={(event) => updatePreference({ furigana: event.target.value })}
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection title="Appearance" description="Choose how the garden looks.">
            <Select
              label="Theme"
              name="theme"
              value={user.preferences?.theme ?? 'auto'}
              options={THEME_OPTIONS}
              onChange={(event) => updatePreference({ theme: event.target.value })}
            />
          </SettingsSection>

          <SettingsSection title="Audio & haptics" description="Feedback while you study.">
            <SettingRow label="Sound effects" description="Short cues for answers and rewards.">
              <Toggle
                checked={user.preferences?.soundEnabled ?? true}
                onChange={(checked) => updatePreference({ soundEnabled: checked })}
                label="Sound effects"
              />
            </SettingRow>
            <SettingRow label="Haptics" description="Vibration feedback on supported devices.">
              <Toggle
                checked={user.preferences?.hapticsEnabled ?? false}
                onChange={(checked) => updatePreference({ hapticsEnabled: checked })}
                label="Haptics"
              />
            </SettingRow>
          </SettingsSection>

          <SettingsSection title="Reminders" description="A gentle nudge, never a streak threat.">
            <SettingRow
              label="Daily reminder"
              description="Show a reminder at the time you choose."
            >
              <Toggle
                checked={user.preferences?.reminderEnabled ?? false}
                onChange={(checked) =>
                  updatePreference({
                    reminderEnabled: checked,
                    ...(checked && !user.preferences?.reminderTime
                      ? { reminderTime: '19:00' }
                      : {}),
                  })
                }
                label="Daily reminder"
              />
            </SettingRow>
            <Input
              label="Reminder time"
              name="reminderTime"
              type="time"
              value={user.preferences?.reminderTime ?? '19:00'}
              disabled={!user.preferences?.reminderEnabled}
              onChange={(event) => {
                if (event.target.value) updatePreference({ reminderTime: event.target.value });
              }}
            />
          </SettingsSection>

          <SettingsSection title="Data" description="Your account, your choice.">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-ink-primary">Delete account</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Permanently removes your progress, achievements, and store items.
                </p>
              </div>
              <Button
                variant="again"
                onClick={() => {
                  setDeleteName('');
                  setDeleteOpen(true);
                }}
              >
                <Trash2 size={15} aria-hidden="true" /> Delete account
              </Button>
            </div>
          </SettingsSection>
        </TabsContent>
      </Tabs>

      {/* — Title picker — */}
      <Modal
        open={titlePickerOpen}
        onOpenChange={setTitlePickerOpen}
        title="Choose a title"
        description="Titles are permanent cosmetics from the store."
      >
        {inventoryQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 rounded-control" />
            <Skeleton className="h-12 rounded-control" />
          </div>
        ) : ownedTitles.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-secondary">
              You don't own any titles yet. They start at 25 coins.
            </p>
            <Link
              to="/store"
              className="inline-flex items-center gap-1 text-sm font-medium text-vermillion hover:text-vermillion-hover"
            >
              Visit the store <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            <li>
              <button
                type="button"
                onClick={() => equipMutation.mutate(null)}
                disabled={equipMutation.isPending}
                className="flex w-full items-center justify-between rounded-control border border-line-subtle px-3 py-2.5 text-left text-sm transition-colors duration-fast ease-out hover:border-line-strong"
              >
                <span className="text-ink-secondary">No title</span>
                {!gamification?.equippedTitle ? (
                  <Check size={16} aria-hidden="true" className="text-matcha" />
                ) : null}
              </button>
            </li>
            {ownedTitles.map((item) => {
              const equipped = gamification?.equippedTitle === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => equipMutation.mutate(item.id)}
                    disabled={equipMutation.isPending || equipped}
                    className={cn(
                      'flex w-full items-center justify-between rounded-control border px-3 py-2.5 text-left text-sm transition-colors duration-fast ease-out',
                      equipped
                        ? 'border-matcha bg-subtle'
                        : 'border-line-subtle hover:border-line-strong'
                    )}
                  >
                    <span>
                      <span className="block font-medium text-ink-primary">{item.name}</span>
                      <span className="block text-xs text-ink-muted">{item.description}</span>
                    </span>
                    {equipped ? (
                      <Check size={16} aria-hidden="true" className="shrink-0 text-matcha" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {/* — Achievement detail — */}
      <Modal
        open={!!selectedAchievement}
        onOpenChange={(open) => {
          if (!open) setSelectedAchievement(null);
        }}
        title={selectedAchievement?.name ?? 'Achievement'}
        description={selectedAchievement?.nameJa}
      >
        {selectedAchievement ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-control bg-subtle',
                  !selectedAchievement.unlocked && 'grayscale opacity-40'
                )}
              >
                <AchievementIcon
                  id={selectedAchievement.icon ?? selectedAchievement.id}
                  size={34}
                />
              </span>
              <div>
                <p className="text-sm text-ink-secondary">{selectedAchievement.description}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {selectedAchievement.unlocked
                    ? `Unlocked ${formatDate(selectedAchievement.unlockedAt) ?? ''}`
                    : selectedAchievement.progress
                      ? 'Locked — keep going'
                      : 'Locked'}
                </p>
              </div>
            </div>
            {!selectedAchievement.unlocked && selectedAchievement.progress ? (
              <ProgressBar
                current={selectedAchievement.progress.current}
                target={selectedAchievement.progress.target}
              />
            ) : null}
            <p className="flex items-center gap-3 border-t border-line-subtle pt-3 font-mono text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <Coins size={13} aria-hidden="true" /> {selectedAchievement.rewardCoins ?? 0}
              </span>
              <span>{selectedAchievement.rewardXP ?? 0} XP</span>
              <span className="capitalize">{selectedAchievement.category}</span>
            </p>
          </div>
        ) : null}
      </Modal>

      {/* — Delete account — */}
      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete account"
        description="This cannot be undone. Your progress, achievements, inventory, and avatar are removed."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="again"
              disabled={deleteName !== user.displayName || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteName)}
            >
              Delete account
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-control border border-crimson px-3 py-2 text-sm text-crimson">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Every kanji, review, coin, and badge will be gone.
          </p>
          <Input
            label={`Type "${user.displayName}" to confirm`}
            name="confirmName"
            value={deleteName}
            autoComplete="off"
            onChange={(event) => setDeleteName(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
