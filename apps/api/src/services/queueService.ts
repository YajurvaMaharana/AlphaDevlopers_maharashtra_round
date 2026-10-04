import crypto from 'crypto';

export const QUEUE_CONFIG = {
  BATCH_SIZE: 50,
  BATCH_DURATION_SEC: 30, // Each batch takes 30s
  DEFAULT_DROP_ID: 'fairdrop-main-2026',
};

export interface TicketData {
  ticketId: string;
  fairId: string;
  userId: string;
  dropId: string;
  positionToken: string;
  rank: number;
  status: 'WAITING_ROOM' | 'QUEUED' | 'ADMITTED' | 'RESERVED' | 'COMPLETED';
  joinedAt: number;
  lastEtaSec: number;
  admissionToken?: string;
  seatNumber?: number;
}

/**
 * Computes a secure, tamper-evident position token for a FairID and rank.
 */
export function computePositionToken(fairId: string, rank: number, secretSalt: string = 'fairdrop_position_salt'): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${fairId}:${rank}:${secretSalt}`)
    .digest('hex')
    .slice(0, 24);
  return `pos_tok_${fairId.slice(0, 10)}_${rank}_${hash}`;
}

/**
 * Computes monotonic, smoothly bounded ETA.
 * Invariant: The ETA never jumps backwards (upwards in wait time) by more than one batch (BATCH_DURATION_SEC = 30s).
 */
export function computeMonotonicEta(currentPosition: number, prevEtaSec?: number | null): number {
  if (currentPosition <= 0) return 0;
  const batchIndex = Math.ceil(currentPosition / QUEUE_CONFIG.BATCH_SIZE);
  const rawEta = batchIndex * QUEUE_CONFIG.BATCH_DURATION_SEC;

  if (prevEtaSec === undefined || prevEtaSec === null || prevEtaSec <= 0) {
    return rawEta;
  }

  // Maximum allowed upward jump is 1 batch duration
  const maxAllowedEta = prevEtaSec + QUEUE_CONFIG.BATCH_DURATION_SEC;
  const boundedEta = Math.min(rawEta, maxAllowedEta);

  return Math.max(0, boundedEta);
}

/**
 * Retrieves an existing ticket for a FairID, or creates a new one idempotently.
 * Guarantees that joining twice with the same FairID (second tab, second device, replay)
 * returns the existing ticket and never creates a second one.
 */
export async function getOrCreateTicket(
  redis: any,
  dropId: string = QUEUE_CONFIG.DEFAULT_DROP_ID,
  fairId: string,
  userId: string,
  fingerprint?: string
): Promise<{ ticket: TicketData; isExisting: boolean }> {
  const ticketKey = `drop:${dropId}:ticket:${fairId}`;

  // 1. Check if a ticket already exists for this FairID
  const existingRaw = await redis.hgetall(ticketKey);
  if (existingRaw && existingRaw.ticketId && existingRaw.positionToken) {
    const existingTicket: TicketData = {
      ticketId: existingRaw.ticketId,
      fairId: existingRaw.fairId || fairId,
      userId: existingRaw.userId || userId,
      dropId: existingRaw.dropId || dropId,
      positionToken: existingRaw.positionToken,
      rank: parseInt(existingRaw.rank, 10) || 1,
      status: (existingRaw.status as any) || 'WAITING_ROOM',
      joinedAt: parseInt(existingRaw.joinedAt, 10) || Date.now(),
      lastEtaSec: parseInt(existingRaw.lastEtaSec, 10) || 30,
      admissionToken: existingRaw.admissionToken,
      seatNumber: existingRaw.seatNumber ? parseInt(existingRaw.seatNumber, 10) : undefined,
    };
    return { ticket: existingTicket, isExisting: true };
  }

  // 2. Allocate next queue rank atomically
  const rankKey = `drop:${dropId}:next_rank`;
  const rank = await redis.incr(rankKey);

  const ticketId = `tk_${fairId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}_${rank}`;
  const positionToken = computePositionToken(fairId, rank);
  const initialEta = computeMonotonicEta(rank, null);
  const joinedAt = Date.now();

  const newTicket: TicketData = {
    ticketId,
    fairId,
    userId,
    dropId,
    positionToken,
    rank,
    status: 'WAITING_ROOM',
    joinedAt,
    lastEtaSec: initialEta,
  };

  // 3. Save ticket to Redis with persistence (no short TTL so it survives refreshes & restarts)
  await redis.hset(ticketKey, {
    ticketId,
    fairId,
    userId,
    dropId,
    positionToken,
    rank: String(rank),
    status: 'WAITING_ROOM',
    joinedAt: String(joinedAt),
    lastEtaSec: String(initialEta),
  });

  // Track global participant sets and reverse mappings
  await redis.sadd(`drop:${dropId}:participants`, fairId);
  await redis.set(`user:${userId}:fairId`, fairId);
  await redis.set(`fairId:pos:${positionToken}`, fairId);

  return { ticket: newTicket, isExisting: false };
}

/**
 * Retrieves existing ticket for a FairID.
 */
export async function getTicketByFairId(
  redis: any,
  fairId: string,
  dropId: string = QUEUE_CONFIG.DEFAULT_DROP_ID
): Promise<TicketData | null> {
  const ticketKey = `drop:${dropId}:ticket:${fairId}`;
  const raw = await redis.hgetall(ticketKey);
  if (!raw || !raw.ticketId) {
    return null;
  }

  return {
    ticketId: raw.ticketId,
    fairId: raw.fairId || fairId,
    userId: raw.userId || 'usr_anonymous',
    dropId: raw.dropId || dropId,
    positionToken: raw.positionToken,
    rank: parseInt(raw.rank, 10) || 1,
    status: (raw.status as any) || 'WAITING_ROOM',
    joinedAt: parseInt(raw.joinedAt, 10) || Date.now(),
    lastEtaSec: parseInt(raw.lastEtaSec, 10) || 30,
    admissionToken: raw.admissionToken,
    seatNumber: raw.seatNumber ? parseInt(raw.seatNumber, 10) : undefined,
  };
}
