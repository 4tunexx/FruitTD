import { getAuthToken } from '../../services/auth';
import { lobbyApi, type CoopLobby } from '../../services/lobbies';
import { socialApi } from '../../services/social';
import { el, clear } from '../components/dom';

export function renderCoopLobby(root: HTMLElement, startLocal: () => void): void {
  const card = el('section', { class: 'ftd-coop-card ftd-coop-lobby' }, [
    el('p', { class: 'ftd-playcard__eyebrow', text: 'CO-OP DEFENCE' }),
    el('h2', { text: 'DEFEND THE WALL TOGETHER' }),
    el('p', { text: 'Create a room for up to four friends, invite by username, share its code, or find a public room.' }),
  ]);
  root.appendChild(card);
  const status = el('p', { class: 'ftd-coop-lobby__status', role: 'status', 'aria-live': 'polite' });
  const area = el('div', { class: 'ftd-coop-lobby__area' });
  card.append(status, area);
  let room: CoopLobby | null = null;
  let selfId = '';
  let busy = false;

  const button = (label: string, run: () => void | Promise<void>) => {
    const control = el('button', { class: 'ftd-coop-lobby__button', type: 'button', text: label }) as HTMLButtonElement;
    control.addEventListener('click', () => void run());
    return control;
  };
  const action = async (task: () => Promise<unknown>, success: string) => {
    if (busy) return;
    busy = true;
    try { await task(); status.textContent = success; await refresh(); }
    catch (err) { status.textContent = err instanceof Error ? err.message : 'Lobby unavailable'; }
    finally { busy = false; }
  };

  const paint = () => {
    clear(area);
    if (!getAuthToken()) {
      area.appendChild(el('p', { text: 'Sign in to create or join online rooms.' }));
    } else if (room) {
      area.appendChild(el('p', { text: `Room code: ${room.code} · ${room.visibility === 'public' ? 'Public' : 'Friends and code'} · ${room.members.length}/4 players` }));
      const list = el('ul', { class: 'ftd-coop-lobby__members' });
      for (const member of room.members) list.appendChild(el('li', { text: `${member.name}${member.userId === room.hostId ? ' · Host' : ''} · ${member.ready ? 'Ready' : 'Waiting'}` }));
      area.appendChild(list);
      const mine = room.members.find((member) => member.userId === selfId);
      area.appendChild(button(mine?.ready ? 'Cancel ready' : 'Ready up', () => action(() => lobbyApi.ready(!mine?.ready), 'Ready status updated')));
      if (room.hostId === selfId) {
        const invite = el('input', { type: 'text', placeholder: 'Friend username', 'aria-label': 'Friend username', maxlength: '24' }) as HTMLInputElement;
        const select = el('select', { 'aria-label': 'Choose an accepted friend' }) as HTMLSelectElement;
        select.appendChild(el('option', { value: '', text: 'Choose a friend' }));
        area.append(invite, select, button('Invite friend', () => action(() => lobbyApi.invite(select.value ? { friendId: select.value } : { username: invite.value.trim() }), 'Invite sent to your friend’s notifications')));
        void socialApi.friends().then(({ friends }) => {
          if (!area.isConnected || room?.hostId !== selfId) return;
          const accepted = friends.filter((friend) => friend.state === 'accepted');
          for (const friend of accepted) select.appendChild(el('option', { value: friend.userId, text: friend.nickname || friend.username }));
        }).catch(() => undefined);
      }
      area.appendChild(button('Leave room', () => action(() => lobbyApi.leave(), 'Left room')));
      area.appendChild(el('p', { class: 'ftd-coop-lobby__note', text: 'Shared combat is still in development. Ready rooms do not start separate matches or grant rewards.' }));
    } else {
      area.append(
        button('Create friends room', () => action(() => lobbyApi.create('friends'), 'Room created')),
        button('Create public room', () => action(() => lobbyApi.create('public'), 'Public room created')),
        button('Join public room', () => action(() => lobbyApi.join(), 'Joined room')),
      );
      const code = el('input', { type: 'text', maxlength: '8', placeholder: 'Invite code', 'aria-label': 'Invite code' }) as HTMLInputElement;
      area.append(code, button('Join by code', () => action(() => lobbyApi.join(code.value), 'Joined room')));
    }
    area.appendChild(el('p', { class: 'ftd-coop-lobby__note', text: 'Want to play now? Local guest assist runs on this device.' }));
    area.appendChild(button('Play local Co-op', startLocal));
  };

  const refresh = async () => {
    if (!getAuthToken()) { paint(); return; }
    const snapshot = await lobbyApi.mine();
    room = snapshot.lobby; selfId = snapshot.userId;
    if (card.isConnected) paint();
  };
  void refresh().then(async () => {
    const inviteCode = sessionStorage.getItem('fruit-td-coop-invite');
    if (inviteCode && !room) {
      sessionStorage.removeItem('fruit-td-coop-invite');
      await action(() => lobbyApi.join(inviteCode), 'Joined your friend’s room');
    }
  }).catch((err) => { status.textContent = err instanceof Error ? err.message : 'Lobbies unavailable'; paint(); });
  const timer = setInterval(() => {
    if (!card.isConnected) { clearInterval(timer); return; }
    if (!busy && getAuthToken()) void refresh().catch(() => { status.textContent = 'Lobby connection lost. Retrying…'; });
  }, 5000);
}
