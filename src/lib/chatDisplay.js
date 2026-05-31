/** Who counts as leadership for chat visibility rules. */
export function isPrivilegedChatRole(role) {
  return role === 'owner' || role === 'manager' || role === 'admin';
}

/** Stable accent for anonymous senders (same user → same color). */
export function anonAccentForUser(userId) {
  const palette = [
    'bg-violet-500/20 text-violet-300 border-violet-500/30',
    'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    'bg-rose-500/20 text-rose-300 border-rose-500/30',
    'bg-lime-500/20 text-lime-300 border-lime-500/30',
    'bg-orange-500/20 text-orange-300 border-orange-500/30',
  ];
  if (!userId) return palette[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash + userId.charCodeAt(i) * (i + 1)) % palette.length;
  }
  return palette[hash];
}

/**
 * Resolve how a message sender should appear to the current viewer.
 * @param {object} opts
 * @param {string} opts.viewerId
 * @param {string} opts.viewerRole - UI role (owner, manager, editor, …)
 * @param {string} opts.senderId
 * @param {string} opts.senderName
 * @param {string} opts.senderRole - UI role of sender
 * @param {boolean} opts.isDirect - direct message thread
 */
export function getMessageSenderDisplay({
  viewerId,
  viewerRole,
  senderId,
  senderName,
  senderRole,
  isDirect = false,
}) {
  const name = senderName?.trim() || 'Member';

  if (senderId === viewerId) {
    return {
      label: 'You',
      sublabel: null,
      anonymous: false,
      accent: 'bg-primary/20 text-primary border-primary/30',
    };
  }

  if (isDirect) {
    return {
      label: name,
      sublabel: senderRole,
      anonymous: false,
      accent: 'bg-secondary text-foreground border-border',
    };
  }

  if (isPrivilegedChatRole(viewerRole)) {
    return {
      label: name,
      sublabel: senderRole,
      anonymous: false,
      accent: 'bg-secondary text-foreground border-border',
    };
  }

  if (isPrivilegedChatRole(senderRole)) {
    return {
      label: name,
      sublabel: senderRole,
      anonymous: false,
      accent: 'bg-secondary text-foreground border-border',
    };
  }

  return {
    label: 'Team member',
    sublabel: null,
    anonymous: true,
    accent: anonAccentForUser(senderId),
  };
}

export function getDirectThreadTitle({ viewerId, viewerRole, participants, membersByUserId }) {
  const others = participants.filter((p) => p.user_id !== viewerId);
  if (!others.length) return 'Direct message';

  if (isPrivilegedChatRole(viewerRole)) {
    const other = others[0];
    const member = membersByUserId?.[other.user_id];
    return member?.user_name || member?.user_email || 'Direct message';
  }

  const leader = others.find((p) => {
    const role = membersByUserId?.[p.user_id]?.role;
    return isPrivilegedChatRole(role);
  });
  if (leader) {
    const member = membersByUserId?.[leader.user_id];
    return member?.user_name || member?.user_email || 'Leadership';
  }

  return 'Direct message';
}
