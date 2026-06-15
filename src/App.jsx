import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { exercises } from './data/exercises.js';
import { calculateBMI, formatNumber, getBMICategory, getTodayISO, sortByDateDesc } from './utils/calculations.js';

const LEGACY_STORAGE_KEYS = {
  profile: 'caveman-profile',
  bodyLogs: 'caveman-body-logs',
  workouts: 'caveman-workouts'
};

const APP_VERSION = 'v0.4.0';
const APP_VERSION_CONTEXT = 'Local data app Â· GitHub Pages version';
const DEFAULT_WEEKLY_WORKOUT_GOAL = 3;
const DEFAULT_THEME_ID = 'apple-glass';

const THEME_OPTIONS = [
  {
    id: 'apple-glass',
    name: 'Apple Glass Premium',
    className: 'theme-apple-glass'
  },
  {
    id: 'futuristic-neon',
    name: 'Futuristic Neon Performance',
    className: 'theme-futuristic-neon'
  },
  {
    id: 'obsidian-gold',
    name: 'Obsidian Gold Caveman',
    className: 'theme-obsidian-gold'
  }
];

const users = [
  {
    username: 'bobby',
    password: 'bobby123',
    name: 'Bobby'
  },
  {
    username: 'manager',
    password: 'manager123',
    name: 'Manager'
  },
  {
    username: 'mircea',
    password: 'mircea123',
    name: 'Mircea'
  },
  {
    username: 'natasha',
    password: 'natasha123',
    name: 'Natasha'
  }
];

const defaultProfile = {
  name: '',
  heightCm: '',
  birthYear: '',
  goal: '',
  targetWeightKg: '',
  targetWaistCm: '',
  weeklyGoal: DEFAULT_WEEKLY_WORKOUT_GOAL,
  theme: DEFAULT_THEME_ID
};

function getEmptyProfile() {
  return { ...defaultProfile };
}

function getUserStorageKeys(username) {
  return {
    profile: `caveman:${username}:profile`,
    bodyLogs: `caveman:${username}:body-logs`,
    workouts: `caveman:${username}:workouts`
  };
}

function loadFromStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function hasStoredValue(key) {
  return localStorage.getItem(key) !== null;
}

function migrateLegacyDataIfNeeded(user) {
  if (user.username !== 'bobby') return;

  const keys = getUserStorageKeys(user.username);
  const hasUserData = hasStoredValue(keys.profile) || hasStoredValue(keys.bodyLogs) || hasStoredValue(keys.workouts);
  if (hasUserData) return;

  if (hasStoredValue(LEGACY_STORAGE_KEYS.profile)) {
    saveToStorage(keys.profile, loadFromStorage(LEGACY_STORAGE_KEYS.profile, getEmptyProfile()));
  }
  if (hasStoredValue(LEGACY_STORAGE_KEYS.bodyLogs)) {
    saveToStorage(keys.bodyLogs, loadFromStorage(LEGACY_STORAGE_KEYS.bodyLogs, []));
  }
  if (hasStoredValue(LEGACY_STORAGE_KEYS.workouts)) {
    saveToStorage(keys.workouts, loadFromStorage(LEGACY_STORAGE_KEYS.workouts, []));
  }
}

function loadUserData(user) {
  migrateLegacyDataIfNeeded(user);

  const keys = getUserStorageKeys(user.username);
  return {
    profile: loadFromStorage(keys.profile, getEmptyProfile()),
    bodyLogs: loadFromStorage(keys.bodyLogs, []),
    workouts: loadFromStorage(keys.workouts, [])
  };
}

function getExerciseById(exerciseId) {
  return exercises.find((item) => item.id === exerciseId);
}

function normalizeExerciseMatchValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getLastExerciseEntry(workouts, exerciseId) {
  const exercise = getExerciseById(exerciseId);
  const targetId = String(exerciseId ?? '');
  const targetName = normalizeExerciseMatchValue(exercise?.name);

  for (const workout of workouts) {
    const entry = workout.entries?.find((item) => {
      const entryId = String(item.exerciseId ?? '');

      if (targetId && entryId === targetId) {
        return true;
      }

      if (!targetName) {
        return false;
      }

      const possibleNames = [
        item.exerciseName,
        item.name,
        item.exercise?.name
      ].map(normalizeExerciseMatchValue).filter(Boolean);

      return possibleNames.includes(targetName);
    });

    if (entry) {
      return { workout, entry };
    }
  }

  return null;
}
function formatSets(sets = []) {
  return sets.map((set) => `${set.kg || '-'}kg x ${set.reps || '-'}`).join(' / ');
}

function getValidSets(sets = []) {
  return sets
    .map((set) => ({
      kg: toOptionalNumber(set.kg),
      reps: toOptionalNumber(set.reps)
    }))
    .filter((set) => set.kg !== null && set.reps !== null);
}

function formatLastTime(entry) {
  const validSets = getValidSets(entry?.sets);
  if (!validSets.length) return null;
  return validSets.map((set) => `${formatNumber(set.kg)} kg x ${formatNumber(set.reps, 0)}`).join(', ');
}

const kgOptions = Array.from({ length: 81 }, (_, index) => {
  const value = index * 2.5;
  return Number.isInteger(value) ? value : Number(value.toFixed(1));
});

const repOptions = Array.from({ length: 30 }, (_, index) => index + 1);

const workoutTemplates = [
  {
    id: 'upper-body',
    name: 'Upper Body',
    exerciseIds: ['chest-press', 'wide-chest-press', 'pectoral-fly', 'lat-pulldown', 'machine-row', 'preacher-curl', 'ab-crunch']
  },
  {
    id: 'leg-day',
    name: 'Leg Day',
    exerciseIds: ['leg-extension', 'leg-curl', 'gluteus-kickback', 'hip-abduction', 'hip-adduction', 'calf-raise']
  },
  {
    id: 'cardio',
    name: 'Cardio',
    exerciseIds: ['treadmill']
  },
  {
    id: 'full-body',
    name: 'Full Body',
    exerciseIds: ['chest-press', 'lat-pulldown', 'machine-row', 'leg-extension', 'leg-curl', 'ab-crunch', 'treadmill']
  }
];

function parseSelectNumber(value) {
  if (value === '') return '';
  const number = Number(value);
  return Number.isNaN(number) ? '' : number;
}

function toOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function getWeeklyGoalValue(value) {
  const number = toOptionalNumber(value);
  if (number === null || number < 1) return DEFAULT_WEEKLY_WORKOUT_GOAL;
  return Math.floor(number);
}

function getThemeOption(themeId) {
  return THEME_OPTIONS.find((theme) => theme.id === themeId) || THEME_OPTIONS[0];
}

function triggerHaptic(type = 'light') {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

  const patterns = {
    light: 10,
    medium: 20,
    success: [10, 35, 15],
    error: 30
  };

  try {
    navigator.vibrate(patterns[type] || patterns.light);
  } catch {
    // Unsupported browsers should behave exactly the same without haptics.
  }
}

function getBodyMetricLogs(bodyLogs, field) {
  return sortByDateDesc(bodyLogs)
    .filter((log) => toOptionalNumber(log[field]) !== null)
    .map((log) => ({
      date: log.date,
      value: toOptionalNumber(log[field])
    }));
}

function getPersonalRecords(workouts) {
  const records = new Map();

  for (const workout of workouts) {
    for (const entry of workout.entries || []) {
      const validSets = getValidSets(entry.sets);
      if (!validSets.length) continue;

      const current = records.get(entry.exerciseId) || {
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        bestKg: null,
        bestRepsAtBestKg: null,
        bestVolume: null,
        latestDate: null
      };

      for (const set of validSets) {
        const volume = set.kg * set.reps;
        if (current.bestKg === null || set.kg > current.bestKg) {
          current.bestKg = set.kg;
          current.bestRepsAtBestKg = set.reps;
        } else if (set.kg === current.bestKg && set.reps > current.bestRepsAtBestKg) {
          current.bestRepsAtBestKg = set.reps;
        }
        if (current.bestVolume === null || volume > current.bestVolume) {
          current.bestVolume = volume;
        }
      }

      if (!current.latestDate || new Date(workout.date) > new Date(current.latestDate)) {
        current.latestDate = workout.date;
      }

      records.set(entry.exerciseId, current);
    }
  }

  return [...records.values()]
    .sort((a, b) => (b.bestVolume || 0) - (a.bestVolume || 0) || (b.bestKg || 0) - (a.bestKg || 0))
    .slice(0, 8);
}

function getExerciseProgressOptions(workouts) {
  const options = new Map();

  for (const workout of sortByDateDesc(workouts)) {
    for (const entry of workout.entries || []) {
      if (!entry.exerciseId || options.has(entry.exerciseId)) continue;
      if (!getValidSets(entry.sets).length) continue;

      options.set(entry.exerciseId, {
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName
      });
    }
  }

  return [...options.values()];
}

function getExerciseProgress(workouts, exerciseId) {
  if (!exerciseId) return [];

  const progressByDate = new Map();

  for (const workout of workouts) {
    for (const entry of workout.entries || []) {
      if (entry.exerciseId !== exerciseId) continue;

      const validSets = getValidSets(entry.sets);
      if (!validSets.length) continue;

      const current = progressByDate.get(workout.date) || {
        date: workout.date,
        bestKg: null,
        bestSetVolume: null,
        totalVolume: 0
      };

      for (const set of validSets) {
        const volume = set.kg * set.reps;
        current.bestKg = current.bestKg === null ? set.kg : Math.max(current.bestKg, set.kg);
        current.bestSetVolume = current.bestSetVolume === null ? volume : Math.max(current.bestSetVolume, volume);
        current.totalVolume += volume;
      }

      progressByDate.set(workout.date, current);
    }
  }

  return [...progressByDate.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function parseWorkoutDate(value) {
  if (!value) return null;
  const isoMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = isoMatch
    ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getWeekStart(date) {
  const start = startOfDay(date);
  const day = start.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeeklyWorkoutStats(workouts, weeklyGoal = DEFAULT_WEEKLY_WORKOUT_GOAL) {
  const goal = getWeeklyGoalValue(weeklyGoal);
  const today = startOfDay(new Date());
  const weekStart = getWeekStart(today);
  const nextWeekStart = addDays(weekStart, 7);
  const weeklyCounts = new Map();
  let latestDate = null;
  let workoutsThisWeek = 0;

  for (const workout of workouts) {
    const workoutDate = parseWorkoutDate(workout.date);
    if (!workoutDate) continue;

    const workoutDay = startOfDay(workoutDate);
    const workoutWeekStart = getWeekStart(workoutDay);
    const weekKey = formatISODate(workoutWeekStart);
    weeklyCounts.set(weekKey, (weeklyCounts.get(weekKey) || 0) + 1);

    if (workoutDay >= weekStart && workoutDay < nextWeekStart) {
      workoutsThisWeek += 1;
    }

    if (!latestDate || workoutDay > latestDate) {
      latestDate = workoutDay;
    }
  }

  const remainingWorkouts = Math.max(goal - workoutsThisWeek, 0);
  let streakStart = workoutsThisWeek >= goal ? weekStart : addDays(weekStart, -7);
  let workoutStreak = 0;

  while ((weeklyCounts.get(formatISODate(streakStart)) || 0) >= goal) {
    workoutStreak += 1;
    streakStart = addDays(streakStart, -7);
  }

  let message = 'Start this week with one solid session.';
  if (workoutsThisWeek >= goal) {
    message = 'Goal reached this week. Strong work.';
  } else if (remainingWorkouts === 1) {
    message = 'One more workout to hit your weekly goal.';
  }

  return {
    workoutsThisWeek,
    weeklyGoal: goal,
    remainingWorkouts,
    latestWorkoutDate: latestDate ? formatISODate(latestDate) : null,
    daysSinceLastWorkout: latestDate ? Math.max(0, Math.floor((today - latestDate) / 86400000)) : null,
    workoutStreak,
    progressPercent: Math.min((workoutsThisWeek / goal) * 100, 100),
    message
  };
}

function formatDifference(value, unit) {
  if (value === null) return '-';
  if (value === 0) return `0 ${unit}`;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} ${unit}`;
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profile, setProfile] = useState(() => getEmptyProfile());
  const [bodyLogs, setBodyLogs] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [updatePrompt, setUpdatePrompt] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const isManager = currentUser?.username === 'manager';
  const currentStorageKeys = currentUser && !isManager ? getUserStorageKeys(currentUser.username) : null;
  const activeTheme = getThemeOption(!currentUser || isManager ? DEFAULT_THEME_ID : profile.theme);

  useEffect(() => {
    const themeClasses = THEME_OPTIONS.map((theme) => theme.className);
    document.body.classList.remove(...themeClasses);
    document.body.classList.add(activeTheme.className);

    return () => {
      document.body.classList.remove(...themeClasses);
    };
  }, [activeTheme.className]);

  useEffect(() => {
    function handleUpdateAvailable(event) {
      setUpdatePrompt({
        update: event.detail?.update
      });
    }

    window.addEventListener('caveman:update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('caveman:update-available', handleUpdateAvailable);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  function showToast(message, type = 'success') {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToast({ id: crypto.randomUUID(), message, type });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2400);
  }

  function handleLogin(username, password) {
    const normalizedUsername = username.trim().toLowerCase();
    const matchingUser = users.find((user) => user.username.toLowerCase() === normalizedUsername);

    if (!matchingUser || matchingUser.password !== password) {
      return false;
    }

    if (matchingUser.username !== 'manager') {
      const userData = loadUserData(matchingUser);
      setProfile(userData.profile);
      setBodyLogs(userData.bodyLogs);
      setWorkouts(userData.workouts);
    } else {
      setProfile(getEmptyProfile());
      setBodyLogs([]);
      setWorkouts([]);
    }

    setActiveTab('dashboard');
    setCurrentUser(matchingUser);
    return true;
  }

  function handleLogout() {
    setCurrentUser(null);
    setActiveTab('dashboard');
    setProfile(getEmptyProfile());
    setBodyLogs([]);
    setWorkouts([]);
  }

  function updateProfile(nextProfile) {
    if (!currentStorageKeys) return;
    setProfile(nextProfile);
    saveToStorage(currentStorageKeys.profile, nextProfile);
  }

  function addBodyLog(log) {
    if (!currentStorageKeys) return;
    const bmi = calculateBMI(log.weightKg, profile.heightCm);
    const nextLog = {
      ...log,
      id: crypto.randomUUID(),
      bmi,
      bmiCategory: getBMICategory(bmi)
    };
    const nextLogs = sortByDateDesc([nextLog, ...bodyLogs]);
    setBodyLogs(nextLogs);
    saveToStorage(currentStorageKeys.bodyLogs, nextLogs);
    triggerHaptic('success');
    showToast('Body log saved âœ“');
  }

  function deleteBodyLog(id) {
    if (!currentStorageKeys) return;
    const nextLogs = bodyLogs.filter((log) => log.id !== id);
    setBodyLogs(nextLogs);
    saveToStorage(currentStorageKeys.bodyLogs, nextLogs);
  }

  function addWorkout(workout) {
    if (!currentStorageKeys) return;
    const nextWorkout = {
      ...workout,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    const nextWorkouts = sortByDateDesc([nextWorkout, ...workouts]);
    setWorkouts(nextWorkouts);
    saveToStorage(currentStorageKeys.workouts, nextWorkouts);
    triggerHaptic('success');
    showToast('Workout saved âœ“');
  }

  function deleteWorkout(id) {
    if (!currentStorageKeys) return;
    const nextWorkouts = workouts.filter((workout) => workout.id !== id);
    setWorkouts(nextWorkouts);
    saveToStorage(currentStorageKeys.workouts, nextWorkouts);
  }

  function exportData() {
    if (isManager) {
      const backup = {
        app: "The Caveman's Sweat Log",
        version: 2,
        exportedAt: new Date().toISOString(),
        managerExport: true,
        users: users
          .filter((user) => user.username !== 'manager')
          .map((user) => {
            const keys = getUserStorageKeys(user.username);
            return {
              username: user.username,
              profile: loadFromStorage(keys.profile, getEmptyProfile()),
              bodyLogs: loadFromStorage(keys.bodyLogs, []),
              workouts: loadFromStorage(keys.workouts, [])
            };
          })
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cavemans-sweat-log-manager-backup-${getTodayISO()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('Data exported âœ“');
      return;
    }

    const backup = {
      app: 'The Cavemanâ€™s Sweat Log',
      version: 1,
      exportedAt: new Date().toISOString(),
      username: currentUser.username,
      profile,
      bodyLogs,
      workouts
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cavemans-sweat-log-backup-${getTodayISO()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Data exported âœ“');
  }

  function importData(data) {
    if (!currentStorageKeys) {
      alert('Manager cannot import normal workout data.');
      return;
    }

    if (!data || typeof data !== 'object') {
      alert('Could not import file. The file does not look like a valid backup.');
      return;
    }

    const nextProfile = data.profile && typeof data.profile === 'object' ? data.profile : getEmptyProfile();
    const nextBodyLogs = Array.isArray(data.bodyLogs) ? data.bodyLogs : [];
    const nextWorkouts = Array.isArray(data.workouts) ? data.workouts : [];

    const ok = window.confirm('Import backup? This will replace the current local data on this device.');
    if (!ok) return;

    setProfile(nextProfile);
    setBodyLogs(nextBodyLogs);
    setWorkouts(nextWorkouts);

    saveToStorage(currentStorageKeys.profile, nextProfile);
    saveToStorage(currentStorageKeys.bodyLogs, nextBodyLogs);
    saveToStorage(currentStorageKeys.workouts, nextWorkouts);
    triggerHaptic('success');
    showToast('Data imported âœ“');
  }

  if (!currentUser) {
    return (
      <>
        <Login onLogin={handleLogin} />
        <UpdatePrompt prompt={updatePrompt} onDismiss={() => setUpdatePrompt(null)} />
        <Toast toast={toast} />
      </>
    );
  }

  if (isManager) {
    return (
      <div className="app-shell">
        <UpdatePrompt prompt={updatePrompt} onDismiss={() => setUpdatePrompt(null)} />
        <Toast toast={toast} />
        <header className="hero">
          <div>
            <p className="eyebrow">Manager</p>
            <h1>Manager Dashboard</h1>
            <p className="tagline">Overview and tools for managing the app.</p>
          </div>
          <div className="hero-card">
            <span>Logged in as</span>
            <strong>{currentUser.name}</strong>
            <button className="ghost small" type="button" onClick={handleLogout}>Log out</button>
          </div>
        </header>

        <main>
          <ManagerDashboard profile={profile} bodyLogs={bodyLogs} workouts={workouts} users={users} onExport={exportData} />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <UpdatePrompt prompt={updatePrompt} onDismiss={() => setUpdatePrompt(null)} />
      <Toast toast={toast} />
      <header className="hero">
        <div>
          <p className="eyebrow">ðŸª¨ The Cave Project</p>
          <h1>The Cavemanâ€™s Sweat Log</h1>
          <p className="tagline">Lift. Log. Evolve.</p>
        </div>
        <div className="hero-card">
          <span>Logged in as</span>
          <strong>{currentUser.name}</strong>
          <button className="ghost small" type="button" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <nav className="tabs" aria-label="Main navigation">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button className={activeTab === 'body' ? 'active' : ''} onClick={() => setActiveTab('body')}>Body Log</button>
        <button className={activeTab === 'workout' ? 'active' : ''} onClick={() => setActiveTab('workout')}>Workout Log</button>
        <button className={activeTab === 'exercises' ? 'active' : ''} onClick={() => setActiveTab('exercises')}>Exercises</button>
        <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>Settings</button>
      </nav>

      <main>
        {activeTab === 'dashboard' && <Dashboard profile={profile} bodyLogs={bodyLogs} workouts={workouts} />}
        {activeTab === 'body' && <BodyLog profile={profile} bodyLogs={bodyLogs} onAdd={addBodyLog} onDelete={deleteBodyLog} />}
        {activeTab === 'workout' && <WorkoutLog workouts={workouts} onAdd={addWorkout} onDelete={deleteWorkout} onToast={showToast} />}
        {activeTab === 'exercises' && <ExerciseLibrary workouts={workouts} />}
        {activeTab === 'settings' && <Settings profile={profile} onSave={updateProfile} onExport={exportData} onImport={importData} onToast={showToast} />}
      </main>
    </div>
  );
}

function UpdatePrompt({ prompt, onDismiss }) {
  const [isUpdating, setIsUpdating] = useState(false);

  if (!prompt) return null;

  function handleUpdate() {
    setIsUpdating(true);
    prompt.update?.();
  }

  return (
    <aside className="update-prompt" role="status" aria-live="polite">
      <div>
        <strong>Update available</strong>
        <p>A new version of The Caveman&apos;s Sweat Log is ready.</p>
      </div>
      <div className="update-actions">
        <button className="primary small" type="button" onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? 'Updating...' : 'Update now'}
        </button>
        <button className="ghost small" type="button" onClick={onDismiss} aria-label="Dismiss update notice">Dismiss</button>
      </div>
    </aside>
  );
}

function Toast({ toast }) {
  if (!toast) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      <div className={`toast toast-${toast.type}`} key={toast.id}>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();

    if (onLogin(username, password)) {
      setError('');
      return;
    }

    setError('Username or password is wrong.');
  }

  return (
    <main className="login-shell">
      <section className="card login-card">
        <p className="eyebrow">The Cave Project</p>
        <h1>The Caveman's Sweat Log</h1>
        <p className="muted">Enter your username and password to continue.</p>

        <form onSubmit={handleSubmit} className="form-grid login-form">
          <Input label="Username" value={username} onChange={setUsername} />
          <Input label="Password" type="password" value={password} onChange={setPassword} />
          {error && <p className="error-message full">{error}</p>}
          <button className="primary full" type="submit">Log In</button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ profile, bodyLogs, workouts }) {
  const latestBody = bodyLogs[0];
  const latestWorkout = workouts[0];
  const weightLogs = useMemo(() => getBodyMetricLogs(bodyLogs, 'weightKg'), [bodyLogs]);
  const waistLogs = useMemo(() => getBodyMetricLogs(bodyLogs, 'waistCm'), [bodyLogs]);
  const latestWeight = weightLogs[0]?.value ?? null;
  const previousWeight = weightLogs[1]?.value ?? null;
  const latestWaist = waistLogs[0]?.value ?? null;
  const previousWaist = waistLogs[1]?.value ?? null;
  const totalWorkoutEntries = workouts.reduce((total, workout) => total + (workout.entries?.length || 0), 0);
  const personalRecords = useMemo(() => getPersonalRecords(workouts), [workouts]);
  const exerciseProgressOptions = useMemo(() => getExerciseProgressOptions(workouts), [workouts]);
  const [selectedProgressExerciseId, setSelectedProgressExerciseId] = useState('');
  const activeProgressExerciseId = exerciseProgressOptions.some((option) => option.exerciseId === selectedProgressExerciseId)
    ? selectedProgressExerciseId
    : exerciseProgressOptions[0]?.exerciseId || '';
  const exerciseProgress = useMemo(
    () => getExerciseProgress(workouts, activeProgressExerciseId),
    [workouts, activeProgressExerciseId]
  );
  const weeklyGoal = getWeeklyGoalValue(profile.weeklyGoal);
  const weeklyStats = useMemo(() => getWeeklyWorkoutStats(workouts, weeklyGoal), [workouts, weeklyGoal]);
  const thisWeekWorkouts = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    return workouts.filter((workout) => new Date(workout.date) >= sevenDaysAgo).length;
  }, [workouts]);

  const latestBMI = latestBody?.bmi ?? calculateBMI(latestWeight, profile.heightCm);

  return (
    <section className="grid two">
      <article className="card big-card">
        <p className="eyebrow">Today</p>
        <h2>Welcome back, {profile.name || 'Caveman'}.</h2>
        <p>Log the work. Watch the trend. No drama, just data.</p>
      </article>

      <article className="card stats-card">
        <Stat label="Latest weight" value={`${formatNumber(latestWeight)} kg`} />
        <Stat label="Latest waist" value={`${formatNumber(latestWaist)} cm`} />
        <Stat label="Current BMI" value={latestBMI ? `${latestBMI} Â· ${getBMICategory(latestBMI)}` : '-'} />
        <Stat label="Workouts last 7 days" value={thisWeekWorkouts} />
      </article>

      <TrendCard title="Weight Trend" unit="kg" logs={weightLogs} />
      <TrendCard title="Waist Trend" unit="cm" logs={waistLogs} />

      <WeeklyGoalCard stats={weeklyStats} />

      <article className="card stats-card">
        <h3>Workout Summary</h3>
        <Stat label="Total workouts" value={workouts.length} />
        <Stat label="Latest workout date" value={latestWorkout?.date || '-'} />
        <Stat label="Exercise entries" value={totalWorkoutEntries} />
      </article>

      <article className="card">
        <h3>Recent Progress</h3>
        <div className="progress-list">
          <ProgressRow label="Latest weight" value={latestWeight} unit="kg" />
          <ProgressRow label="Previous weight" value={previousWeight} unit="kg" />
          <ProgressRow label="Weight difference" value={latestWeight !== null && previousWeight !== null ? latestWeight - previousWeight : null} unit="kg" isDifference />
          <ProgressRow label="Latest waist" value={latestWaist} unit="cm" />
          <ProgressRow label="Previous waist" value={previousWaist} unit="cm" />
          <ProgressRow label="Waist difference" value={latestWaist !== null && previousWaist !== null ? latestWaist - previousWaist : null} unit="cm" isDifference />
        </div>
      </article>

      <article className="card full">
        <h3>Personal Records</h3>
        {personalRecords.length ? (
          <div className="record-list">
            {personalRecords.map((record) => (
              <div className="record-item" key={record.exerciseId}>
                <div>
                  <strong>{record.exerciseName}</strong>
                  <p>Best lift: {formatNumber(record.bestKg)} kg x {formatNumber(record.bestRepsAtBestKg, 0)} reps</p>
                </div>
                <div>
                  <span>Best set volume</span>
                  <strong>{formatNumber(record.bestVolume, 0)}</strong>
                </div>
                <div>
                  <span>Latest</span>
                  <strong>{record.latestDate || '-'}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Log workouts to see your personal records.</p>
        )}
      </article>

      <ExerciseProgressCard
        options={exerciseProgressOptions}
        selectedExerciseId={activeProgressExerciseId}
        onSelectExercise={setSelectedProgressExerciseId}
        progress={exerciseProgress}
      />

      <article className="card">
        <h3>Latest Body Log</h3>
        {latestBody ? (
          <div className="simple-list">
            <p><strong>{latestBody.date}</strong></p>
            <p>Weight: {formatNumber(latestBody.weightKg)} kg</p>
            <p>Waist: {formatNumber(latestBody.waistCm)} cm</p>
            <p>BMI: {latestBody.bmi || '-'} {latestBody.bmiCategory ? `Â· ${latestBody.bmiCategory}` : ''}</p>
          </div>
        ) : (
          <p>No body logs yet. Start with weight and waist.</p>
        )}
      </article>

      <article className="card">
        <h3>Latest Workout</h3>
        {latestWorkout ? (
          <div className="simple-list">
            <p><strong>{latestWorkout.title}</strong> Â· {latestWorkout.date}</p>
            <p>{latestWorkout.entries.length} exercise entries</p>
            <p>{latestWorkout.note || 'No note'}</p>
          </div>
        ) : (
          <p>No workouts yet. Save your first sweat.</p>
        )}
      </article>
    </section>
  );
}

function WeeklyGoalCard({ stats }) {
  return (
    <article className="card weekly-goal-card">
      <div className="section-heading">
        <div>
          <h3>Weekly Goal</h3>
          <p className="muted">{stats.message}</p>
        </div>
        <div className="streak-pill">
          <span>Workout Streak</span>
          <strong>{stats.workoutStreak} week{stats.workoutStreak === 1 ? '' : 's'}</strong>
        </div>
      </div>

      <div className="goal-progress" aria-label="Weekly goal progress">
        <div className="goal-progress-bar" style={{ width: `${stats.progressPercent}%` }} />
      </div>

      <div className="weekly-goal-grid">
        <Stat label="This week" value={`${stats.workoutsThisWeek} / ${stats.weeklyGoal}`} />
        <Stat label="Remaining" value={stats.remainingWorkouts} />
        <Stat label="Latest workout" value={stats.latestWorkoutDate || '-'} />
        <Stat label="Days since last" value={stats.daysSinceLastWorkout ?? '-'} />
      </div>
    </article>
  );
}

function ExerciseProgressCard({ options, selectedExerciseId, onSelectExercise, progress }) {
  const pickerOptions = options.map((option) => ({
    value: option.exerciseId,
    label: option.exerciseName
  }));
  const chartPoints = progress.slice(-8);
  const values = chartPoints.map((point) => point.totalVolume);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pathPoints = chartPoints.map((point, index) => {
    const x = chartPoints.length === 1 ? 50 : (index / (chartPoints.length - 1)) * 100;
    const y = 90 - ((point.totalVolume - min) / range) * 70;
    return `${x},${y}`;
  }).join(' ');

  return (
    <article className="card full">
      <div className="section-heading">
        <div>
          <h3>Exercise Progress</h3>
          <p className="muted">Track best kg and volume over time for one exercise.</p>
        </div>
        <label className="compact-select">
          <span>Exercise</span>
          <AppSelect
            pickerId="dashboard-progress-exercise"
            value={selectedExerciseId}
            onChange={onSelectExercise}
            options={pickerOptions}
            placeholder="Choose exercise"
            ariaLabel="Exercise progress exercise"
          />
        </label>
      </div>

      {!options.length ? (
        <p className="muted">Log workouts to see exercise progress.</p>
      ) : progress.length < 2 ? (
        <p className="muted">Log this exercise more than once to see progress over time.</p>
      ) : (
        <div className="exercise-progress">
          <div className="trend-card">
            <svg viewBox="0 0 100 100" role="img" aria-label="Exercise progress chart" preserveAspectRatio="none">
              <polyline points={pathPoints} />
              {chartPoints.map((point, index) => {
                const x = chartPoints.length === 1 ? 50 : (index / (chartPoints.length - 1)) * 100;
                const y = 90 - ((point.totalVolume - min) / range) * 70;
                return <circle key={`${point.date}-${index}`} cx={x} cy={y} r="2.5" />;
              })}
            </svg>
            <div className="trend-labels">
              <span>{chartPoints[0].date}</span>
              <strong>{formatNumber(chartPoints[chartPoints.length - 1].totalVolume, 0)} volume</strong>
              <span>{chartPoints[chartPoints.length - 1].date}</span>
            </div>
          </div>

          <div className="exercise-progress-table">
            <div className="exercise-progress-row exercise-progress-head">
              <span>Date</span>
              <span>Best kg</span>
              <span>Best set volume</span>
              <span>Total volume</span>
            </div>
            {progress.map((point) => (
              <div className="exercise-progress-row" key={point.date}>
                <strong>{point.date}</strong>
                <span>{formatNumber(point.bestKg)} kg</span>
                <span>{formatNumber(point.bestSetVolume, 0)}</span>
                <span>{formatNumber(point.totalVolume, 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TrendCard({ title, unit, logs }) {
  const points = logs.slice(0, 8).reverse();
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pathPoints = points.map((point, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 90 - ((point.value - min) / range) * 70;
    return `${x},${y}`;
  }).join(' ');

  return (
    <article className="card">
      <h3>{title}</h3>
      {points.length >= 2 ? (
        <div className="trend-card">
          <svg viewBox="0 0 100 100" role="img" aria-label={`${title} chart`} preserveAspectRatio="none">
            <polyline points={pathPoints} />
            {points.map((point, index) => {
              const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
              const y = 90 - ((point.value - min) / range) * 70;
              return <circle key={`${point.date}-${index}`} cx={x} cy={y} r="2.5" />;
            })}
          </svg>
          <div className="trend-labels">
            <span>{points[0].date}</span>
            <strong>{formatNumber(points[points.length - 1].value)} {unit}</strong>
            <span>{points[points.length - 1].date}</span>
          </div>
        </div>
      ) : (
        <p className="muted">Add more body logs to see your progress trend.</p>
      )}
    </article>
  );
}

function ProgressRow({ label, value, unit, isDifference = false }) {
  return (
    <div className="progress-row">
      <span>{label}</span>
      <strong>{isDifference ? formatDifference(value, unit) : `${formatNumber(value)} ${unit}`}</strong>
    </div>
  );
}

function AppVersionLabel() {
  return (
    <div className="app-version">
      <strong>{APP_VERSION}</strong>
      <span>{APP_VERSION_CONTEXT}</span>
    </div>
  );
}

function ManagerDashboard({ users, onExport }) {
  const regularUsers = users.filter((user) => user.username !== 'manager');
  const userSummaries = regularUsers.map((user) => {
    const keys = getUserStorageKeys(user.username);
    const profile = loadFromStorage(keys.profile, getEmptyProfile());
    const bodyLogs = loadFromStorage(keys.bodyLogs, []);
    const workouts = loadFromStorage(keys.workouts, []);
    const workoutEntries = workouts.reduce((total, workout) => total + (workout.entries?.length || 0), 0);

    return {
      user,
      keys,
      profile,
      bodyLogs,
      workouts,
      workoutEntries,
      latestBody: bodyLogs[0],
      latestWorkout: workouts[0]
    };
  });

  const totalBodyLogs = userSummaries.reduce((total, summary) => total + summary.bodyLogs.length, 0);
  const totalWorkouts = userSummaries.reduce((total, summary) => total + summary.workouts.length, 0);
  const totalWorkoutEntries = userSummaries.reduce((total, summary) => total + summary.workoutEntries, 0);
  const recentItems = userSummaries
    .flatMap((summary) => [
      summary.latestBody
        ? {
            label: `${summary.user.name} body log`,
            date: summary.latestBody.date,
            detail: `${summary.latestBody.weightKg || '-'} kg, waist ${summary.latestBody.waistCm || '-'} cm`
          }
        : null,
      summary.latestWorkout
        ? {
            label: `${summary.user.name} workout`,
            date: summary.latestWorkout.date,
            detail: `${summary.latestWorkout.title} (${summary.latestWorkout.entries?.length || 0} entries)`
          }
        : null
    ])
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const storageOverview = userSummaries.flatMap((summary) => [
    { key: summary.keys.profile, description: `Profile for ${summary.profile.name || summary.user.name}` },
    { key: summary.keys.bodyLogs, description: `${summary.bodyLogs.length} body logs` },
    { key: summary.keys.workouts, description: `${summary.workouts.length} workouts` }
  ]);
  const legacyStorageOverview = [
    { key: LEGACY_STORAGE_KEYS.profile, description: hasStoredValue(LEGACY_STORAGE_KEYS.profile) ? 'Old shared profile key exists' : 'Old shared profile key not found' },
    { key: LEGACY_STORAGE_KEYS.bodyLogs, description: hasStoredValue(LEGACY_STORAGE_KEYS.bodyLogs) ? 'Old shared body logs key exists' : 'Old shared body logs key not found' },
    { key: LEGACY_STORAGE_KEYS.workouts, description: hasStoredValue(LEGACY_STORAGE_KEYS.workouts) ? 'Old shared workouts key exists' : 'Old shared workouts key not found' }
  ];

  return (
    <section className="grid two">
      <article className="card big-card">
        <p className="eyebrow">Manager</p>
        <h2>Manager Dashboard</h2>
        <p>Overview and tools for managing the app.</p>
        <AppVersionLabel />
      </article>

      <article className="card stats-card">
        <Stat label="Regular users" value={regularUsers.length} />
        <Stat label="Body logs" value={totalBodyLogs} />
        <Stat label="Workouts" value={totalWorkouts} />
        <Stat label="Workout entries" value={totalWorkoutEntries} />
      </article>

      <article className="card">
        <h3>User Overview</h3>
        <div className="simple-list">
          {users.map((user) => (
            <p key={user.username}><strong>{user.name}</strong> Â· {user.username}</p>
          ))}
        </div>
      </article>

      <article className="card stats-card">
        <h3>App Statistics</h3>
        <Stat label="Hardcoded login users" value={users.length} />
        <Stat label="Namespaced user datasets" value={storageOverview.length} />
        <Stat label="Saved local datasets" value={storageOverview.length} />
      </article>

      <article className="card">
        <h3>Local Storage Overview</h3>
        <div className="simple-list">
          {storageOverview.map((item) => (
            <div key={item.key}>
              <p><strong>{item.key}</strong></p>
              <p>{item.description}</p>
            </div>
          ))}
          {legacyStorageOverview.map((item) => (
            <div key={item.key}>
              <p><strong>{item.key}</strong></p>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <h3>Export Data</h3>
        <p className="muted">Download the current browser-local profile, body logs, and workout logs.</p>
        <button className="secondary" type="button" onClick={onExport}>Export Data</button>
      </article>

      <article className="card">
        <h3>Maintenance Tools</h3>
        <p className="muted">Reset and cleanup tools can be added here later. No destructive tools are enabled yet.</p>
      </article>

      <article className="card">
        <h3>Recent Activity</h3>
        {recentItems.length ? (
          <div className="simple-list">
            {recentItems.map((item) => (
              <div key={item.label}>
                <p><strong>{item.label}</strong> Â· {item.date}</p>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>No activity has been logged yet.</p>
        )}
      </article>

      <article className="card">
        <h3>Future Admin Tools</h3>
        <p className="muted">Future manager tools could include per-user data, user status, import review, and safer maintenance controls.</p>
      </article>
    </section>
  );
}

function BodyLog({ profile, bodyLogs, onAdd, onDelete }) {
  const [form, setForm] = useState({
    date: getTodayISO(),
    weightKg: '',
    waistCm: '',
    chestCm: '',
    hipsCm: '',
    leftArmCm: '',
    rightArmCm: '',
    leftThighCm: '',
    rightThighCm: '',
    leftCalfCm: '',
    rightCalfCm: '',
    note: ''
  });

  const previewBMI = calculateBMI(form.weightKg, profile.heightCm);

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.weightKg && !form.waistCm) return;
    onAdd(form);
    setForm({ ...form, weightKg: '', waistCm: '', note: '' });
  }

  return (
    <section className="grid two">
      <article className="card">
        <h2>Body Log</h2>
        <p className="muted">Daily minimum: weight and waist. The rest can be weekly.</p>

        <form onSubmit={handleSubmit} className="form-grid">
          <Input label="Date" type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} />
          <Input label="Weight kg" type="number" step="0.1" value={form.weightKg} onChange={(value) => setForm({ ...form, weightKg: value })} />
          <Input label="Waist cm" type="number" step="0.1" value={form.waistCm} onChange={(value) => setForm({ ...form, waistCm: value })} />
          <Input label="Chest cm" type="number" step="0.1" value={form.chestCm} onChange={(value) => setForm({ ...form, chestCm: value })} />
          <Input label="Hips cm" type="number" step="0.1" value={form.hipsCm} onChange={(value) => setForm({ ...form, hipsCm: value })} />
          <Input label="Left arm cm" type="number" step="0.1" value={form.leftArmCm} onChange={(value) => setForm({ ...form, leftArmCm: value })} />
          <Input label="Right arm cm" type="number" step="0.1" value={form.rightArmCm} onChange={(value) => setForm({ ...form, rightArmCm: value })} />
          <Input label="Left thigh cm" type="number" step="0.1" value={form.leftThighCm} onChange={(value) => setForm({ ...form, leftThighCm: value })} />
          <Input label="Right thigh cm" type="number" step="0.1" value={form.rightThighCm} onChange={(value) => setForm({ ...form, rightThighCm: value })} />
          <Input label="Left calf cm" type="number" step="0.1" value={form.leftCalfCm} onChange={(value) => setForm({ ...form, leftCalfCm: value })} />
          <Input label="Right calf cm" type="number" step="0.1" value={form.rightCalfCm} onChange={(value) => setForm({ ...form, rightCalfCm: value })} />
          <label className="field full">
            <span>Note</span>
            <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Morning weight, after training, tired, strong, etc." />
          </label>

          <div className="preview-box full">
            <span>BMI preview</span>
            <strong>{previewBMI ? `${previewBMI} Â· ${getBMICategory(previewBMI)}` : 'Add weight + height'}</strong>
          </div>

          <button className="primary full" type="submit">Save Body Log</button>
        </form>
      </article>

      <article className="card">
        <h3>History</h3>
        <div className="log-list">
          {bodyLogs.length === 0 && <p>No body logs yet.</p>}
          {bodyLogs.map((log) => (
            <div className="log-item" key={log.id}>
              <div>
                <strong>{log.date}</strong>
                <p>{log.weightKg || '-'} kg Â· waist {log.waistCm || '-'} cm Â· BMI {log.bmi || '-'}</p>
                {log.note && <small>{log.note}</small>}
              </div>
              <button className="ghost danger" onClick={() => onDelete(log.id)}>Delete</button>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function WorkoutLog({ workouts, onAdd, onDelete, onToast }) {
  const [title, setTitle] = useState('Upper Body');
  const [date, setDate] = useState(getTodayISO());
  const [note, setNote] = useState('');
  const [entries, setEntries] = useState([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState(exercises[0].id);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const selectedExercise = getExerciseById(selectedExerciseId);
  const lastSelected = getLastExerciseEntry(workouts, selectedExerciseId);
  const selectedLastTime = formatLastTime(lastSelected?.entry);
  const exerciseGroups = useMemo(() => {
    return exercises.reduce((acc, exercise) => {
      acc[exercise.muscleGroup] = acc[exercise.muscleGroup] || [];
      acc[exercise.muscleGroup].push(exercise);
      return acc;
    }, {});
  }, []);
  const templateOptions = useMemo(() => [
    { value: '', label: 'Choose template' },
    ...workoutTemplates.map((template) => ({ value: template.id, label: template.name }))
  ], []);
  const exerciseOptionGroups = useMemo(() => Object.entries(exerciseGroups).map(([group, items]) => ({
    label: group,
    options: items.map((exercise) => ({ value: exercise.id, label: exercise.name }))
  })), [exerciseGroups]);
  const kgPickerOptions = useMemo(() => [
    { value: '', label: 'kg' },
    ...kgOptions.map((kg) => ({ value: kg, label: String(kg) }))
  ], []);
  const repPickerOptions = useMemo(() => [
    { value: '', label: 'reps' },
    ...repOptions.map((reps) => ({ value: reps, label: String(reps) }))
  ], []);
  const minutePickerOptions = useMemo(() => [
    { value: '', label: 'min' },
    ...repOptions.map((minutes) => ({ value: minutes, label: String(minutes) }))
  ], []);

  function createExerciseEntry(exercise, usePreviousSets = true) {
    const previous = usePreviousSets ? getLastExerciseEntry(workouts, exercise.id) : null;
    const sets = previous?.entry?.sets?.length
      ? previous.entry.sets.map((set) => ({ kg: set.kg || '', reps: set.reps || exercise.defaultReps || 12 }))
      : Array.from({ length: exercise.defaultSets || 3 }, () => ({ kg: '', reps: exercise.defaultReps || 12 }));

    return {
      id: crypto.randomUUID(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      sets,
      note: ''
    };
  }

  function addExerciseEntry() {
    const exercise = getExerciseById(selectedExerciseId);
    setEntries([...entries, createExerciseEntry(exercise)]);
    triggerHaptic('medium');
    onToast?.('Exercise added âœ“');
  }

  function applyTemplate() {
    const template = workoutTemplates.find((item) => item.id === selectedTemplateId);
    if (!template) return;

    if (entries.length > 0) {
      const ok = window.confirm('Apply template? This will add the template exercises to the workout you are already building.');
      if (!ok) return;
    }

    const templateEntries = template.exerciseIds
      .map((exerciseId) => getExerciseById(exerciseId))
      .filter(Boolean)
      .map((exercise) => createExerciseEntry(exercise, false));

    if (entries.length === 0) {
      setTitle(template.name);
    }
    setEntries([...entries, ...templateEntries]);
    triggerHaptic('medium');
    onToast?.('Template applied âœ“');
  }

  function updateSet(entryId, setIndex, field, value) {
    setEntries(entries.map((entry) => {
      if (entry.id !== entryId) return entry;
      const nextSets = entry.sets.map((set, index) => index === setIndex ? { ...set, [field]: parseSelectNumber(value) } : set);
      return { ...entry, sets: nextSets };
    }));
  }

  function getCopyableSetValues(set) {
    if (!set) return null;
    const kg = set.kg === null || set.kg === undefined ? '' : parseSelectNumber(set.kg);
    const reps = set.reps === null || set.reps === undefined ? '' : parseSelectNumber(set.reps);
    if (kg === '' && reps === '') return null;
    return { kg, reps };
  }

  function getLastSavedSetValues(exerciseId) {
    const last = getLastExerciseEntry(workouts, exerciseId);
    const previousSets = last?.entry?.sets || [];

    for (let index = previousSets.length - 1; index >= 0; index -= 1) {
      const values = getCopyableSetValues(previousSets[index]);
      if (values) return values;
    }

    return null;
  }

  function useLastValues(entryId, setIndex) {
    let didCopy = false;

    setEntries(entries.map((entry) => {
      if (entry.id !== entryId) return entry;
      const sourceValues = setIndex > 0
        ? getCopyableSetValues(entry.sets[setIndex - 1])
        : getLastSavedSetValues(entry.exerciseId);

      if (!sourceValues) return entry;

      didCopy = true;
      return {
        ...entry,
        sets: entry.sets.map((set, index) => index === setIndex ? { ...set, ...sourceValues } : set)
      };
    }));

    if (didCopy) {
      triggerHaptic('light');
      onToast?.('Values copied âœ“');
      return;
    }

    triggerHaptic('error');
    onToast?.('No previous values found', 'info');
  }

  function addSameSet(entryId) {
    setEntries(entries.map((entry) => {
      if (entry.id !== entryId) return entry;
      const lastSet = entry.sets[entry.sets.length - 1] || { kg: '', reps: 12 };
      return { ...entry, sets: [...entry.sets, { ...lastSet }] };
    }));
    triggerHaptic('light');
    onToast?.('Set added âœ“');
  }

  function removeSet(entryId, setIndex) {
    let didRemove = false;
    setEntries(entries.map((entry) => {
      if (entry.id !== entryId) return entry;
      if (entry.sets.length <= 1) return entry;
      didRemove = true;
      return { ...entry, sets: entry.sets.filter((_, index) => index !== setIndex) };
    }));
    if (didRemove) {
      triggerHaptic('light');
      onToast?.('Set removed âœ“');
    }
  }

  function removeEntry(entryId) {
    setEntries(entries.filter((entry) => entry.id !== entryId));
    triggerHaptic('light');
    onToast?.('Exercise removed âœ“');
  }

  function updateEntryNote(entryId, value) {
    setEntries(entries.map((entry) => entry.id === entryId ? { ...entry, note: value } : entry));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (entries.length === 0) return;
    onAdd({ title, date, note, entries });
    setEntries([]);
    setNote('');
  }

  return (
    <section className="grid two">
      <article className="card wide-card">
        <h2>Workout Log</h2>
        <p className="muted">Choose an exercise, add sets, then save sweat.</p>

        <form onSubmit={handleSubmit} className="workout-form">
          <div className="form-grid">
            <Input label="Workout title" value={title} onChange={setTitle} />
            <Input label="Date" type="date" value={date} onChange={setDate} />
          </div>

          <div className="template-box">
            <div>
              <h3>Workout Templates</h3>
              <p className="muted">Choose a template to quickly start a workout. You can adjust kg and reps before saving.</p>
            </div>
            <div className="template-actions">
              <label className="field">
                <span>Template</span>
                <AppSelect
                  pickerId="workout-template"
                  value={selectedTemplateId}
                  onChange={setSelectedTemplateId}
                  options={templateOptions}
                  placeholder="Choose template"
                  ariaLabel="Workout template"
                />
              </label>
              <button type="button" className="secondary" onClick={applyTemplate} disabled={!selectedTemplateId}>Apply Template</button>
            </div>
          </div>

          <div className="add-exercise-row">
            <label className="field">
              <span>Exercise</span>
              <AppSelect
                pickerId="workout-exercise"
                value={selectedExerciseId}
                onChange={setSelectedExerciseId}
                groups={exerciseOptionGroups}
                placeholder="Choose exercise"
                ariaLabel="Workout exercise"
              />
            </label>
            <button type="button" className="secondary" onClick={addExerciseEntry}>Add Exercise</button>
          </div>

          <div className="last-used-box">
            <span>Selected</span>
            <strong>{selectedExercise?.name}</strong>
            {lastSelected && selectedLastTime ? (
              <>
                <p>Last time: {selectedLastTime} on {lastSelected.workout.date}</p>
                <p>Try to match or beat this next time.</p>
              </>
            ) : (
              <p>No previous sets for this exercise yet.</p>
            )}
          </div>

          <div className="exercise-entry-list">
            {entries.map((entry) => {
              const lastForEntry = getLastExerciseEntry(workouts, entry.exerciseId);
              const lastForEntrySets = formatLastTime(lastForEntry?.entry);
              return (
                <div className="exercise-entry" key={entry.id}>
                  <div className="entry-header">
                    <div>
                      <h3>{entry.exerciseName}</h3>
                      {lastForEntry && lastForEntrySets && <p>Last time: {lastForEntrySets} on {lastForEntry.workout.date}</p>}
                    </div>
                    <button type="button" className="ghost danger" onClick={() => removeEntry(entry.id)}>Remove</button>
                  </div>

                  <div className="sets-table">
                    <p className="sets-help">Log total kg. For plate-loaded machines, add both sides. Example: 15 kg per side = 30 kg.</p>
                    <div className="sets-row sets-head">
                      <span>Set</span>
                      <span>Kg</span>
                      <span>Reps</span>
                      <span>Fill</span>
                      <span></span>
                    </div>
                    {entry.sets.map((set, index) => (
                      <div className="sets-row" key={index}>
                        <span>{index + 1}</span>
                        <AppSelect
                          pickerId={`workout-set-${entry.id}-${index}-kg`}
                          value={set.kg ?? ''}
                          onChange={(value) => updateSet(entry.id, index, 'kg', value)}
                          options={kgPickerOptions}
                          placeholder="kg"
                          ariaLabel="Kg"
                        />
                        <AppSelect
                          pickerId={`workout-set-${entry.id}-${index}-${entry.exerciseId === 'treadmill' ? 'minutes' : 'reps'}`}
                          value={set.reps ?? ''}
                          onChange={(value) => updateSet(entry.id, index, 'reps', value)}
                          options={entry.exerciseId === 'treadmill' ? minutePickerOptions : repPickerOptions}
                          placeholder={entry.exerciseId === 'treadmill' ? 'min' : 'reps'}
                          ariaLabel={entry.exerciseId === 'treadmill' ? 'Minutes' : 'Reps'}
                        />
                        <button type="button" className="secondary use-last-button" onClick={() => useLastValues(entry.id, index)}>Use last</button>
                        <button type="button" className="ghost danger mini" onClick={() => removeSet(entry.id, index)} aria-label="Remove set">Ã—</button>
                      </div>
                    ))}
                  </div>

                  <label className="field">
                    <span>Exercise note</span>
                    <input value={entry.note} onChange={(event) => updateEntryNote(entry.id, event.target.value)} placeholder="Heavy, easy, form note..." />
                  </label>
                  <button type="button" className="secondary small" onClick={() => addSameSet(entry.id)}>+ Same Set</button>
                </div>
              );
            })}
          </div>

          <label className="field">
            <span>Workout note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Energy, sleep, pump, cardio after, etc." />
          </label>

          <button className="primary" type="submit">Save Sweat</button>
        </form>
      </article>

      <article className="card">
        <h3>Workout History</h3>
        <div className="log-list">
          {workouts.length === 0 && <p>No workouts yet.</p>}
          {workouts.map((workout) => (
            <div className="workout-history-card" key={workout.id}>
              <div className="entry-header">
                <div>
                  <strong>{workout.title}</strong>
                  <p>{workout.date}</p>
                </div>
                <button className="ghost danger" onClick={() => onDelete(workout.id)}>Delete</button>
              </div>
              {workout.entries.map((entry) => (
                <div className="history-exercise" key={entry.id}>
                  <strong>{entry.exerciseName}</strong>
                  <p>{formatSets(entry.sets)}</p>
                  {entry.note && <small>{entry.note}</small>}
                </div>
              ))}
              {workout.note && <small>{workout.note}</small>}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function ExerciseLibrary({ workouts }) {
  const [openExerciseCategory, setOpenExerciseCategory] = useState(null);
  const groups = useMemo(() => {
    return exercises.reduce((acc, exercise) => {
      acc[exercise.muscleGroup] = acc[exercise.muscleGroup] || [];
      acc[exercise.muscleGroup].push(exercise);
      return acc;
    }, {});
  }, []);

  return (
    <section className="card">
      <h2>Exercise Library</h2>
      <p className="muted">Your current cave-approved machine list.</p>

      <div className="exercise-accordion">
        {Object.entries(groups).map(([group, items]) => (
          <details className="exercise-group" key={group} open={openExerciseCategory === group}>
            <summary
              onClick={(event) => {
                event.preventDefault();
                setOpenExerciseCategory(openExerciseCategory === group ? null : group);
                triggerHaptic('light');
              }}
            >
              <span>{group}</span>
              <small>{items.length} exercises</small>
            </summary>
            <div className="exercise-group-list">
              {items.map((exercise) => {
                const last = getLastExerciseEntry(workouts, exercise.id);
                return (
                  <div className="exercise-card" key={exercise.id}>
                    <div className="exercise-card-header">
                      <strong>{exercise.name}</strong>
                      <span>{exercise.norwegianName}</span>
                    </div>
                    <p>{exercise.defaultSets} x {exercise.defaultReps} Â· {exercise.equipment}</p>
                    {last && <p className="last-line">Last: {formatSets(last.entry.sets)}</p>}
                    <small>{exercise.note}</small>
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function Settings({ profile, onSave, onExport, onImport, onToast }) {
  const [form, setForm] = useState(profile);
  const age = form.birthYear ? new Date().getFullYear() - Number(form.birthYear) : null;
  const weeklyGoal = getWeeklyGoalValue(form.weeklyGoal);
  const selectedTheme = getThemeOption(form.theme).id;

  function handleSubmit(event) {
    event.preventDefault();
    onSave({ ...form, weeklyGoal, theme: selectedTheme });
  }

  function handleThemeChange(themeId) {
    const nextForm = { ...form, theme: themeId };
    setForm(nextForm);
    onSave({ ...nextForm, weeklyGoal: getWeeklyGoalValue(nextForm.weeklyGoal), theme: themeId });
    triggerHaptic('medium');
    onToast?.('Theme updated âœ“');
  }

  function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        onImport(data);
      } catch {
        alert('Could not read that file. Choose a valid Caveman backup .json file.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  return (
    <section className="grid two">
      <article className="card">
        <h2>Settings</h2>
        <p className="muted">Profile data is used for BMI and goal context.</p>
        <AppVersionLabel />

        <form onSubmit={handleSubmit} className="form-grid">
          <Input label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <Input label="Height cm" type="number" value={form.heightCm} onChange={(value) => setForm({ ...form, heightCm: value })} />
          <Input label="Birth year" type="number" value={form.birthYear} onChange={(value) => setForm({ ...form, birthYear: value })} />
          <Input label="Target weight kg" type="number" step="0.1" value={form.targetWeightKg} onChange={(value) => setForm({ ...form, targetWeightKg: value })} />
          <Input label="Target waist cm" type="number" step="0.1" value={form.targetWaistCm} onChange={(value) => setForm({ ...form, targetWaistCm: value })} />
          <Input label="Weekly workout goal" type="number" value={form.weeklyGoal ?? DEFAULT_WEEKLY_WORKOUT_GOAL} onChange={(value) => setForm({ ...form, weeklyGoal: value })} />
          <label className="field">
            <span>Theme</span>
            <AppSelect
              pickerId="settings-theme"
              value={selectedTheme}
              onChange={handleThemeChange}
              options={THEME_OPTIONS.map((theme) => ({ value: theme.id, label: theme.name }))}
              placeholder="Choose theme"
              ariaLabel="App theme"
            />
          </label>
          <label className="field full">
            <span>Goal</span>
            <input value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value })} />
          </label>
          <button className="primary full" type="submit">Save Settings</button>
        </form>
      </article>

      <article className="card stats-card">
        <Stat label="Height" value={`${form.heightCm || '-'} cm`} />
        <Stat label="Age" value={age || '-'} />
        <Stat label="Goal" value={form.goal || '-'} />
        <Stat label="Target waist" value={form.targetWaistCm ? `${form.targetWaistCm} cm` : '-'} />
        <Stat label="Weekly workout goal" value={weeklyGoal} />
        <Stat label="Theme" value={getThemeOption(form.theme).name} />
      </article>

      <article className="card full data-card">
        <h2>Backup</h2>
        <p className="muted">Export before switching devices or browsers. Import replaces the data on this device.</p>
        <p className="muted">This backup belongs to the currently logged-in user on this device.</p>
        <div className="backup-actions">
          <button className="secondary" type="button" onClick={onExport}>Export My Data</button>
          <label className="secondary import-button">
            Import My Data
            <input type="file" accept="application/json,.json" onChange={handleImport} />
          </label>
        </div>
      </article>
    </section>
  );
}

function Input({ label, value, onChange, type = 'text', step }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} step={step} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

let activePickerId = null;
const activePickerListeners = new Set();

function setActivePickerId(nextPickerId) {
  activePickerId = nextPickerId;
  activePickerListeners.forEach((listener) => listener(activePickerId));
}

function useActivePickerId() {
  const [currentPickerId, setCurrentPickerId] = useState(activePickerId);

  useEffect(() => {
    activePickerListeners.add(setCurrentPickerId);

    return () => {
      activePickerListeners.delete(setCurrentPickerId);
    };
  }, []);

  return [currentPickerId, setActivePickerId];
}

function useIsMobilePicker() {
  const [isMobilePicker, setIsMobilePicker] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px), (hover: none) and (pointer: coarse)');

    function handleChange() {
      setIsMobilePicker(media.matches);
    }

    handleChange();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange);
    } else {
      media.addListener(handleChange);
    }

    return () => {
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  return isMobilePicker;
}

function AppSelect({ pickerId, value, onChange, options = [], groups = [], placeholder = 'Select', ariaLabel, className = '' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const pickerRef = useRef(null);
  const popoverRef = useRef(null);
  const generatedPickerId = useRef(`picker-${crypto.randomUUID()}`).current;
  const pickerInstanceId = pickerId || generatedPickerId;
  const [activePicker, setActivePicker] = useActivePickerId();
  const isMobilePicker = useIsMobilePicker();
  const searchInputRef = useRef(null);
  const selectedOptionRef = useRef(null);
  const selectId = `options-${pickerInstanceId}`;
  const isOpen = activePicker === pickerInstanceId;
  const optionGroups = groups.length ? groups : [{ label: '', options }];
  const flatOptions = optionGroups.flatMap((group) => group.options);
  const shouldShowSearch = flatOptions.length > 12;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleGroups = normalizedSearch
    ? optionGroups
        .map((group) => ({
          ...group,
          options: group.options.filter((option) => String(option.label).toLowerCase().includes(normalizedSearch))
        }))
        .filter((group) => group.options.length)
    : optionGroups;
  const selectedOption = flatOptions.find((option) => String(option.value) === String(value ?? ''));
  const displayLabel = selectedOption?.label || placeholder;

  useEffect(() => {
    if (!isOpen) return undefined;

    document.body.classList.add('picker-open');

    function handlePointerDown(event) {
      const isInsideTrigger = pickerRef.current?.contains(event.target);
      const isInsidePopover = popoverRef.current?.contains(event.target);
      if (!isInsideTrigger && !isInsidePopover) {
        setActivePicker(null);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setActivePicker(null);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('picker-open');
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setActivePicker]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      return;
    }

    window.requestAnimationFrame(() => {
      if (shouldShowSearch) {
        searchInputRef.current?.focus();
      }
      selectedOptionRef.current?.scrollIntoView({ block: 'nearest' });
    });
  }, [isOpen, shouldShowSearch]);

  function handleOptionSelect(option) {
    if (option.disabled) return;
    onChange(option.value);
    setActivePicker(null);
    triggerHaptic('light');
  }

  function openPicker() {
    setActivePicker(pickerInstanceId);
    triggerHaptic('light');
  }

  function togglePicker() {
    if (isOpen) {
      setActivePicker(null);
      return;
    }

    openPicker();
  }

  function renderOptions(optionClassName = 'app-picker-option') {
    return visibleGroups.length ? visibleGroups.map((group) => (
      <div className="app-picker-group" key={group.label || 'options'}>
        {group.label && <div className="app-picker-group-label">{group.label}</div>}
        {group.options.map((option) => {
          const isSelected = String(option.value) === String(value ?? '');
          return (
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              className={isSelected ? `${optionClassName} selected` : optionClassName}
              key={`${group.label}-${option.value}`}
              disabled={option.disabled}
              onClick={() => handleOptionSelect(option)}
              ref={isSelected ? selectedOptionRef : null}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    )) : (
      <p className="app-picker-empty">No matching options.</p>
    );
  }

  const desktopPickerLayer = (
    <>
      <button className="app-picker-backdrop" type="button" aria-label="Close picker" onClick={() => setActivePicker(null)} />
      <div className="app-picker-popover" ref={popoverRef}>
        {shouldShowSearch && (
          <div className="app-picker-search">
            <input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={`Search ${placeholder.toLowerCase()}`}
              aria-label={`Search ${ariaLabel || placeholder}`}
            />
          </div>
        )}
        <div className="app-picker-options" role="listbox" id={selectId} aria-label={ariaLabel || placeholder}>
          {renderOptions()}
        </div>
      </div>
    </>
  );

  const mobilePickerLayer = (
    <>
      <button className="app-select-mobile-overlay" type="button" aria-label="Close picker" onClick={() => setActivePicker(null)} />
      <div className="app-select-mobile-modal" ref={popoverRef} role="dialog" aria-modal="true" aria-label={ariaLabel || placeholder}>
        <div className="app-select-mobile-header">
          <div>
            <span>Choose</span>
            <strong>{ariaLabel || placeholder}</strong>
          </div>
          <button className="ghost small" type="button" onClick={() => setActivePicker(null)}>Close</button>
        </div>
        {shouldShowSearch && (
          <div className="app-select-mobile-search">
            <input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={`Search ${placeholder.toLowerCase()}`}
              aria-label={`Search ${ariaLabel || placeholder}`}
            />
          </div>
        )}
        <div className="app-select-mobile-options" role="listbox" id={selectId} aria-label={ariaLabel || placeholder}>
          {renderOptions('app-select-mobile-option')}
        </div>
      </div>
    </>
  );

  return (
    <div className={`app-picker ${className}`.trim()} ref={pickerRef}>
      <button
        type="button"
        className="app-picker-trigger"
        aria-label={ariaLabel || placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={selectId}
        onClick={togglePicker}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            openPicker();
          }
        }}
      >
        <span>{displayLabel}</span>
        <span className="app-picker-chevron" aria-hidden="true">v</span>
      </button>

      {isOpen && (isMobilePicker && typeof document !== 'undefined' ? createPortal(mobilePickerLayer, document.body) : desktopPickerLayer)}
    </div>
  );
}

export default App;
