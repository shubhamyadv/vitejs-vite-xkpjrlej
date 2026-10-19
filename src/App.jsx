import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// 👇 YOUR LIVE SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://duehfkagiginybbjmcgj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DWEbIg0eNq7C6nFCcvbBwA_974FV0vV';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

const INTEREST_CATEGORIES = [
  {
    category: 'Creativity',
    items: [
      'Art',
      'Design',
      'Writing',
      'Photography',
      'DIY',
      'Knitting & Crafting',
    ],
  },
  {
    category: 'Sports',
    items: [
      'Fitness',
      'Netball',
      'Pickleball',
      'Running',
      'Yoga',
      'Gym Workouts',
      'Outdoor Sports',
    ],
  },
  {
    category: 'Going out',
    items: ['Nightclubs', 'Concerts', 'Dancing', 'Brunch', 'Social Events'],
  },
  {
    category: 'Staying in',
    items: ['Gaming', 'Binge-watching', 'Cooking at Home', 'Relaxing'],
  },
  { category: 'Film & TV', items: ['Movies', 'Documentaries', 'TV Genres'] },
  { category: 'Reading', items: ['Books', 'Poetry', 'Literature'] },
  {
    category: 'Music',
    items: [
      'Live Music',
      'Indie & Rock',
      'Hip-Hop & R&B',
      'Playing Instruments',
    ],
  },
  {
    category: 'Food & drink',
    items: ['Foodie Spots', 'Coffee', 'Wine', 'Baking', 'Local Cuisines'],
  },
  {
    category: 'Traveling',
    items: ['Road Trips', 'Backpacking', 'Exploring New Cities'],
  },
  { category: 'Pets', items: ['Dogs', 'Cats', 'Animal Companionship'] },
  {
    category: 'Values & traits',
    items: [
      'Therapy',
      'Mindfulness',
      'Deep Chats',
      'Nutrition',
      'Sleeping Well',
      'Time Offline',
    ],
  },
];

const PROMPTS = [
  'My Ideal Sunday...',
  'I Get Way Too Excited About...',
  'The Way to Win Me Over Is...',
  'After Classes You Can Find Me...',
  'My unpopular joka opinion is...',
  'At 2am you can find me doing...',
];

export default function App() {
  const [session, setSession] = useState(null);
  const [screen, setScreen] = useState('loading'); // 'loading' | 'auth' | 'onboarding' | 'matches' | 'chat'
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [profile, setProfile] = useState({
    alias: '',
    age: '24',
    gender: 'Man',
    seeking: 'Women',
    interests: [],
    promptQuestion: PROMPTS[0],
    promptAnswer: '',
    realName: '',
    instaId: '',
    height: '5\'10"',
    drinking: 'Socially',
    smoking: 'Never',
    weed: 'Never',
  });

  const [dailyMatches, setDailyMatches] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef(null);

  // Load Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.href =
      'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  // Check Login Session on Load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkExistingProfile(session.user.id);
      else setScreen('auth');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkExistingProfile(session.user.id);
      else setScreen('auth');
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check if user already completed Layer 1 & Layer 2
  const checkExistingProfile = async (userId) => {
    setScreen('loading');
    const { data: pub } = await supabase
      .from('public_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (pub) {
      setProfile((prev) => ({
        ...prev,
        alias: pub.alias,
        age: String(pub.age),
        gender: pub.gender,
        seeking: pub.seeking,
        interests: pub.interests || [],
        promptQuestion: pub.prompt_question,
        promptAnswer: pub.prompt_answer,
      }));
      await loadDailyMatches(userId);
      setScreen('matches');
    } else {
      setScreen('onboarding');
    }
  };

  // Instant Login bypassing email rate limits
  const handleInstantLogin = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@email.iimcal.ac.in')) {
      setError(
        'Restricted access. You must use your @email.iimcal.ac.in address.'
      );
      return;
    }
    setBusy(true);
    setError('');

    const dummyPassword = 'jokablind_secure_password_2026';

    let { error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: dummyPassword,
    });

    if (authError) {
      const { error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: dummyPassword,
      });
      if (signUpError) {
        setError(signUpError.message);
        setBusy(false);
        return;
      }
    }

    setBusy(false);
  };

  const toggleInterest = (item) => {
    if (profile.interests.includes(item)) {
      setProfile({
        ...profile,
        interests: profile.interests.filter((i) => i !== item),
      });
    } else if (profile.interests.length < 10) {
      setProfile({ ...profile, interests: [...profile.interests, item] });
    }
  };

  // Save Layer 1 + Layer 2 to Supabase & Trigger 3 Daily Matches
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profile.alias.trim()) return setError('Please enter an alias.');
    if (profile.interests.length < 5)
      return setError(
        `Select at least 5 interests (${profile.interests.length}/5).`
      );
    if (!profile.promptAnswer.trim())
      return setError('Please answer your chosen prompt.');
    if (!profile.realName.trim() || !profile.instaId.trim())
      return setError('Please fill out your Vault Layer.');

    setBusy(true);
    setError('');
    const userId = session.user.id;

    const { error: err1 } = await supabase.from('public_profiles').upsert({
      id: userId,
      alias: profile.alias.trim(),
      age: parseInt(profile.age, 10),
      gender: profile.gender,
      seeking: profile.seeking,
      interests: profile.interests,
      prompt_question: profile.promptQuestion,
      prompt_answer: profile.promptAnswer.trim(),
    });

    const { error: err2 } = await supabase.from('vault_profiles').upsert({
      id: userId,
      real_name: profile.realName.trim(),
      insta_id: profile.instaId.trim(),
      height: profile.height.trim(),
      drinking: profile.drinking,
      smoking: profile.smoking,
      weed: profile.weed,
    });

    if (err1 || err2) {
      setBusy(false);
      return setError((err1 || err2).message);
    }

    await loadDailyMatches(userId);
    setBusy(false);
    setScreen('matches');
  };

  // Run Matchmaking RPC & Load Matches
  const loadDailyMatches = async (userId) => {
    await supabase.rpc('generate_daily_matches');

    const { data: matchRows } = await supabase
      .from('matches')
      .select('*')
      .or(`user_1.eq.${userId},user_2.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (!matchRows) return;

    const enriched = await Promise.all(
      matchRows.map(async (m) => {
        const partnerId = m.user_1 === userId ? m.user_2 : m.user_1;
        const { data: pub } = await supabase
          .from('public_profiles')
          .select('*')
          .eq('id', partnerId)
          .single();

        const isBothRevealed = m.user_1_reveal && m.user_2_reveal;
        let vaultData = null;
        if (isBothRevealed) {
          const { data: v } = await supabase
            .from('vault_profiles')
            .select('*')
            .eq('id', partnerId)
            .maybeSingle();
          vaultData = v;
        }

        return {
          ...m,
          partnerId,
          partnerPublic: pub,
          partnerVault: vaultData,
        };
      })
    );

    setDailyMatches(enriched.filter((x) => x.partnerPublic));
  };

  // Open Real-Time Chat Room
  const openChatRoom = async (matchObj) => {
    setActiveMatch(matchObj);
    setScreen('chat');

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('match_id', matchObj.id)
      .order('created_at', { ascending: true });

    setMessages(msgs || []);
  };

  // Subscribe to Live Messages & Mutual Reveal Changes
  useEffect(() => {
    if (screen !== 'chat' || !activeMatch) return;

    const msgChannel = supabase
      .channel(`room-${activeMatch.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${activeMatch.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${activeMatch.id}`,
        },
        async (payload) => {
          const updated = payload.new;
          let vaultData = activeMatch.partnerVault;
          if (updated.user_1_reveal && updated.user_2_reveal && !vaultData) {
            const { data: v } = await supabase
              .from('vault_profiles')
              .select('*')
              .eq('id', activeMatch.partnerId)
              .maybeSingle();
            vaultData = v;
          }
          setActiveMatch((prev) => ({
            ...prev,
            ...updated,
            partnerVault: vaultData,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [screen, activeMatch?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeMatch) return;
    const text = inputText.trim();
    setInputText('');

    await supabase.from('messages').insert({
      match_id: activeMatch.id,
      sender_id: session.user.id,
      content: text,
    });
  };

  const handleToggleReveal = async () => {
    if (!activeMatch || !session) return;
    const isUser1 = activeMatch.user_1 === session.user.id;
    const updateField = isUser1
      ? { user_1_reveal: true }
      : { user_2_reveal: true };

    const { data: updated } = await supabase
      .from('matches')
      .update(updateField)
      .eq('id', activeMatch.id)
      .select()
      .single();

    if (updated) {
      let vaultData = activeMatch.partnerVault;
      if (updated.user_1_reveal && updated.user_2_reveal) {
        const { data: v } = await supabase
          .from('vault_profiles')
          .select('*')
          .eq('id', activeMatch.partnerId)
          .maybeSingle();
        vaultData = v;
      }
      setActiveMatch((prev) => ({
        ...prev,
        ...updated,
        partnerVault: vaultData,
      }));
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setScreen('auth');
  };

  return (
    <div style={styles.outerViewport}>
      <div style={styles.appFrame}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <span style={styles.logoText}>BLIND</span>
            <span style={styles.campusTag}>IIM CALCUTTA</span>
          </div>
          {session && (
            <button onClick={handleSignOut} style={styles.smallSquareBtn}>
              Sign Out
            </button>
          )}
        </header>

        {screen === 'loading' && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#555' }}>
            Loading campus session...
          </div>
        )}

        {/* SCREEN 1: AUTH */}
        {screen === 'auth' && (
          <div style={styles.scrollContent}>
            <div style={{ marginTop: '36px', marginBottom: '36px' }}>
              <div style={styles.kicker}>CAMPUS EXCLUSIVE • ZERO SWIPING</div>
              <h1 style={styles.heroHeading}>
                Personality first.
                <br />
                Identity when ready.
              </h1>
              <p style={styles.bodyCopy}>
                Sign in instantly with your verified @email.iimcal.ac.in
                address. No waiting for emails, zero rate limits.
              </p>
            </div>

            <form onSubmit={handleInstantLogin} style={styles.sectionBox}>
              <label style={styles.fieldLabel}>CAMPUS EMAIL ADDRESS</label>
              <input
                type="email"
                placeholder="yourname@email.iimcal.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.squareInput}
                required
              />
              {error && <div style={styles.errorBanner}>{error}</div>}
              <button
                type="submit"
                disabled={busy}
                style={styles.primarySquareBtn}
              >
                {busy ? 'Logging in...' : 'Enter Campus App Instantly'}
              </button>
            </form>
          </div>
        )}

        {/* SCREEN 2: ONBOARDING */}
        {screen === 'onboarding' && (
          <form onSubmit={handleSaveProfile} style={styles.scrollContent}>
            <h2 style={styles.pageHeading}>Create Your Two Layers.</h2>
            <p style={styles.bodyCopy}>
              Layer 1 is visible to your matches immediately. Layer 2 stays
              locked in the Vault until both of you click Reveal.
            </p>
            {error && <div style={styles.errorBanner}>{error}</div>}

            <div style={styles.sectionBox}>
              <div style={styles.layerHeader}>LAYER 01 — THE BLIND LAYER</div>
              <label style={styles.fieldLabel}>YOUR ALIAS</label>
              <input
                type="text"
                placeholder="Type any alias you want..."
                value={profile.alias}
                onChange={(e) =>
                  setProfile({ ...profile, alias: e.target.value })
                }
                style={styles.squareInput}
              />

              <div style={styles.threeColGrid}>
                <div>
                  <label style={styles.fieldLabel}>AGE</label>
                  <input
                    type="number"
                    value={profile.age}
                    onChange={(e) =>
                      setProfile({ ...profile, age: e.target.value })
                    }
                    style={styles.squareInput}
                  />
                </div>
                <div>
                  <label style={styles.fieldLabel}>GENDER</label>
                  <select
                    value={profile.gender}
                    onChange={(e) =>
                      setProfile({ ...profile, gender: e.target.value })
                    }
                    style={styles.squareSelect}
                  >
                    <option value="Man">Man</option>
                    <option value="Woman">Woman</option>
                    <option value="Non-binary">Non-binary</option>
                  </select>
                </div>
                <div>
                  <label style={styles.fieldLabel}>SEEKING</label>
                  <select
                    value={profile.seeking}
                    onChange={(e) =>
                      setProfile({ ...profile, seeking: e.target.value })
                    }
                    style={styles.squareSelect}
                  >
                    <option value="Women">Women</option>
                    <option value="Men">Men</option>
                    <option value="Everyone">Everyone</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '10px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <label style={styles.fieldLabel}>
                    INTERESTS (MIN 5, MAX 10)
                  </label>
                  <span style={{ fontSize: '11px', fontWeight: '700' }}>
                    {profile.interests.length}/10
                  </span>
                </div>
                <div style={styles.interestScrollContainer}>
                  {INTEREST_CATEGORIES.map((group) => (
                    <div key={group.category} style={{ marginBottom: '12px' }}>
                      <div style={styles.categoryTitle}>{group.category}</div>
                      <div style={styles.tagWrap}>
                        {group.items.map((item) => {
                          const selected = profile.interests.includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => toggleInterest(item)}
                              style={{
                                ...styles.squareTag,
                                backgroundColor: selected
                                  ? '#141414'
                                  : '#FFFFFF',
                                color: selected ? '#FFFFFF' : '#262626',
                              }}
                            >
                              {item}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '14px' }}>
                <label style={styles.fieldLabel}>PROMPT</label>
                <select
                  value={profile.promptQuestion}
                  onChange={(e) =>
                    setProfile({ ...profile, promptQuestion: e.target.value })
                  }
                  style={styles.squareSelect}
                >
                  {PROMPTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <textarea
                  placeholder="Your response..."
                  value={profile.promptAnswer}
                  onChange={(e) =>
                    setProfile({ ...profile, promptAnswer: e.target.value })
                  }
                  style={styles.squareTextarea}
                />
              </div>
            </div>

            <div style={styles.sectionBox}>
              <div style={styles.layerHeaderVault}>
                🔒 LAYER 02 — THE VAULT (HIDDEN UNTIL MUTUAL REVEAL)
              </div>
              <label style={styles.fieldLabel}>REAL NAME</label>
              <input
                type="text"
                value={profile.realName}
                onChange={(e) =>
                  setProfile({ ...profile, realName: e.target.value })
                }
                style={styles.squareInput}
              />
              <div style={styles.twoColGrid}>
                <div>
                  <label style={styles.fieldLabel}>INSTAGRAM ID</label>
                  <input
                    type="text"
                    placeholder="@handle"
                    value={profile.instaId}
                    onChange={(e) =>
                      setProfile({ ...profile, instaId: e.target.value })
                    }
                    style={styles.squareInput}
                  />
                </div>
                <div>
                  <label style={styles.fieldLabel}>HEIGHT</label>
                  <input
                    type="text"
                    value={profile.height}
                    onChange={(e) =>
                      setProfile({ ...profile, height: e.target.value })
                    }
                    style={styles.squareInput}
                  />
                </div>
              </div>
              <div style={styles.threeColGrid}>
                <div>
                  <label style={styles.fieldLabel}>DRINKING</label>
                  <select
                    value={profile.drinking}
                    onChange={(e) =>
                      setProfile({ ...profile, drinking: e.target.value })
                    }
                    style={styles.squareSelect}
                  >
                    <option>Never</option>
                    <option>Rarely</option>
                    <option>Socially</option>
                    <option>Frequently</option>
                  </select>
                </div>
                <div>
                  <label style={styles.fieldLabel}>SMOKING</label>
                  <select
                    value={profile.smoking}
                    onChange={(e) =>
                      setProfile({ ...profile, smoking: e.target.value })
                    }
                    style={styles.squareSelect}
                  >
                    <option>Never</option>
                    <option>Socially</option>
                    <option>Regularly</option>
                  </select>
                </div>
                <div>
                  <label style={styles.fieldLabel}>WEED</label>
                  <select
                    value={profile.weed}
                    onChange={(e) =>
                      setProfile({ ...profile, weed: e.target.value })
                    }
                    style={styles.squareSelect}
                  >
                    <option>Never</option>
                    <option>Rarely</option>
                    <option>Socially</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              style={{ ...styles.primarySquareBtn, marginBottom: '28px' }}
            >
              {busy ? 'Saving & Matching...' : 'Lock Vault & Find Matches'}
            </button>
          </form>
        )}

        {/* SCREEN 3: DAILY MATCHES */}
        {screen === 'matches' && (
          <div style={styles.scrollContent}>
            <div style={styles.kicker}>
              LOGGED IN AS {profile.alias.toUpperCase()}
            </div>
            <h2 style={styles.pageHeading}>Your Daily Blind Matches</h2>
            <p style={styles.bodyCopy}>
              Up to 3 compatible campus profiles per day based on your seeking
              preferences and shared interests.
            </p>

            {dailyMatches.length === 0 ? (
              <div style={styles.sectionBox}>
                <h3 style={styles.matchCardTitle}>You're in the Joka Pool!</h3>
                <p style={styles.bodyCopy}>
                  As soon as compatible classmates join the pool, your 3 daily
                  matches will appear here automatically.
                </p>
                <button
                  onClick={() => loadDailyMatches(session.user.id)}
                  style={styles.primarySquareBtn}
                >
                  Refresh Matches
                </button>
              </div>
            ) : (
              dailyMatches.map((m, idx) => {
                const unlocked = m.user_1_reveal && m.user_2_reveal;
                const p = m.partnerPublic;
                return (
                  <div key={m.id} style={styles.matchCard}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span style={styles.matchRankBadge}>
                          MATCH 0{idx + 1}
                        </span>
                        <h3 style={styles.matchCardTitle}>
                          {unlocked && m.partnerVault
                            ? m.partnerVault.real_name
                            : p.alias}
                          , {p.age}
                        </h3>
                      </div>
                      <span
                        style={
                          unlocked ? styles.unlockedBadge : styles.lockedBadge
                        }
                      >
                        {unlocked ? '🔓 Vault Open' : '🔒 Blind'}
                      </span>
                    </div>
                    <div style={styles.editorialPromptBox}>
                      <div style={styles.promptLabel}>{p.prompt_question}</div>
                      <div style={styles.promptQuote}>“{p.prompt_answer}”</div>
                    </div>
                    <button
                      onClick={() => openChatRoom(m)}
                      style={styles.primarySquareBtn}
                    >
                      Open Chat & Reveal Options
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* SCREEN 4: LIVE CHAT & MUTUAL REVEAL */}
        {screen === 'chat' && activeMatch && (
          <div style={styles.chatContainer}>
            <div style={styles.chatPartnerHeader}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
              >
                <button
                  onClick={() => {
                    loadDailyMatches(session.user.id);
                    setScreen('matches');
                  }}
                  style={styles.smallSquareBtn}
                >
                  ← Back
                </button>
                <div>
                  <div style={styles.chatPartnerTitle}>
                    {activeMatch.user_1_reveal &&
                    activeMatch.user_2_reveal &&
                    activeMatch.partnerVault
                      ? activeMatch.partnerVault.real_name
                      : activeMatch.partnerPublic.alias}
                    , {activeMatch.partnerPublic.age}
                  </div>
                </div>
              </div>

              {activeMatch.user_1_reveal &&
              activeMatch.user_2_reveal &&
              activeMatch.partnerVault ? (
                <div style={styles.vaultUnlockedBox}>
                  <strong>🔓 VAULT UNLOCKED:</strong>{' '}
                  {activeMatch.partnerVault.real_name} • IG:{' '}
                  {activeMatch.partnerVault.insta_id} • Height:{' '}
                  {activeMatch.partnerVault.height}
                  <br />
                  Drinking: {activeMatch.partnerVault.drinking} • Smoking:{' '}
                  {activeMatch.partnerVault.smoking} • Weed:{' '}
                  {activeMatch.partnerVault.weed}
                </div>
              ) : (
                <button
                  onClick={handleToggleReveal}
                  style={{ ...styles.primarySquareBtn, marginTop: '10px' }}
                >
                  {(
                    activeMatch.user_1 === session.user.id
                      ? activeMatch.user_1_reveal
                      : activeMatch.user_2_reveal
                  )
                    ? '✓ You Clicked Reveal (Waiting for Partner...)'
                    : '🔓 Reveal Identity (Requires Both)'}
                </button>
              )}
            </div>

            <div style={styles.messagesScroll}>
              {messages.map((msg) => {
                const isMe = msg.sender_id === session.user.id;
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: '8px',
                    }}
                  >
                    <div
                      style={{
                        ...styles.chatBubble,
                        backgroundColor: isMe ? '#141414' : '#F7F7F7',
                        color: isMe ? '#FFFFFF' : '#141414',
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} style={styles.chatBar}>
              <input
                type="text"
                placeholder="Write a message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={styles.chatSquareInput}
              />
              <button type="submit" style={styles.chatSendSquareBtn}>
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  outerViewport: {
    backgroundColor: '#F5F5F4',
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '16px',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    color: '#141414',
  },
  appFrame: {
    width: '100%',
    maxWidth: '425px',
    height: '850px',
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    border: '1px solid #E4E4E4',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 22px',
    borderBottom: '1px solid #EEEEEE',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoText: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '21px',
    fontWeight: '700',
  },
  campusTag: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '4px 8px',
    backgroundColor: '#F3F3F3',
    borderRadius: '4px',
  },
  smallSquareBtn: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #D4D4D4',
    borderRadius: '6px',
    padding: '5px 10px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  scrollContent: { padding: '22px', overflowY: 'auto', flex: 1 },
  kicker: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '1.4px',
    color: '#5B2346',
    marginBottom: '8px',
  },
  heroHeading: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '34px',
    lineHeight: '1.15',
    margin: '0 0 14px 0',
  },
  pageHeading: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '26px',
    margin: '0 0 6px 0',
  },
  bodyCopy: {
    fontSize: '13.5px',
    lineHeight: '1.55',
    color: '#595959',
    margin: '0 0 18px 0',
  },
  sectionBox: {
    border: '1px solid #E5E5E5',
    borderRadius: '8px',
    padding: '18px',
    marginBottom: '18px',
  },
  layerHeader: {
    fontSize: '10px',
    fontWeight: '700',
    backgroundColor: '#F3F3F3',
    padding: '6px 10px',
    borderRadius: '4px',
    marginBottom: '16px',
  },
  layerHeaderVault: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#5B2346',
    backgroundColor: '#F9F2F6',
    padding: '6px 10px',
    borderRadius: '4px',
    marginBottom: '16px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '10.5px',
    fontWeight: '700',
    color: '#4A4A4A',
    marginBottom: '6px',
  },
  squareInput: {
    width: '100%',
    padding: '11px 12px',
    fontSize: '13.5px',
    borderRadius: '6px',
    border: '1px solid #D4D4D4',
    boxSizing: 'border-box',
    marginBottom: '14px',
  },
  squareSelect: {
    width: '100%',
    padding: '11px 10px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid #D4D4D4',
    boxSizing: 'border-box',
    marginBottom: '14px',
  },
  squareTextarea: {
    width: '100%',
    height: '68px',
    padding: '11px 12px',
    fontSize: '13.5px',
    borderRadius: '6px',
    border: '1px solid #D4D4D4',
    boxSizing: 'border-box',
  },
  twoColGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  threeColGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '10px',
  },
  interestScrollContainer: {
    maxHeight: '240px',
    overflowY: 'auto',
    border: '1px solid #EBEBEB',
    borderRadius: '6px',
    padding: '12px',
    backgroundColor: '#FAFAFA',
  },
  categoryTitle: { fontSize: '11px', fontWeight: '700', marginBottom: '6px' },
  tagWrap: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  squareTag: {
    padding: '6px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    border: '1px solid #DCDCDC',
    cursor: 'pointer',
  },
  primarySquareBtn: {
    width: '100%',
    padding: '13px 16px',
    backgroundColor: '#141414',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13.5px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    color: '#B91C1C',
    padding: '10px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    marginBottom: '14px',
  },
  matchCard: {
    border: '1px solid #E2E2E2',
    borderRadius: '8px',
    padding: '18px',
    marginBottom: '16px',
  },
  matchRankBadge: { fontSize: '10px', fontWeight: '700', color: '#5B2346' },
  matchCardTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '22px',
    margin: '4px 0 12px 0',
  },
  lockedBadge: {
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: '#F3F3F3',
    padding: '4px 8px',
    borderRadius: '4px',
    height: 'fit-content',
  },
  unlockedBadge: {
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: '#EBF7EE',
    color: '#1F5132',
    padding: '4px 8px',
    borderRadius: '4px',
    height: 'fit-content',
  },
  editorialPromptBox: {
    backgroundColor: '#FAFAFA',
    borderLeft: '3px solid #141414',
    padding: '10px 12px',
    marginBottom: '14px',
  },
  promptLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#555555',
    marginBottom: '4px',
  },
  promptQuote: { fontFamily: '"Playfair Display", serif', fontSize: '14.5px' },
  chatContainer: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  chatPartnerHeader: {
    padding: '14px 18px',
    borderBottom: '1px solid #EAEAEA',
  },
  chatPartnerTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '18px',
    fontWeight: '600',
  },
  vaultUnlockedBox: {
    marginTop: '10px',
    padding: '10px',
    backgroundColor: '#F4FBF6',
    border: '1px solid #B7E4C7',
    borderRadius: '6px',
    fontSize: '11.5px',
    color: '#1B4332',
  },
  messagesScroll: { flex: 1, padding: '18px', overflowY: 'auto' },
  chatBubble: {
    maxWidth: '76%',
    padding: '10px 13px',
    borderRadius: '6px',
    fontSize: '13px',
  },
  chatBar: {
    padding: '12px 16px',
    borderTop: '1px solid #EAEAEA',
    display: 'flex',
    gap: '8px',
  },
  chatSquareInput: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #D4D4D4',
    fontSize: '13px',
  },
  chatSendSquareBtn: {
    padding: '0 18px',
    backgroundColor: '#141414',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
