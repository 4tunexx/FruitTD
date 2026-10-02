import { ArrowLeft, Bell, MessageCircle, Search, UserPlus, Users, createElement } from 'lucide';
import { getAuthToken } from '../../services/auth';
import { socialApi, type ForumPost, type PublicPlayerProfile, type SocialFriend, type SocialMessage, type SocialNotification } from '../../services/social';
import { el, clear } from '../components/dom';
import { back } from './registry';

const icon = (node: typeof Users) => typeof document.createElementNS === 'function'
  ? createElement(node, { width: 18, height: 18, 'aria-hidden': 'true' }) : el('span', { text: '◆' });
const formField = (label: string, placeholder: string, testid: string) => {
  const input = el('input', { type: 'text', placeholder, 'aria-label': label, 'data-testid': testid, autocomplete: 'off' }) as HTMLInputElement;
  return input;
};
const message = (host: HTMLElement, text: string, error = false) => {
  host.replaceChildren(el('p', { class: `ftd-social__notice${error ? ' is-error' : ''}`, role: error ? 'alert' : 'status', text }));
};

export function renderSocial(root: HTMLElement): void {
  clear(root);
  root.className = 'ftd-screen-host ftd-social';
  const friends = new Map<string, SocialFriend>();
  let selectedFriend = '';
  let noticeHost: HTMLElement;
  const header = el('header', { class: 'ftd-social__header' }, [
    el('button', { class: 'ftd-social__back', type: 'button', 'aria-label': 'Back to hub' }, [icon(ArrowLeft), el('span', { text: 'HUB' })]),
    el('div', {}, [el('p', { class: 'ftd-social__eyebrow', text: 'FRUIT TD NETWORK' }), el('h1', { text: 'COMMUNITY' })]),
    el('span', { class: 'ftd-social__mark', 'aria-hidden': 'true' }, [icon(Users)]),
  ]);
  header.querySelector('button')?.addEventListener('click', back);
  root.appendChild(header);
  noticeHost = el('div', { class: 'ftd-social__status', 'aria-live': 'polite' });
  root.appendChild(noticeHost);
  if (!getAuthToken()) {
    const gate = el('section', { class: 'ftd-social__gate' }, [icon(Users), el('h2', { text: 'Sign in to join the community' }), el('p', { text: 'Friends, inbox and notification history are linked to your player account.' })]);
    root.appendChild(gate);
    return;
  }

  const layout = el('div', { class: 'ftd-social__layout' });
  const friendsPanel = el('section', { class: 'ftd-social__panel' });
  const profilesPanel = el('section', { class: 'ftd-social__panel' });
  const inboxPanel = el('section', { class: 'ftd-social__panel ftd-social__panel--wide' });
  layout.append(friendsPanel, profilesPanel, inboxPanel);
  root.appendChild(layout);
  const forumPanel = el('section', { class: 'ftd-social__panel ftd-social__forum' }, [el('div', { class: 'ftd-social__panel-title' }, [icon(MessageCircle), el('h2', { text: 'Forum' })])]);
  root.appendChild(forumPanel);
  const postForm = el('form', { class: 'ftd-social__forum-form' });
  const postTitle = el('input', { type: 'text', maxlength: '100', placeholder: 'Topic title', 'aria-label': 'Topic title' }) as HTMLInputElement;
  const postBody = el('textarea', { maxlength: '2000', rows: '3', placeholder: 'Share with the community…', 'aria-label': 'Post body' }) as HTMLTextAreaElement;
  const postButton = el('button', { type: 'submit', class: 'ftd-social__button', text: 'Post topic' });
  postForm.append(postTitle, postBody, postButton);
  forumPanel.appendChild(postForm);
  const postsHost = el('div', { class: 'ftd-social__posts', 'aria-live': 'polite' });
  forumPanel.appendChild(postsHost);
  const loadForum = async () => {
    const { posts } = await socialApi.forum();
    clear(postsHost);
    if (!posts.length) postsHost.appendChild(el('p', { class: 'ftd-social__empty', text: 'No topics yet. Start the conversation.' }));
    for (const post of posts as ForumPost[]) {
      const article = el('article', { class: 'ftd-social__post' }, [el('h3', { text: post.title }), el('small', { text: `@${post.author} · ${new Date(post.createdAt).toLocaleString()}` }), el('p', { text: post.body })]);
      for (const reply of post.replies ?? []) article.appendChild(el('div', { class: 'ftd-social__reply' }, [el('strong', { text: `@${reply.author}` }), el('p', { text: reply.body })]));
      const replyForm = el('form', { class: 'ftd-social__add' });
      const replyInput = el('input', { type: 'text', maxlength: '1000', placeholder: 'Write a reply…', 'aria-label': `Reply to ${post.title}` }) as HTMLInputElement;
      const replyButton = el('button', { type: 'submit', class: 'ftd-social__mini-button', text: 'Reply' });
      replyForm.append(replyInput, replyButton);
      replyForm.addEventListener('submit', async (event) => {
        event.preventDefault(); if (!replyInput.value.trim()) return;
        replyButton.setAttribute('disabled', '');
        try { await socialApi.reply(post.postId, replyInput.value.trim()); await loadForum(); }
        catch (error) { message(noticeHost, error instanceof Error ? error.message : 'Could not save reply.', true); replyButton.removeAttribute('disabled'); }
      });
      article.appendChild(replyForm); postsHost.appendChild(article);
    }
  };
  postForm.addEventListener('submit', async (event) => {
    event.preventDefault(); postButton.setAttribute('disabled', '');
    try { await socialApi.createPost(postTitle.value.trim(), postBody.value.trim()); postTitle.value = ''; postBody.value = ''; await loadForum(); }
    catch (error) { message(noticeHost, error instanceof Error ? error.message : 'Could not save post.', true); }
    finally { postButton.removeAttribute('disabled'); }
  });

  const renderFriends = () => {
    clear(friendsPanel);
    friendsPanel.appendChild(el('div', { class: 'ftd-social__panel-title' }, [icon(UserPlus), el('h2', { text: 'Friends' })]));
    const addForm = el('form', { class: 'ftd-social__add' });
    const name = formField('Player username', 'Find a slicer by username', 'social-friend-username');
    const add = el('button', { type: 'submit', class: 'ftd-social__button', text: 'Send request', 'data-testid': 'social-add-friend' });
    addForm.append(name, add);
    addForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!name.value.trim()) return message(noticeHost, 'Enter a player username first.', true);
      add.setAttribute('disabled', '');
      try { await socialApi.requestFriend(name.value.trim()); message(noticeHost, 'Friend request sent.'); await loadFriends(); }
      catch (error) { message(noticeHost, error instanceof Error ? error.message : 'Could not send request.', true); }
      finally { add.removeAttribute('disabled'); }
    });
    friendsPanel.appendChild(addForm);
    if (!friends.size) friendsPanel.appendChild(el('p', { class: 'ftd-social__empty', text: 'Your friend roster is empty. Search a username to send your first request.' }));
    for (const friend of friends.values()) {
      const row = el('article', { class: 'ftd-social__friend' }, [
        el('div', { class: 'ftd-social__avatar' }, friend.avatar ? [el('img', { src: friend.avatar, alt: '' })] : [el('span', { text: friend.username.slice(0, 1).toUpperCase() })]),
        el('div', { class: 'ftd-social__friend-name' }, [el('strong', { text: friend.nickname || friend.username }), el('small', { text: `@${friend.username}` })]),
      ]);
      if (friend.state === 'pending' && friend.direction === 'incoming') {
        const accept = el('button', { type: 'button', class: 'ftd-social__mini-button', text: 'Accept', 'aria-label': `Accept ${friend.username}` });
        accept.addEventListener('click', async () => {
          try { await socialApi.respondFriend(friend.userId, true); message(noticeHost, `${friend.username} added to friends.`); await loadFriends(); }
          catch (error) { message(noticeHost, error instanceof Error ? error.message : 'Could not accept request.', true); }
        });
        const decline = el('button', { type: 'button', class: 'ftd-social__mini-button is-muted', text: 'Decline', 'aria-label': `Decline ${friend.username}` });
        decline.addEventListener('click', async () => {
          try { await socialApi.respondFriend(friend.userId, false); await loadFriends(); }
          catch (error) { message(noticeHost, error instanceof Error ? error.message : 'Could not decline request.', true); }
        });
        row.append(accept, decline);
      } else if (friend.state === 'accepted') {
        const actions = el('div', { class: 'ftd-social__friend-actions' });
        const profile = el('button', { type: 'button', class: 'ftd-social__mini-button', text: 'View' });
        profile.addEventListener('click', () => lookupProfile(friend.username));
        const chat = el('button', { type: 'button', class: 'ftd-social__mini-button is-accent', text: 'Message' });
        chat.addEventListener('click', () => { selectedFriend = friend.username; void loadMessages(); });
        actions.append(profile, chat); row.appendChild(actions);
      } else row.appendChild(el('small', { class: 'ftd-social__pending', text: 'Request sent' }));
      friendsPanel.appendChild(row);
    }
  };

  const lookupProfile = async (username: string) => {
    const lookup = profilesPanel.querySelector<HTMLInputElement>('[data-testid="social-profile-username"]');
    if (lookup) lookup.value = username;
    clear(profilesPanel);
    profilesPanel.appendChild(el('div', { class: 'ftd-social__panel-title' }, [icon(Search), el('h2', { text: 'Player profile' })]));
    const result = el('div', { class: 'ftd-social__loading', text: `Looking up @${username}…` }); profilesPanel.appendChild(result);
    try {
      const data = await socialApi.profile(username); renderProfile(data.profile);
    } catch (error) { result.className = 'ftd-social__empty'; result.textContent = error instanceof Error ? error.message : 'Could not load profile.'; }
  };
  const renderProfile = (profile: PublicPlayerProfile) => {
    clear(profilesPanel);
    profilesPanel.appendChild(el('div', { class: 'ftd-social__panel-title' }, [icon(Search), el('h2', { text: 'Player profile' })]));
    const card = el('article', { class: 'ftd-social__profile' }, [
      el('div', { class: 'ftd-social__profile-avatar' }, profile.avatar ? [el('img', { src: profile.avatar, alt: `${profile.nickname} avatar` })] : [el('span', { text: profile.username.slice(0, 1).toUpperCase() })]),
      el('h3', { text: profile.nickname }), el('p', { class: 'ftd-social__handle', text: `@${profile.username}` }),
      el('strong', { class: 'ftd-social__rank', text: profile.rank }),
      el('div', { class: 'ftd-social__stats' }, [
        el('div', {}, [el('strong', { text: profile.rankedScore.toLocaleString() }), el('span', { text: 'Rank score' })]),
        el('div', {}, [el('strong', { text: `W${profile.bestWave}` }), el('span', { text: 'Best wave' })]),
        el('div', {}, [el('strong', { text: String(profile.games) }), el('span', { text: 'Matches' })]),
      ]),
      el('p', { class: 'ftd-social__badges', text: profile.badges.length ? `${profile.badges.length} earned badges` : 'No badges earned yet' }),
    ]);
    profilesPanel.appendChild(card);
  };
  const renderNotifications = (items: SocialNotification[]) => {
    const old = root.querySelector('.ftd-social__notifications'); old?.remove();
    const panel = el('section', { class: 'ftd-social__panel ftd-social__notifications' }, [el('div', { class: 'ftd-social__panel-title' }, [icon(Bell), el('h2', { text: 'Notifications' })])]);
    const unread = items.filter((item) => !item.readAt);
    if (!items.length) panel.appendChild(el('p', { class: 'ftd-social__empty', text: 'No new signals. Friend activity will show here.' }));
    for (const item of items) panel.appendChild(el('article', { class: `ftd-social__notification${item.readAt ? '' : ' is-unread'}` }, [el('strong', { text: item.title }), el('p', { text: item.body }), el('small', { text: item.actorName })]));
    if (unread.length) {
      const mark = el('button', { class: 'ftd-social__mini-button', type: 'button', text: `Mark ${unread.length} read` });
      mark.addEventListener('click', async () => { try { await socialApi.markRead(unread.map((item) => item.notificationId)); await loadNotifications(); } catch (error) { message(noticeHost, error instanceof Error ? error.message : 'Could not mark read.', true); } });
      panel.appendChild(mark);
    }
    const insertBefore = root.querySelector('.ftd-social__layout');
    if (insertBefore) root.insertBefore(panel, insertBefore); else root.appendChild(panel);
  };
  const loadMessages = async () => {
    clear(inboxPanel);
    inboxPanel.appendChild(el('div', { class: 'ftd-social__panel-title' }, [icon(MessageCircle), el('h2', { text: selectedFriend ? `Messages · @${selectedFriend}` : 'Messages' })]));
    if (!selectedFriend) { inboxPanel.appendChild(el('p', { class: 'ftd-social__empty', text: 'Choose an accepted friend to open a private conversation.' })); return; }
    const thread = el('div', { class: 'ftd-social__thread', 'aria-live': 'polite' }); inboxPanel.appendChild(thread);
    const compose = el('form', { class: 'ftd-social__compose' });
    const text = el('textarea', { rows: '2', maxlength: '1000', placeholder: 'Send a message…', 'aria-label': 'Message', 'data-testid': 'social-message-input' }) as HTMLTextAreaElement;
    const send = el('button', { type: 'submit', class: 'ftd-social__button', text: 'Send', 'data-testid': 'social-send-message' });
    compose.append(text, send); inboxPanel.appendChild(compose);
    compose.addEventListener('submit', async (event) => {
      event.preventDefault(); if (!text.value.trim()) return;
      send.setAttribute('disabled', '');
      try { await socialApi.sendMessage(selectedFriend, text.value.trim()); text.value = ''; await loadMessages(); }
      catch (error) { message(noticeHost, error instanceof Error ? error.message : 'Could not send message.', true); }
      finally { send.removeAttribute('disabled'); }
    });
    try {
      const data = await socialApi.messages(selectedFriend);
      for (const item of data.messages as SocialMessage[]) thread.appendChild(el('article', { class: 'ftd-social__bubble' }, [el('p', { text: item.body }), el('small', { text: new Date(item.createdAt).toLocaleString() })]));
      if (!data.messages.length) thread.appendChild(el('p', { class: 'ftd-social__empty', text: 'Start the conversation.' }));
      thread.scrollTop = thread.scrollHeight;
    } catch (error) { message(noticeHost, error instanceof Error ? error.message : 'Could not load conversation.', true); }
  };
  const loadFriends = async () => {
    const data = await socialApi.friends(); friends.clear();
    for (const friend of data.friends) friends.set(friend.userId, friend);
    renderFriends();
  };
  const loadNotifications = async () => {
    const data = await socialApi.notifications(); renderNotifications(data.notifications);
    const nav = document.querySelector<HTMLButtonElement>('[data-testid="nav-social"]');
    const count = nav?.querySelector<HTMLElement>('.ftd-hub-social__count');
    if (count) {
      count.textContent = data.unread > 99 ? '99+' : String(data.unread);
      count.hidden = data.unread < 1;
      nav?.setAttribute('aria-label', data.unread ? `Community, ${data.unread} unread notifications` : 'Community and notifications');
    }
  };

  profilesPanel.appendChild(el('div', { class: 'ftd-social__panel-title' }, [icon(Search), el('h2', { text: 'Player profile' })]));
  const searchForm = el('form', { class: 'ftd-social__add' });
  const search = formField('Player username', 'Search public profiles', 'social-profile-username');
  const searchButton = el('button', { type: 'submit', class: 'ftd-social__button', text: 'View profile' });
  searchForm.append(search, searchButton);
  searchForm.addEventListener('submit', (event) => { event.preventDefault(); if (search.value.trim()) void lookupProfile(search.value.trim()); });
  profilesPanel.appendChild(searchForm);
  profilesPanel.appendChild(el('p', { class: 'ftd-social__empty', text: 'Inspect rank, hero, best wave, matches and earned badges.' }));
  inboxPanel.appendChild(el('div', { class: 'ftd-social__panel-title' }, [icon(MessageCircle), el('h2', { text: 'Messages' })]));
  inboxPanel.appendChild(el('p', { class: 'ftd-social__empty', text: 'Select a friend to open your inbox.' }));
  renderFriends();
  void Promise.all([loadFriends(), loadNotifications(), loadForum()]).catch((error) => message(noticeHost, error instanceof Error ? error.message : 'Social services are temporarily unavailable.', true));
}
import './social.css';
