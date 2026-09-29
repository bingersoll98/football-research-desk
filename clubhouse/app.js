import { h, render } from 'https://esm.sh/preact@10.25.4'
import { useState as us, useEffect as ue, useMemo as um } from 'https://esm.sh/preact@10.25.4/hooks'
import htm from 'https://esm.sh/htm@3.1.1'
import { localRequest } from './local-api.js'

const html = htm.bind(h)
const headers = { 'Content-Type': 'application/json' }

async function request(path, options = {}) {
  try {
    return await localRequest(path, options)
  } catch (err) {
    throw new Error(err.message || 'Request failed')
  }
}

const api = {
  me: () => request('/api/me'),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  signup: (body) => request('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/api/auth/logout', { method: 'POST', body: '{}' }),
  week: () => request('/api/week'),
  season: () => request('/api/season'),
  ledger: () => request('/api/ledger'),
  placeBet: (body) => request('/api/card/bet', { method: 'POST', body: JSON.stringify(body) }),
  removeBet: (id) => request(`/api/card/bet/${id}`, { method: 'DELETE' }),
  custom: (body) => request('/api/card/custom', { method: 'POST', body: JSON.stringify(body) }),
  admin: () => request('/api/admin/overview'),
  createEvent: (body) => request('/api/admin/events', { method: 'POST', body: JSON.stringify(body) }),
  lockLines: (id) => request(`/api/admin/events/${id}/lock-lines`, { method: 'POST', body: '{}' }),
  lockCards: (id) => request(`/api/admin/events/${id}/lock-cards`, { method: 'POST', body: '{}' }),
  goLive: (id) => request(`/api/admin/events/${id}/live`, { method: 'POST', body: '{}' }),
  pullField: (id, body) => request(`/api/admin/events/${id}/pull-field`, { method: 'POST', body: JSON.stringify(body) }),
  pullResults: (id, body) => request(`/api/admin/events/${id}/pull-results`, { method: 'POST', body: JSON.stringify(body) }),
  saveOdds: (id, body) => request(`/api/admin/events/${id}/odds`, { method: 'POST', body: JSON.stringify(body) }),
  decideCustom: (id, action) => request(`/api/admin/custom/${id}/${action}`, { method: 'POST', body: '{}' }),
  gradeBet: (id, result) => request(`/api/admin/bets/${id}/grade`, { method: 'POST', body: JSON.stringify({ result }) }),
  publish: (id) => request(`/api/admin/events/${id}/publish`, { method: 'POST', body: '{}' }),
  setInvite: (inviteCode) => request('/api/admin/invite', { method: 'POST', body: JSON.stringify({ inviteCode }) }),
}

function formatOdds(odds) {
  if (odds == null || odds === '') return '—'
  const n = Number(odds)
  if (!Number.isFinite(n)) return '—'
  return n > 0 ? `+${n}` : String(n)
}

function formatMoney(n) {
  const v = Number(n || 0)
  const sign = v > 0 ? '+' : ''
  return `${sign}$${v.toFixed(2)}`
}

function payout(stake, odds) {
  const s = Number(stake)
  const o = Number(odds)
  if (!s || !o) return 0
  return o > 0 ? s * (o / 100) : s * (100 / Math.abs(o))
}

function Auth({ onAuthed }) {
  const [mode, setMode] = us('login')
  const [form, setForm] = us({ name: '', email: '', password: '', inviteCode: 'FAIRWAY10' })
  const [error, setError] = us('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const fn = mode === 'login' ? api.login : api.signup
      await fn(form)
      onAuthed()
    } catch (err) {
      setError(err.message)
    }
  }

  return html`
    <div class="auth">
      <div class="kicker">Members only</div>
      <h1>Clubhouse</h1>
      <p class="muted">The private golf pool. Same DraftKings number for everybody.</p>
      <div class="tabs">
        <button class=${mode === 'login' ? 'active' : ''} onClick=${() => setMode('login')} type="button">Sign in</button>
        <button class=${mode === 'signup' ? 'active' : ''} onClick=${() => setMode('signup')} type="button">Join</button>
      </div>
      <form onSubmit=${submit}>
        ${mode === 'signup' && html`
          <div>
            <label>Name</label>
            <input value=${form.name} onInput=${(e) => setForm({ ...form, name: e.target.value })} required />
            <label>Invite code</label>
            <input value=${form.inviteCode} onInput=${(e) => setForm({ ...form, inviteCode: e.target.value })} required />
          </div>
        `}
        <label>Email</label>
        <input type="email" value=${form.email} onInput=${(e) => setForm({ ...form, email: e.target.value })} required />
        <label>Password</label>
        <input type="password" value=${form.password} onInput=${(e) => setForm({ ...form, password: e.target.value })} required minLength="8" />
        ${error && html`<div class="err">${error}</div>`}
        <button class="btn primary" type="submit">${mode === 'login' ? 'Enter the club' : 'Create member card'}</button>
      </form>
    </div>
  `
}

function WeekPage({ week, user }) {
  const event = week?.event
  if (!event) return html`<div class="card">No week is open yet.</div>`
  const mine = event.cards.find((c) => c.userId === user.id)
  const standings = [...(event.standings.length ? event.standings : event.cards)]
    .sort((a, b) => (b.profit || 0) - (a.profit || 0))
  return html`
    <section class="hero">
      <div class="kicker">${event.status.replace('_', ' ')}</div>
      <h1>${event.name}</h1>
      <div class="meta">
        <span>${event.venue || 'PGA Tour'}</span>
        <span>Budget $${event.budget}</span>
        <span class="countdown">Cards lock ${event.cardLockAt ? new Date(event.cardLockAt).toLocaleString() : 'when the commissioner says so'}</span>
      </div>
    </section>
    <div class="grid">
      <div class="card">
        <h3>Club board</h3>
        <table class="table dark">
          <thead><tr><th>Player</th><th class="right">Staked</th><th class="right">Profit</th></tr></thead>
          <tbody>
            ${standings.map((row) => html`
              <tr key=${row.userId || row.id}>
                <td>${row.userName}${row.winner ? ' · week winner' : ''}</td>
                <td class="right">${formatMoney(row.staked || 0).replace('+','')}</td>
                <td class=${'right ' + (Number(row.profit) >= 0 ? 'win' : 'lose')}>${formatMoney(row.profit)}</td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
      <div class="paper">
        <h3>Your ticket</h3>
        <div class="row"><span>Allocated</span><b>${formatMoney(mine?.staked || 0).replace('+','')}</b></div>
        <div class="row"><span>Remaining</span><b>${formatMoney(mine?.remaining ?? event.budget).replace('+','')}</b></div>
        <div class="row"><span>Status</span><b>${mine?.complete ? 'Complete' : 'Needs the full budget'}</b></div>
        <p class="muted">A card does not count until it totals exactly $${event.budget}.</p>
      </div>
    </div>
  `
}

function BoardPage({ week, user, onChange }) {
  const event = week?.event
  const [marketId, setMarketId] = us(event?.markets?.[0]?.id)
  const [q, setQ] = us('')
  const [stake, setStake] = us(10)
  const [custom, setCustom] = us({ description: '', golfer: '', odds: '', stake: 10 })

  if (!event) return html`<div class="card">No board yet.</div>`
  const mine = event.cards.find((c) => c.userId === user.id)
  const market = event.markets.find((m) => m.id === marketId) || event.markets[0]
  const rows = event.selections
    .filter((s) => s.marketId === market?.id && s.odds != null)
    .filter((s) => s.golfer.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(a.odds) - Number(b.odds))

  async function add(selection) {
    try {
      await api.placeBet({ eventId: event.id, selectionId: selection.id, stake: Number(stake) })
      await onChange()
    } catch (err) {
      alert(err.message)
    }
  }

  async function requestCustom(e) {
    e.preventDefault()
    try {
      await api.custom({ eventId: event.id, ...custom, stake: Number(custom.stake) })
      setCustom({ description: '', golfer: '', odds: '', stake: 10 })
      await onChange()
      alert('Custom bet sent to the commissioner.')
    } catch (err) {
      alert(err.message)
    }
  }

  return html`
    <div class="grid">
      <div class="card">
        <div class="row">
          <h3 style="margin:0">Locked DraftKings board</h3>
          <span class="tag">${event.cardsLocked ? 'Cards locked' : 'Picks open'}</span>
        </div>
        <div class="tabs">
          ${event.markets.map((m) => html`
            <button key=${m.id} class=${m.id === market?.id ? 'active' : ''} onClick=${() => setMarketId(m.id)}>${m.name}</button>
          `)}
        </div>
        <input class="search" placeholder="Search a golfer" value=${q} onInput=${(e) => setQ(e.target.value)} />
        ${rows.map((s) => html`
          <div class="pick" key=${s.id}>
            <div>${s.golfer}</div>
            <div class="odds">${formatOdds(s.odds)}</div>
            <button class="btn" disabled=${event.cardsLocked} onClick=${() => add(s)}>Add $${Number(stake)}</button>
          </div>
        `)}
        ${rows.length === 0 && html`<p class="muted">No priced golfers in this market yet.</p>`}
      </div>
      <div class="slip paper">
        <h3>Slip</h3>
        <label>Default stake</label>
        <input type="number" min="1" step="1" value=${stake} onInput=${(e) => setStake(e.target.value)} />
        <div class="row"><span>Used</span><b>${formatMoney(mine?.staked || 0).replace('+','')} / $${event.budget}</b></div>
        <div class="row"><span>Left</span><b>${formatMoney(mine?.remaining ?? event.budget).replace('+','')}</b></div>
        ${(mine?.bets || []).map((b) => html`
          <div class="list-item" key=${b.id}>
            <div class="row">
              <b>${b.golfer}</b>
              <button class="ghost" disabled=${event.cardsLocked} onClick=${async () => { await api.removeBet(b.id); onChange() }}>Remove</button>
            </div>
            <div class="muted">${b.label || event.markets.find((m) => m.id === b.marketId)?.name} · ${formatOdds(b.odds)} · $${Number(b.stake).toFixed(2)}</div>
            <div class="muted">To win ${formatMoney(payout(b.stake, b.odds)).replace('+','')}</div>
          </div>
        `)}
        <form onSubmit=${requestCustom}>
          <h3>Custom bet</h3>
          <input placeholder="What is the bet?" value=${custom.description} onInput=${(e) => setCustom({ ...custom, description: e.target.value })} />
          <input placeholder="Golfer or side" value=${custom.golfer} onInput=${(e) => setCustom({ ...custom, golfer: e.target.value })} />
          <input placeholder="DK American odds, e.g. +650" value=${custom.odds} onInput=${(e) => setCustom({ ...custom, odds: e.target.value })} />
          <input type="number" min="1" value=${custom.stake} onInput=${(e) => setCustom({ ...custom, stake: e.target.value })} />
          <button class="btn primary" disabled=${event.cardsLocked}>Request approval</button>
        </form>
      </div>
    </div>
  `
}

function ClubCards({ week, user }) {
  const event = week?.event
  if (!event) return null
  if (!event.cardsLocked && user.role !== 'commissioner') {
    return html`<div class="card">Club cards stay private until Wednesday lock.</div>`
  }
  return html`
    <div class="grid">
      ${event.cards.map((card) => html`
        <div class="paper" key=${card.id}>
          <div class="row">
            <h3 style="margin:0">${card.userName}</h3>
            <b class=${card.profit >= 0 ? 'win' : 'lose'}>${formatMoney(card.profit)}</b>
          </div>
          <p class="muted">${card.complete ? 'Full budget' : 'Incomplete'} · ${formatMoney(card.staked).replace('+','')}</p>
          <table class="table">
            <tbody>
              ${card.bets.map((b) => html`
                <tr key=${b.id}>
                  <td>${b.golfer}<div class="muted">${b.label || event.markets.find((m) => m.id === b.marketId)?.name}</div></td>
                  <td>${formatOdds(b.odds)}</td>
                  <td class="right">$${Number(b.stake).toFixed(2)}</td>
                  <td class=${'right ' + (b.result === 'win' ? 'win' : b.result === 'lose' ? 'lose' : '')}>${b.result}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      `)}
    </div>
  `
}

function SeasonPage({ season }) {
  if (!season) return null
  return html`
    <div class="card">
      <h3>${season.season?.name || 'Season race'}</h3>
      <p class="muted">Running profit across every graded week. Season prize is $${season.dues.season} from everyone else.</p>
      <table class="table dark">
        <thead>
          <tr><th>Pos</th><th>Member</th><th class="right">Profit</th><th class="right">Week wins</th><th class="right">Cash ledger</th></tr>
        </thead>
        <tbody>
          ${season.table.map((row, i) => html`
            <tr key=${row.userId}>
              <td>${i + 1}</td>
              <td>${row.userName}</td>
              <td class=${'right ' + (row.profit >= 0 ? 'win' : 'lose')}>${formatMoney(row.profit)}</td>
              <td class="right">${row.wins}</td>
              <td class="right">${formatMoney(row.cash)}</td>
            </tr>
          `)}
        </tbody>
      </table>
    </div>
  `
}

function LedgerPage({ ledger, season }) {
  if (!ledger) return null
  const n = Math.max((season?.members || 1) - 1, 0)
  return html`
    <div class="card">
      <h3>Cash among friends</h3>
      <p class="muted">The site does not collect money. Weekly winner takes $${ledger.weeklyDues} × ${n}. Season winner takes $${ledger.seasonDues} × ${n}.</p>
      <table class="table dark">
        <thead><tr><th>Member</th><th class="right">Balance</th></tr></thead>
        <tbody>
          ${ledger.rows.map((r) => html`
            <tr key=${r.userId}>
              <td>${r.userName}</td>
              <td class=${'right ' + (r.total >= 0 ? 'win' : 'lose')}>${formatMoney(r.total)}</td>
            </tr>
          `)}
        </tbody>
      </table>
    </div>
  `
}

function AdminPage({ week, onChange }) {
  const event = week?.event
  const [overview, setOverview] = us(null)
  const [form, setForm] = us({ name: '', startDate: '', budget: 100, venue: '', cardLockAt: '', date: '' })
  const [paste, setPaste] = us('')
  const [invite, setInvite] = us('')
  const [message, setMessage] = us('')

  async function refresh() {
    setOverview(await api.admin())
  }
  ue(() => { refresh().catch((e) => setMessage(e.message)) }, [])

  async function run(fn) {
    try {
      setMessage('')
      await fn()
      await refresh()
      await onChange()
      setMessage('Done.')
    } catch (err) {
      setMessage(err.message)
    }
  }

  const priced = event?.selections?.filter((s) => s.odds != null) || []
  const customBets = event?.cards?.flatMap((c) => c.bets.filter((b) => b.custom || event.markets.find((m) => m.id === b.marketId)?.custom)) || []

  return html`
    <div class="grid">
      <div class="card stack">
        <h3>Commissioner desk</h3>
        ${message && html`<div class=${message === 'Done.' ? 'ok' : 'err'}>${message}</div>`}
        <label>New event</label>
        <input placeholder="Tournament name" value=${form.name} onInput=${(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Venue" value=${form.venue} onInput=${(e) => setForm({ ...form, venue: e.target.value })} />
        <input type="date" value=${form.startDate} onInput=${(e) => setForm({ ...form, startDate: e.target.value })} />
        <input type="number" value=${form.budget} onInput=${(e) => setForm({ ...form, budget: e.target.value })} />
        <input type="datetime-local" value=${form.cardLockAt} onInput=${(e) => setForm({ ...form, cardLockAt: e.target.value })} />
        <button class="btn primary" onClick=${() => run(() => api.createEvent({
          ...form,
          cardLockAt: form.cardLockAt ? new Date(form.cardLockAt).toISOString() : null,
        }))}>Open week</button>
        ${event && html`
          <div>
            <h3>This week: ${event.name}</h3>
            <button class="btn" onClick=${() => run(() => api.lockLines(event.id))}>Lock / publish lines</button>
            <button class="btn" onClick=${() => run(() => api.lockCards(event.id))}>Lock cards now</button>
            <button class="btn" onClick=${() => run(() => api.goLive(event.id))}>Mark live</button>
            <button class="btn" onClick=${() => run(() => api.publish(event.id))}>Grade & publish week</button>
            <label>ESPN date to pull field / results</label>
            <input type="date" value=${form.date} onInput=${(e) => setForm({ ...form, date: e.target.value })} />
            <button class="btn" onClick=${() => run(() => api.pullField(event.id, { date: form.date }))}>Pull field from ESPN</button>
            <button class="btn" onClick=${() => run(() => api.pullResults(event.id, { date: form.date, startDate: event.startDate }))}>Pull leaderboard & grade</button>
            <label>Paste DK odds</label>
            <textarea rows="7" placeholder=${'Scottie Scheffler, win, +450'} value=${paste} onInput=${(e) => setPaste(e.target.value)}></textarea>
            <button class="btn" onClick=${() => run(() => api.saveOdds(event.id, { paste }))}>Import pasted lines</button>
          </div>
        `}
      </div>
      <div class="paper">
        <h3>Club</h3>
        <p>Invite code: <b>${overview?.meta?.inviteCode}</b></p>
        <input value=${invite} placeholder="New invite code" onInput=${(e) => setInvite(e.target.value)} />
        <button class="btn" onClick=${() => run(() => api.setInvite(invite))}>Update invite code</button>
        <h3>Members</h3>
        ${(overview?.users || []).map((u) => html`<div key=${u.id} class="row"><span>${u.name}</span><span class="muted">${u.role}</span></div>`)}
        <h3>Custom queue</h3>
        ${(overview?.pendingCustom || []).map((r) => html`
          <div key=${r.id} class="list-item">
            <b>${r.description}</b>
            <div class="muted">${r.golfer} · ${formatOdds(r.odds)} · $${r.stake}</div>
            <button class="btn" onClick=${() => run(() => api.decideCustom(r.id, 'approve'))}>Approve</button>
            <button class="ghost" onClick=${() => run(() => api.decideCustom(r.id, 'reject'))}>Reject</button>
          </div>
        `)}
        <h3>Priced selections</h3>
        <p class="muted">${priced.length} lines on the board</p>
        ${customBets.map((b) => html`
          <div key=${b.id} class="list-item">
            <div>${b.label || b.golfer} · ${b.result}</div>
            <button class="btn" onClick=${() => run(() => api.gradeBet(b.id, 'win'))}>Win</button>
            <button class="btn" onClick=${() => run(() => api.gradeBet(b.id, 'lose'))}>Lose</button>
            <button class="ghost" onClick=${() => run(() => api.gradeBet(b.id, 'void'))}>Void</button>
          </div>
        `)}
      </div>
    </div>
  `
}

const PAGES = [
  ['week', 'This Week'],
  ['board', 'Board'],
  ['card', 'My Card'],
  ['club', 'Club Cards'],
  ['season', 'Season'],
  ['ledger', 'Ledger'],
]

function App() {
  const [user, setUser] = us(undefined)
  const [page, setPage] = us('week')
  const [week, setWeek] = us(null)
  const [season, setSeason] = us(null)
  const [ledger, setLedger] = us(null)

  async function boot() {
    const me = await api.me()
    setUser(me.user)
    if (me.user) {
      const [w, s, l] = await Promise.all([api.week(), api.season(), api.ledger()])
      setWeek(w)
      setSeason(s)
      setLedger(l)
    }
  }

  ue(() => { boot().catch(() => setUser(null)) }, [])

  const pages = um(() => {
    const list = [...PAGES]
    if (user?.role === 'commissioner') list.push(['admin', 'Admin'])
    return list
  }, [user])

  if (user === undefined) return html`<div class="shell">Opening the clubhouse…</div>`
  if (!user) return html`<${Auth} onAuthed=${boot} />`

  return html`
    <div class="shell">
      <header class="topbar">
        <div class="brand" onClick=${() => setPage('week')}>
          <b>Clubhouse</b>
          <span>Golf Pool</span>
        </div>
        <nav class="nav">
          ${pages.map(([id, label]) => html`
            <button key=${id} class=${page === id ? 'active' : ''} onClick=${() => setPage(id)}>${label}</button>
          `)}
          <button onClick=${async () => { await api.logout(); setUser(null) }}>Sign out</button>
        </nav>
        <div class="userchip">${user.name}</div>
      </header>
      ${page === 'week' && html`<${WeekPage} week=${week} user=${user} />`}
      ${(page === 'board' || page === 'card') && html`<${BoardPage} week=${week} user=${user} onChange=${boot} />`}
      ${page === 'club' && html`<${ClubCards} week=${week} user=${user} />`}
      ${page === 'season' && html`<${SeasonPage} season=${season} />`}
      ${page === 'ledger' && html`<${LedgerPage} ledger=${ledger} season=${season} />`}
      ${page === 'admin' && html`<${AdminPage} week=${week} onChange=${boot} />`}
    </div>
  `
}

render(html`<${App} />`, document.getElementById('root'))
