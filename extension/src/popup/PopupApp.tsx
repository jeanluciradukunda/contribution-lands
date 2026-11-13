import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import iconUrl from '../../icon.svg';
import { aggregateCalendars, loadWatchedAccounts, CACHE_STORAGE_KEY, MAX_ACCOUNTS, normalizeAccounts, normalizeUsername, rollingDateRange, type AccountCalendarResult } from '@/lib/accounts';
import { computeStats, formatDate, formatRange } from '@/content/stats';
import { DEFAULT_DISPLAY, loadDisplaySettings, loadPopupSettings, type DisplaySettings } from './storage';
import { LandView } from './LandView';
import SettingsPanel from './SettingsPanel';
import { firstReadyTheme } from './theme-registry';

const ACCOUNTS_KEY = 'contributionLandsWatchedAccounts';
const storageAvailable = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;

async function readAccounts(): Promise<string[]> {
  const saved = storageAvailable()
    ? (await chrome.storage.local.get(ACCOUNTS_KEY))[ACCOUNTS_KEY]
    : JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]');
  return normalizeAccounts(Array.isArray(saved) ? saved.filter((v): v is string => typeof v === 'string') : []);
}

async function persistAccounts(accounts: string[]) {
  if (storageAvailable()) {
    await chrome.storage.local.set({ [ACCOUNTS_KEY]: accounts });
    if (!accounts.length) await chrome.storage.local.remove(CACHE_STORAGE_KEY);
  } else {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    if (!accounts.length) localStorage.removeItem(CACHE_STORAGE_KEY);
  }
}

function EmptyCity() {
  return <div className="empty-city" aria-hidden="true">
    {[1, 3, 4, 2].map((level, index) => {
      const src = firstReadyTheme?.previewSprites[level as 1 | 2 | 3 | 4];
      return src ? <img src={src} alt="" key={index} /> : null;
    })}
  </div>;
}

export default function PopupApp() {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [manage, setManage] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [inputError, setInputError] = useState('');
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<AccountCalendarResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const forceRefresh = useRef(false);
  const [themeId, setThemeId] = useState<string | null>('city-nyc');
  const [display, setDisplay] = useState<DisplaySettings>(DEFAULT_DISPLAY);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const range = useMemo(() => rollingDateRange(), []);

  useEffect(() => {
    let active = true;
    void readAccounts().then((saved) => {
      if (!active) return;
      setAccounts(saved);
      setManage(saved.length === 0);
      setReady(true);
    }).catch(() => {
      if (!active) return;
      setReady(true);
      setManage(true);
      setInputError('Could not read your saved accounts. Try reopening the popup.');
    });
    void loadPopupSettings().then((s) => { if (active) setThemeId(s.selectedThemeId ?? 'city-nyc'); }).catch(() => { /* Keep the default world if storage is unavailable. */ });
    void loadDisplaySettings().then((s) => { if (active) setDisplay(s); }).catch(() => { /* Keep default display settings. */ });
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local') {
        setDisplay((current) => {
          const next = { ...current };
          for (const key of Object.keys(DEFAULT_DISPLAY) as Array<keyof DisplaySettings>) {
            if (changes[key]) Object.assign(next, { [key]: changes[key].newValue ?? DEFAULT_DISPLAY[key] });
          }
          return next;
        });
      }
      if (area === 'sync' && changes.contributionLandsPopupSettings) {
        const saved = changes.contributionLandsPopupSettings.newValue as { selectedThemeId?: unknown } | undefined;
        const id = saved?.selectedThemeId;
        setThemeId(typeof id === 'string' ? id : 'city-nyc');
      }
    };
    if (storageAvailable()) chrome.storage.onChanged.addListener(changed);
    return () => {
      active = false;
      if (storageAvailable()) chrome.storage.onChanged.removeListener(changed);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setSelectedDate(null);
    setLoadError('');
    if (!accounts.length) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const force = forceRefresh.current;
    forceRefresh.current = false;
    void loadWatchedAccounts(accounts, {
      range, force, signal: controller.signal,
      onUpdate: (next) => { if (!controller.signal.aborted) setResults(next); },
    }).then((next) => {
      if (!controller.signal.aborted) setResults(next);
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError('Could not update your land. Try refreshing in a moment.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [accounts, ready, range, refresh]);

  const watchedResults = useMemo(() => accounts.map((account) =>
    results.find((result) => result.username.toLowerCase() === account.toLowerCase())
    ?? { username: account, days: [], status: 'error' as const, fetchedAt: null, incomplete: true }
  ), [accounts, results]);
  const aggregate = useMemo(() => aggregateCalendars(watchedResults, range, display.scale), [watchedResults, range, display.scale]);
  const hasData = watchedResults.some((result) => result.days.length > 0);
  const stats = useMemo(() => hasData && aggregate.days.length ? computeStats(aggregate.days) : null, [hasData, aggregate.days]);
  const problems = watchedResults.filter((r) => r.error);
  const hasStale = watchedResults.some((r) => r.status === 'stale');
  const updatedTimes = watchedResults.map((r) => r.fetchedAt).filter((v): v is number => v !== null);
  const lastUpdated = updatedTimes.length ? new Date(Math.min(...updatedTimes)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const selectedDay = selectedDate ? aggregate.days.find((day) => day.date === selectedDate) : null;

  async function changeAccounts(next: string[]) {
    setSaving(true);
    try { await persistAccounts(next); setAccounts(next); setInputError(''); return true; }
    catch { setInputError('Could not save your accounts. Please try again.'); return false; }
    finally { setSaving(false); }
  }

  async function addAccount(event: FormEvent) {
    event.preventDefault();
    const candidate = normalizeUsername(username);
    if (!candidate) { setInputError('Enter a valid GitHub username or profile URL.'); return; }
    if (accounts.some((account) => account.toLowerCase() === candidate.toLowerCase())) { setInputError('You are already watching that account.'); return; }
    if (accounts.length >= MAX_ACCOUNTS) { setInputError('You can watch up to ' + MAX_ACCOUNTS + ' accounts.'); return; }
    if (await changeAccounts([...accounts, candidate])) setUsername('');
  }

  return (
    <main className="popup viewer-popup">
      <header className="popup-header">
        <img src={iconUrl} alt="" className="popup-icon" />
        <div className="brand-copy">
          <h1>Contribution Lands</h1>
          <p>Your GitHub activity, together.</p>
        </div>
        <button className="quiet-button" type="button" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}>
          {settingsOpen ? 'Back to land' : 'Settings'}
        </button>
      </header>

      {settingsOpen ? <SettingsPanel /> : <>
        <div className="viewer-toolbar">
          <div><h2>Your land</h2><span className="muted">{accounts.length ? accounts.length + (accounts.length === 1 ? ' account' : ' accounts') + ' · ' + formatRange(range.from, range.to) : 'Build a world from the accounts you watch'}</span></div>
          <div className="toolbar-actions">
            <button type="button" className="quiet-button" aria-expanded={manage} onClick={() => setManage(!manage)}>{manage ? 'Done' : 'Manage accounts'}</button>
            <button type="button" className="quiet-button" disabled={loading || !accounts.length} onClick={() => { forceRefresh.current = true; setRefresh((n) => n + 1); }} aria-label="Refresh contribution data">{loading ? 'Updating…' : 'Refresh'}</button>
          </div>
        </div>

        {manage && <section className="account-manager" aria-label="Accounts to watch">
          <form onSubmit={(event) => void addAccount(event)}>
            <label htmlFor="github-account">Accounts to watch</label>
            <div className="input-row">
              <input id="github-account" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="GitHub username or profile URL" value={username} onChange={(event) => { setUsername(event.target.value); setInputError(''); }} aria-describedby={inputError ? 'account-error' : 'account-hint'} aria-invalid={!!inputError} />
              <button className="primary-button" disabled={saving || !username.trim()} type="submit">Watch account</button>
            </div>
            <p id="account-hint" className="muted">Public contribution calendars. Up to {MAX_ACCOUNTS} accounts.</p>
            {inputError && <p id="account-error" className="error-text" role="alert">{inputError}</p>}
          </form>
          {accounts.length > 0 && <ul className="account-chips">{accounts.map((account) => <li key={account}><span>@{account}</span><button type="button" aria-label={'Stop watching ' + account} disabled={saving} onClick={() => void changeAccounts(accounts.filter((name) => name !== account))}>×</button></li>)}</ul>}
        </section>}

        {!ready ? <div className="empty-state" role="status">Loading your accounts…</div> : !accounts.length ? <div className="empty-state">
          <EmptyCity /><h3>A little city for your corner of GitHub.</h3><p>Add an account above. Watch a few to see their combined activity grow into one land.</p>
          {!manage && <button type="button" className="primary-button" onClick={() => setManage(true)}>Add an account</button>}
        </div> : <>
          {(loadError || problems.length > 0) && <div className="data-warning" role="status">
            {loadError && <p>{loadError}</p>}
            {problems.map((result) => <p key={result.username}><strong>@{result.username}</strong>: {result.error}{result.status === 'stale' ? ' Showing its saved calendar.' : ' Its activity is missing from this land.'}</p>)}
          </div>}
          {hasData && stats ? <>
            {!aggregate.complete && <p className="data-warning" role="status">Partial land: some account data is unavailable. Totals include only the loaded calendars. Streaks are unavailable until all accounts load.</p>}
            <LandView data={aggregate.days} complete={aggregate.complete} themeId={themeId} motion={display.motion} centralPark={display.centralPark} selectedDate={selectedDate} onSelect={(date) => setSelectedDate((current) => current === date ? null : date)} />
            {display.showStats && <dl className="land-stats">
              <div><dt>Contributions</dt><dd>{stats.total.toLocaleString()}</dd></div>
              <div><dt>Average / day</dt><dd>{stats.average}</dd></div>
              <div><dt>Best day</dt><dd>{stats.bestCount.toLocaleString()}</dd></div>
              <div><dt>Current streak</dt><dd>{aggregate.complete ? stats.current.length : '—'}<small> days</small></dd></div>
              <div><dt>Longest streak</dt><dd>{aggregate.complete ? stats.longest.length : '—'}<small> days</small></dd></div>
            </dl>}
            <div className="day-detail" aria-live="polite">
              {selectedDay ? <><strong>{formatDate(selectedDay.date)} · {selectedDay.count.toLocaleString()} contributions</strong><span>{watchedResults.map((r) => '@' + r.username + ': ' + (r.days.find((d) => d.date === selectedDay.date)?.count?.toLocaleString() ?? 'unavailable')).join(' · ')}</span></> : <span>Hover a building to explore. Click a day for the account breakdown.</span>}
            </div>
          </> : <div className="empty-state" role="status"><EmptyCity /><h3>{loading ? 'Building your land…' : 'Your land could not be loaded.'}</h3><p>{loading ? 'Fetching the public calendars for your watched accounts.' : 'Check the usernames above, then try Refresh.'}</p></div>}
          <footer className="viewer-footer">
            <span>Sum of public calendars · {accounts.length > 1 ? 'Combined' : 'Account'} streaks within this period.</span>
            <span role="status">{loading ? 'Updating calendars…' : lastUpdated ? (hasStale ? 'Saved data · ' : 'Updated ') + lastUpdated : 'No saved data'}</span>
          </footer>
        </>}
      </>}
    </main>
  );
}
