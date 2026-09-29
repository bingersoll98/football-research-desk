const KEY = 'clubhouse-store-v1'
const SESSION = 'clubhouse-session-v1'

function uid() {
  return crypto.randomUUID()
}

function money(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

function empty() {
  return {
    meta: { inviteCode: 'FAIRWAY10', clubName: 'Clubhouse', weeklyDues: 10, seasonDues: 100 },
    users: [],
    seasons: [],
    events: [],
    markets: [],
    selections: [],
    cards: [],
    bets: [],
    customRequests: [],
    playerResults: [],
    weekStandings: [],
    ledger: [],
  }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || empty()
  } catch {
    return empty()
  }
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function publicUser(u) {
  if (!u) return null
  return { id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, createdAt: u.createdAt }
}

function cardsLocked(event) {
  if (!event) return true
  if (['cards_locked', 'live', 'graded', 'void'].includes(event.status)) return true
  if (event.cardLockAt && Date.now() >= Date.parse(event.cardLockAt)) return true
  return false
}

function currentEvent(state) {
  const ranked = [...state.events].sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))
  return ranked.find((e) => ['draft', 'lines_locked', 'cards_locked', 'live'].includes(e.status)) || ranked[0] || null
}

function hydrate(state, event, viewer) {
  if (!event) return null
  const locked = cardsLocked(event)
  const bets = state.bets.filter((b) => b.eventId === event.id)
  return {
    ...event,
    cardsLocked: locked,
    markets: state.markets.filter((m) => m.eventId === event.id),
    selections: state.selections.filter((s) => s.eventId === event.id && s.active),
    results: state.playerResults.filter((r) => r.eventId === event.id),
    standings: state.weekStandings.filter((w) => w.eventId === event.id),
    customRequests: viewer?.role === 'commissioner'
      ? state.customRequests.filter((r) => r.eventId === event.id)
      : state.customRequests.filter((r) => r.eventId === event.id && r.userId === viewer?.id),
    cards: state.cards
      .filter((c) => c.eventId === event.id && (locked || c.userId === viewer?.id || viewer?.role === 'commissioner'))
      .map((c) => {
        const cardBets = bets.filter((b) => b.cardId === c.id)
        const staked = money(cardBets.reduce((s, b) => s + Number(b.stake), 0))
        return {
          ...c,
          userName: state.users.find((u) => u.id === c.userId)?.name,
          bets: cardBets,
          staked,
          remaining: money(event.budget - staked),
          profit: money(cardBets.reduce((s, b) => s + Number(b.profit || 0), 0)),
          complete: Math.abs(staked - event.budget) < 0.009,
        }
      }),
  }
}

function sessionUser(state) {
  const id = sessionStorage.getItem(SESSION)
  return state.users.find((u) => u.id === id && u.active) || null
}

function requireUser(state) {
  const user = sessionUser(state)
  if (!user) throw Object.assign(new Error('Sign in required'), { status: 401 })
  return user
}

function requireAdmin(state) {
  const user = requireUser(state)
  if (user.role !== 'commissioner') throw Object.assign(new Error('Commissioner only'), { status: 403 })
  return user
}

function parseOdds(value) {
  const n = Number(String(value || '').replace(/,/g, ''))
  return Number.isFinite(n) && n !== 0 ? Math.trunc(n) : null
}

function profitFor(stake, odds, result) {
  if (result === 'void') return 0
  if (result === 'lose') return money(-stake)
  if (result !== 'win') return 0
  const o = Number(odds)
  return money(o > 0 ? stake * (o / 100) : stake * (100 / Math.abs(o)))
}

function ensureCard(state, userId, eventId) {
  let card = state.cards.find((c) => c.userId === userId && c.eventId === eventId)
  if (!card) {
    card = { id: uid(), userId, eventId, status: 'draft', submittedAt: null, createdAt: new Date().toISOString() }
    state.cards.push(card)
  }
  return card
}

function recompute(state, card, event) {
  const staked = money(state.bets.filter((b) => b.cardId === card.id).reduce((s, b) => s + Number(b.stake), 0))
  if (Math.abs(staked - event.budget) < 0.009) {
    card.status = 'complete'
    card.submittedAt = card.submittedAt || new Date().toISOString()
  } else {
    card.status = 'draft'
    card.submittedAt = null
  }
}

async function seed() {
  const state = load()
  if (state.users.length) return
  const now = new Date().toISOString()
  const admin = {
    id: uid(),
    name: 'Bradley Ingersoll',
    email: 'bradley@clubhouse.local',
    password: await sha('Clubhouse!2026'),
    role: 'commissioner',
    active: true,
    createdAt: now,
  }
  state.users.push(admin)
  state.seasons.push({ id: uid(), year: 2027, name: '2027 Season', active: true, createdAt: now })
  const eventId = uid()
  state.events.push({
    id: eventId,
    seasonId: state.seasons[0].id,
    name: 'Clubhouse Opening Week',
    venue: 'Members Practice Board',
    startDate: now.slice(0, 10),
    endDate: now.slice(0, 10),
    budget: 100,
    status: 'lines_locked',
    cardLockAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    publishedAt: now,
    createdAt: now,
  })
  const types = [['win', 'Tournament Winner'], ['top5', 'Top 5'], ['top10', 'Top 10'], ['top20', 'Top 20'], ['top40', 'Top 40'], ['cut', 'Make the Cut']]
  const marketIds = {}
  for (const [type, name] of types) {
    marketIds[type] = uid()
    state.markets.push({ id: marketIds[type], eventId, type, name, custom: false })
  }
  const board = [
    ['Scottie Scheffler', { win: 450, top5: 140, top10: -110, top20: -220, top40: -450, cut: -650 }],
    ['Rory McIlroy', { win: 700, top5: 200, top10: 110, top20: -150, top40: -300, cut: -500 }],
    ['Xander Schauffele', { win: 1200, top5: 300, top10: 150, top20: -120, top40: -250, cut: -400 }],
    ['Collin Morikawa', { win: 1600, top5: 400, top10: 180, top20: -105, top40: -220, cut: -380 }],
    ['Ludvig Aberg', { win: 1800, top5: 450, top10: 200, top20: 100, top40: -200, cut: -360 }],
    ['Viktor Hovland', { win: 2200, top5: 500, top10: 230, top20: 110, top40: -180, cut: -340 }],
    ['Tommy Fleetwood', { win: 2500, top5: 550, top10: 250, top20: 120, top40: -160, cut: -300 }],
    ['Justin Thomas', { win: 2800, top5: 600, top10: 280, top20: 130, top40: -150, cut: -280 }],
    ['Jordan Spieth', { win: 3500, top5: 700, top10: 320, top20: 150, top40: -130, cut: -240 }],
    ['Hideki Matsuyama', { win: 4000, top5: 800, top10: 350, top20: 160, top40: -120, cut: -220 }],
  ]
  for (const [golfer, odds] of board) {
    for (const type of Object.keys(odds)) {
      state.selections.push({
        id: uid(), eventId, marketId: marketIds[type], golfer, espnId: '', odds: odds[type], active: true,
      })
    }
  }
  save(state)
}

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status })
}

export async function localRequest(path, options = {}) {
  await seed()
  const method = (options.method || 'GET').toUpperCase()
  const body = options.body ? JSON.parse(options.body) : {}
  const state = load()
  const send = (data) => data

  if (path === '/api/health') return send({ ok: true, mode: 'browser' })

  if (path === '/api/auth/signup' && method === 'POST') {
    if (body.inviteCode !== state.meta.inviteCode) fail('Invite code is not valid', 403)
    const email = String(body.email || '').toLowerCase()
    if (state.users.some((u) => u.email === email)) fail('That email is already in the club', 409)
    const user = {
      id: uid(),
      name: String(body.name || '').trim(),
      email,
      password: await sha(body.password),
      role: 'player',
      active: true,
      createdAt: new Date().toISOString(),
    }
    state.users.push(user)
    save(state)
    sessionStorage.setItem(SESSION, user.id)
    return send({ user: publicUser(user) })
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const email = String(body.email || '').toLowerCase()
    const user = state.users.find((u) => u.email === email && u.active)
    if (!user || user.password !== await sha(body.password)) fail('Email or password is wrong', 401)
    sessionStorage.setItem(SESSION, user.id)
    return send({ user: publicUser(user) })
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    sessionStorage.removeItem(SESSION)
    return send({ ok: true })
  }

  if (path === '/api/me') {
    return send({
      user: publicUser(sessionUser(state)),
      meta: { clubName: state.meta.clubName, weeklyDues: state.meta.weeklyDues, seasonDues: state.meta.seasonDues },
    })
  }

  if (path === '/api/week') {
    const user = requireUser(state)
    return send({ event: hydrate(state, currentEvent(state), user), members: state.users.filter((u) => u.active).map(publicUser) })
  }

  if (path.startsWith('/api/events/')) {
    const user = requireUser(state)
    const event = state.events.find((e) => e.id === path.split('/')[3])
    if (!event) fail('Event not found', 404)
    return send({ event: hydrate(state, event, user) })
  }

  if (path === '/api/card/bet' && method === 'POST') {
    const user = requireUser(state)
    const event = state.events.find((e) => e.id === body.eventId) || currentEvent(state)
    if (cardsLocked(event)) fail('Cards are locked')
    const selection = state.selections.find((s) => s.id === body.selectionId && s.active)
    if (!selection) fail('Selection not on this board')
    const stake = money(body.stake)
    if (!(stake >= 1)) fail('Minimum stake is $1')
    const card = ensureCard(state, user.id, event.id)
    const used = state.bets.filter((b) => b.cardId === card.id).reduce((s, b) => s + Number(b.stake), 0)
    if (used + stake - event.budget > 0.009) fail('That stake would go over the week budget')
    const bet = {
      id: uid(), cardId: card.id, eventId: event.id, marketId: selection.marketId, selectionId: selection.id,
      golfer: selection.golfer, espnId: '', odds: selection.odds, stake, custom: false, result: 'pending', profit: 0,
      createdAt: new Date().toISOString(),
    }
    state.bets.push(bet)
    recompute(state, card, event)
    save(state)
    return send({ cardId: card.id, bet })
  }

  if (path.startsWith('/api/card/bet/') && method === 'DELETE') {
    const user = requireUser(state)
    const bet = state.bets.find((b) => b.id === path.split('/')[4])
    if (!bet) return send({ ok: true })
    const card = state.cards.find((c) => c.id === bet.cardId)
    const event = state.events.find((e) => e.id === bet.eventId)
    if (card.userId !== user.id) fail('Not your card', 403)
    if (cardsLocked(event)) fail('Cards are locked')
    state.bets = state.bets.filter((b) => b.id !== bet.id)
    recompute(state, card, event)
    save(state)
    return send({ ok: true })
  }

  if (path === '/api/card/custom' && method === 'POST') {
    const user = requireUser(state)
    const event = state.events.find((e) => e.id === body.eventId) || currentEvent(state)
    if (cardsLocked(event)) fail('Cards are locked')
    const req = {
      id: uid(), eventId: event.id, userId: user.id, golfer: body.golfer || '', description: body.description,
      odds: parseOdds(body.odds), stake: money(body.stake), status: 'pending', createdAt: new Date().toISOString(),
    }
    state.customRequests.push(req)
    save(state)
    return send({ request: req })
  }

  if (path === '/api/season') {
    requireUser(state)
    const season = state.seasons.find((s) => s.active) || state.seasons[0]
    const events = state.events.filter((e) => e.seasonId === season?.id && e.status === 'graded')
    const table = state.users.filter((u) => u.active).map((u) => {
      const weeks = events.map((event) => {
        const row = state.weekStandings.find((w) => w.eventId === event.id && w.userId === u.id)
        return { eventId: event.id, eventName: event.name, profit: row?.profit || 0, winner: Boolean(row?.winner), potWon: row?.potWon || 0 }
      })
      return {
        userId: u.id,
        userName: u.name,
        profit: money(weeks.reduce((s, w) => s + w.profit, 0)),
        wins: weeks.filter((w) => w.winner).length,
        weeklyPots: money(weeks.reduce((s, w) => s + w.potWon, 0)),
        cash: money(state.ledger.filter((l) => l.userId === u.id).reduce((s, l) => s + Number(l.amount), 0)),
        weeks,
      }
    }).sort((a, b) => b.profit - a.profit)
    return send({ season, table, events: state.events, dues: { weekly: state.meta.weeklyDues, season: state.meta.seasonDues }, members: state.users.filter((u) => u.active).length })
  }

  if (path === '/api/ledger') {
    requireUser(state)
    return send({
      weeklyDues: state.meta.weeklyDues,
      seasonDues: state.meta.seasonDues,
      rows: state.users.filter((u) => u.active).map((u) => ({
        userId: u.id,
        userName: u.name,
        total: money(state.ledger.filter((l) => l.userId === u.id).reduce((s, l) => s + Number(l.amount), 0)),
        entries: state.ledger.filter((l) => l.userId === u.id),
      })),
    })
  }

  if (path === '/api/admin/overview') {
    requireAdmin(state)
    return send({
      meta: state.meta,
      users: state.users.map(publicUser),
      events: state.events,
      season: state.seasons[0],
      pendingCustom: state.customRequests.filter((r) => r.status === 'pending'),
    })
  }

  if (path === '/api/admin/invite' && method === 'POST') {
    requireAdmin(state)
    if (body.inviteCode) state.meta.inviteCode = String(body.inviteCode).trim()
    save(state)
    return send({ inviteCode: state.meta.inviteCode })
  }

  if (path === '/api/admin/events' && method === 'POST') {
    requireAdmin(state)
    const name = String(body.name || '').trim()
    if (!name) fail('Event name required')
    const n = name.toLowerCase()
    const major = n.includes('masters') || n.includes('pga championship') || n.includes('open') || n.includes('players')
    const row = {
      id: uid(),
      seasonId: state.seasons[0]?.id,
      name,
      venue: body.venue || '',
      startDate: body.startDate || new Date().toISOString().slice(0, 10),
      endDate: body.endDate || body.startDate || new Date().toISOString().slice(0, 10),
      budget: Number(body.budget) || (major ? 250 : 100),
      status: 'draft',
      cardLockAt: body.cardLockAt || null,
      createdAt: new Date().toISOString(),
    }
    state.events.push(row)
    for (const [type, marketName] of [['win', 'Tournament Winner'], ['top5', 'Top 5'], ['top10', 'Top 10'], ['top20', 'Top 20'], ['top40', 'Top 40'], ['cut', 'Make the Cut']]) {
      state.markets.push({ id: uid(), eventId: row.id, type, name: marketName, custom: false })
    }
    save(state)
    return send({ event: row })
  }

  const eventAction = path.match(/^\/api\/admin\/events\/([^/]+)\/(.+)$/)
  if (eventAction && method === 'POST') {
    requireAdmin(state)
    const event = state.events.find((e) => e.id === eventAction[1])
    if (!event) fail('Event not found', 404)
    const action = eventAction[2]
    if (action === 'lock-lines') event.status = 'lines_locked'
    if (action === 'lock-cards') {
      event.status = 'cards_locked'
      event.cardLockAt = new Date().toISOString()
    }
    if (action === 'live') event.status = 'live'
    if (action === 'card-lock') {
      if (body.cardLockAt) event.cardLockAt = body.cardLockAt
      if (body.budget) event.budget = Number(body.budget)
      if (body.name) event.name = body.name
    }
    if (action === 'odds' && body.paste) {
      const markets = state.markets.filter((m) => m.eventId === event.id)
      for (const line of String(body.paste).split(/\n+/)) {
        const parts = line.split(',').map((p) => p.trim())
        if (parts.length < 3) continue
        const [golfer, marketRaw, oddsRaw] = parts
        const typeMap = { win: 'win', winner: 'win', top5: 'top5', top10: 'top10', top20: 'top20', top40: 'top40', cut: 'cut', makecut: 'cut' }
        const type = typeMap[marketRaw.toLowerCase().replace(/\s+/g, '')]
        const market = markets.find((m) => m.type === type)
        if (!market) continue
        let sel = state.selections.find((s) => s.eventId === event.id && s.marketId === market.id && s.golfer.toLowerCase() === golfer.toLowerCase())
        if (!sel) {
          sel = { id: uid(), eventId: event.id, marketId: market.id, golfer, espnId: '', odds: parseOdds(oddsRaw), active: true }
          state.selections.push(sel)
        } else sel.odds = parseOdds(oddsRaw)
      }
    }
    if (action === 'pull-field' || action === 'pull-results') {
      fail('ESPN pull needs the hosted server. Paste odds or enter results on this sample URL.')
    }
    if (action === 'publish') {
      const members = state.users.filter((u) => u.active)
      const rows = members.map((user) => {
        const card = state.cards.find((c) => c.userId === user.id && c.eventId === event.id)
        const bets = card ? state.bets.filter((b) => b.cardId === card.id) : []
        return {
          userId: user.id,
          userName: user.name,
          profit: money(bets.reduce((s, b) => s + Number(b.profit || 0), 0)),
          winCount: bets.filter((b) => b.result === 'win').length,
          bestBetProfit: bets.reduce((m, b) => Math.max(m, Number(b.profit || 0)), 0),
          submittedAt: card?.submittedAt || '9999',
        }
      }).sort((a, b) => b.profit - a.profit || b.winCount - a.winCount || b.bestBetProfit - a.bestBetProfit || a.submittedAt.localeCompare(b.submittedAt))
      state.weekStandings = state.weekStandings.filter((w) => w.eventId !== event.id)
      state.ledger = state.ledger.filter((l) => l.eventId !== event.id)
      const top = rows[0]
      const winners = rows.filter((r) => r.profit === top?.profit && r.winCount === top?.winCount && r.bestBetProfit === top?.bestBetProfit && r.submittedAt === top?.submittedAt)
      const pot = money(Math.max(members.length - 1, 0) * state.meta.weeklyDues)
      const share = winners.length ? money(pot / winners.length) : 0
      rows.forEach((r, i) => {
        const winner = winners.some((w) => w.userId === r.userId)
        state.weekStandings.push({ ...r, eventId: event.id, rank: i + 1, potWon: winner ? share : 0, winner })
        state.ledger.push({
          id: uid(), eventId: event.id, userId: r.userId,
          amount: winner ? share : -state.meta.weeklyDues,
          reason: winner ? 'Weekly pot' : 'Weekly dues',
          createdAt: new Date().toISOString(),
        })
      })
      event.status = 'graded'
    }
    save(state)
    return send({ ok: true })
  }

  const customAction = path.match(/^\/api\/admin\/custom\/([^/]+)\/(approve|reject)$/)
  if (customAction && method === 'POST') {
    requireAdmin(state)
    const req = state.customRequests.find((r) => r.id === customAction[1])
    if (!req) fail('Request not found', 404)
    if (customAction[2] === 'reject') req.status = 'rejected'
    else {
      const event = state.events.find((e) => e.id === req.eventId)
      const market = { id: uid(), eventId: event.id, type: 'custom', name: req.description, custom: true }
      state.markets.push(market)
      const selection = { id: uid(), eventId: event.id, marketId: market.id, golfer: req.golfer || req.description, espnId: '', odds: req.odds, active: true }
      state.selections.push(selection)
      const card = ensureCard(state, req.userId, event.id)
      state.bets.push({
        id: uid(), cardId: card.id, eventId: event.id, marketId: market.id, selectionId: selection.id,
        golfer: selection.golfer, odds: req.odds, stake: req.stake, custom: true, label: req.description,
        result: 'pending', profit: 0, createdAt: new Date().toISOString(),
      })
      recompute(state, card, event)
      req.status = 'approved'
    }
    save(state)
    return send({ request: req })
  }

  const grade = path.match(/^\/api\/admin\/bets\/([^/]+)\/grade$/)
  if (grade && method === 'POST') {
    requireAdmin(state)
    const bet = state.bets.find((b) => b.id === grade[1])
    if (!bet) fail('Bet not found', 404)
    bet.result = body.result
    bet.profit = profitFor(bet.stake, bet.odds, bet.result)
    save(state)
    return send({ ok: true })
  }

  fail('Not found', 404)
}
