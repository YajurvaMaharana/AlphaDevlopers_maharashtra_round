import {
  AdversarialAttackType,
  AdversarialMetrics,
  DropPhase,
  EventConfig,
  QueueStatus,
  ReservationGrant,
  CheckoutResponse,
  DROP_CONSTANTS
} from '@fairdrop/shared';
import { generateUUID } from './utils';

export interface TelemetryPoint {
  time: string;
  humanRequests: number;
  botRequests: number;
  blockedRequests: number;
  humanSeatsWon: number;
  botSeatsWon: number;
  cpuLoadPct: number;
  latencyMs: number;
}

type SSECallback = (type: string, data: unknown) => void;

class SimulationEngine {
  private phase: DropPhase = 'WAITING_ROOM';
  private totalSeats: number = DROP_CONSTANTS.TOTAL_SEATS;
  private remainingSeats: number = DROP_CONSTANTS.TOTAL_SEATS;
  private activeAttack: AdversarialAttackType = 'NONE';
  private totalParticipants: number = DROP_CONSTANTS.SIMULATED_CROWD_SIZE;
  private humanSeatsWon = 0;
  private botSeatsWon = 0;
  private blockedByPoW = 0;
  private blockedByRateLimit = 0;
  private userPosition: number | null = null;
  private reservationGranted = false;
  private userSeatNumber: number | null = null;
  private reservationToken: string | null = null;
  private reservationExpiresAt: number | null = null;
  private completedOrders: Map<string, CheckoutResponse> = new Map();
  private subscribers: Set<SSECallback> = new Set();
  private telemetryHistory: TelemetryPoint[] = [];
  private tickInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initHistory();
    this.startHeartbeat();
  }

  private initHistory(): void {
    const now = Date.now();
    for (let i = 10; i >= 0; i--) {
      const d = new Date(now - i * 3000);
      this.telemetryHistory.push({
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        humanRequests: 450 + Math.floor(Math.random() * 80),
        botRequests: 0,
        blockedRequests: 0,
        humanSeatsWon: 0,
        botSeatsWon: 0,
        cpuLoadPct: 8 + Math.floor(Math.random() * 4),
        latencyMs: 14 + Math.floor(Math.random() * 6)
      });
    }
  }

  public subscribe(cb: SSECallback): () => void {
    this.subscribers.add(cb);
    // Send immediate state
    cb('DROP_STATUS', this.getDropConfig());
    if (this.userPosition !== null) {
      cb('QUEUE_UPDATE', this.getQueueStatus('current-user'));
    }
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private broadcast(type: string, data: unknown): void {
    this.subscribers.forEach((cb) => {
      try {
        cb(type, data);
      } catch (err) {
        console.error('Subscriber notification error', err);
      }
    });
  }

  private startHeartbeat(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => {
      this.onTick();
    }, 2000);
  }

  private onTick(): void {
    const now = Date.now();
    const timeStr = new Date(now).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    let currentHumanReq = 500 + Math.floor(Math.random() * 100);
    let currentBotReq = 0;
    let blocked = 0;
    let cpu = 12 + Math.floor(Math.random() * 5);
    let latency = 16 + Math.floor(Math.random() * 8);

    if (this.activeAttack === 'SPEED_BOTS') {
      currentBotReq = 48500 + Math.floor(Math.random() * 1500);
      blocked = Math.floor(currentBotReq * 0.985); // 98.5% blocked by waiting room shuffle & PoW
      this.blockedByPoW += Math.floor(currentBotReq * 0.94);
      this.blockedByRateLimit += Math.floor(currentBotReq * 0.045);
      cpu = 28 + Math.floor(Math.random() * 10);
      latency = 32 + Math.floor(Math.random() * 12);
    } else if (this.activeAttack === 'VOLUME_DDOS') {
      currentBotReq = 95000 + Math.floor(Math.random() * 10000);
      blocked = Math.floor(currentBotReq * 0.996);
      this.blockedByRateLimit += Math.floor(currentBotReq * 0.85);
      this.blockedByPoW += Math.floor(currentBotReq * 0.146);
      cpu = 42 + Math.floor(Math.random() * 15);
      latency = 48 + Math.floor(Math.random() * 18);
    } else if (this.activeAttack === 'SYBIL_SWARM') {
      currentBotReq = 22000 + Math.floor(Math.random() * 3000);
      blocked = Math.floor(currentBotReq * 0.96);
      this.blockedByPoW += Math.floor(currentBotReq * 0.96);
      cpu = 30 + Math.floor(Math.random() * 8);
      latency = 28 + Math.floor(Math.random() * 10);
    }

    // Queue progression if ACTIVE
    if (this.phase === 'ACTIVE' && this.remainingSeats > 0) {
      const seatsToProcess = Math.min(this.remainingSeats, 8 + Math.floor(Math.random() * 6));
      this.remainingSeats -= seatsToProcess;

      if (this.activeAttack === 'SPEED_BOTS' || this.activeAttack === 'SYBIL_SWARM') {
        // FairDrop shuffle ensures bots only get seats proportional to legitimate lottery win (max 2-5%)
        const botWins = Math.random() < 0.15 ? 1 : 0;
        this.botSeatsWon += botWins;
        this.humanSeatsWon += seatsToProcess - botWins;
      } else {
        this.humanSeatsWon += seatsToProcess;
      }

      if (this.userPosition !== null && this.userPosition > 1) {
        this.userPosition = Math.max(1, this.userPosition - seatsToProcess * 2);
        if (this.userPosition <= 1 && !this.reservationGranted) {
          this.grantUserReservation();
        }
      }

      if (this.remainingSeats <= 0) {
        this.phase = 'SOLD_OUT';
        this.broadcast('SEATS_SOLD_OUT', {
          eventId: DROP_CONSTANTS.DEFAULT_EVENT_ID,
          message: 'All 500 seats have been reserved'
        });
      }
    }

    this.telemetryHistory.push({
      time: timeStr,
      humanRequests: currentHumanReq,
      botRequests: currentBotReq,
      blockedRequests: blocked,
      humanSeatsWon: this.humanSeatsWon,
      botSeatsWon: this.botSeatsWon,
      cpuLoadPct: cpu,
      latencyMs: latency
    });

    if (this.telemetryHistory.length > 25) {
      this.telemetryHistory.shift();
    }

    this.broadcast('HEARTBEAT', { timestamp: now });
    this.broadcast('DROP_STATUS', this.getDropConfig());
  }

  public getDropConfig(): EventConfig {
    return {
      eventId: DROP_CONSTANTS.DEFAULT_EVENT_ID,
      title: 'FairDrop Main Arena: 500 Exclusive Seats',
      description: 'Zero-Bot Fair Allocation with Proof-of-Work & Random Waiting Room Shuffle',
      totalSeats: this.totalSeats,
      remainingSeats: this.remainingSeats,
      priceCents: DROP_CONSTANTS.DEFAULT_PRICE_CENTS,
      currency: 'USD',
      waitingRoomOpensAt: Date.now() - 60000,
      dropStartsAt: Date.now() + 10000,
      purchaseWindowSeconds: DROP_CONSTANTS.PURCHASE_WINDOW_SECONDS,
      currentPhase: this.phase,
      phase: this.phase,
      waitingRoomParticipants: this.totalParticipants
    };
  }

  public joinWaitingRoom(clientId: string): { position: number; total: number } {
    if (!this.userPosition) {
      // Simulate random placement in the waiting room
      this.userPosition = 85 + Math.floor(Math.random() * 40);
    }
    return {
      position: this.userPosition,
      total: this.totalParticipants
    };
  }

  public triggerShuffle(): void {
    this.phase = 'SHUFFLE';
    this.broadcast('DROP_STATUS', this.getDropConfig());

    // Transition from SHUFFLE to ACTIVE after 3 seconds of fair shuffle animation
    setTimeout(() => {
      this.phase = 'ACTIVE';
      this.broadcast('DROP_STATUS', this.getDropConfig());
    }, 3000);
  }

  public triggerDirectGrant(clientId: string): ReservationGrant {
    this.grantUserReservation(clientId);
    return {
      reservationToken: this.reservationToken!,
      eventId: DROP_CONSTANTS.DEFAULT_EVENT_ID,
      clientId,
      seatNumber: this.userSeatNumber!,
      expiresAt: this.reservationExpiresAt!,
      lockDurationSeconds: DROP_CONSTANTS.PURCHASE_WINDOW_SECONDS
    };
  }

  private grantUserReservation(clientId = 'current-user'): void {
    this.reservationGranted = true;
    this.userPosition = 0;
    this.userSeatNumber = 100 + Math.floor(Math.random() * 350);
    this.reservationToken = `res_${generateUUID().replace(/-/g, '')}`;
    this.reservationExpiresAt = Date.now() + DROP_CONSTANTS.PURCHASE_WINDOW_SECONDS * 1000;

    const grant: ReservationGrant = {
      reservationToken: this.reservationToken,
      eventId: DROP_CONSTANTS.DEFAULT_EVENT_ID,
      clientId,
      seatNumber: this.userSeatNumber,
      expiresAt: this.reservationExpiresAt,
      lockDurationSeconds: DROP_CONSTANTS.PURCHASE_WINDOW_SECONDS
    };

    this.broadcast('RESERVATION_GRANTED', grant);
  }

  public getQueueStatus(clientId: string): QueueStatus {
    return {
      eventId: DROP_CONSTANTS.DEFAULT_EVENT_ID,
      clientId,
      phase: this.phase,
      position: this.userPosition,
      totalInQueue: this.totalParticipants,
      remainingSeats: this.remainingSeats,
      estimatedWaitSeconds: this.userPosition ? Math.ceil(this.userPosition * 1.2) : 0,
      isEligibleForReservation: this.reservationGranted,
      reservationToken: this.reservationToken,
      seatNumber: this.userSeatNumber,
      reservationExpiresAt: this.reservationExpiresAt
    };
  }

  public processCheckout(
    idempotencyKey: string,
    fullName: string,
    email: string
  ): CheckoutResponse {
    // Race condition / Idempotency handling:
    // If the client submits the same idempotencyKey, return the identical receipt immediately
    if (this.completedOrders.has(idempotencyKey)) {
      return this.completedOrders.get(idempotencyKey)!;
    }

    if (!this.reservationGranted || !this.userSeatNumber) {
      throw new Error('No valid reservation held');
    }

    if (this.reservationExpiresAt && Date.now() > this.reservationExpiresAt) {
      throw new Error('Reservation hold expired');
    }

    const orderId = `ord_${generateUUID().slice(0, 10)}`;
    const receipt: CheckoutResponse = {
      success: true,
      orderId,
      seatNumber: this.userSeatNumber,
      eventId: DROP_CONSTANTS.DEFAULT_EVENT_ID,
      buyerName: fullName,
      buyerEmail: email,
      purchasedAt: Date.now(),
      ticketHash: `sha256_${generateUUID().replace(/-/g, '')}`,
      amountCents: DROP_CONSTANTS.DEFAULT_PRICE_CENTS,
      currency: 'USD',
      status: 'COMPLETED'
    };

    this.completedOrders.set(idempotencyKey, receipt);
    return receipt;
  }

  public setAttack(type: AdversarialAttackType): void {
    this.activeAttack = type;
    if (type === 'SPEED_BOTS' || type === 'VOLUME_DDOS') {
      this.totalParticipants = 50000;
    } else {
      this.totalParticipants = 5000;
    }
  }

  public getMetrics(): AdversarialMetrics {
    const attackNames: Record<AdversarialAttackType, string> = {
      NONE: 'Normal Human Traffic (Baseline)',
      SPEED_BOTS: 'Flash Crowd 50,000 Speed Bots (Front-Run Attack)',
      VOLUME_DDOS: 'Volumetric HTTP Flood (100k req/s)',
      SYBIL_SWARM: 'Sybil Fingerprint Rotation Swarm',
      REPLAY_ATTACK: 'Cryptographic Nonce Replay Assault'
    };

    const totalAllocated = this.humanSeatsWon + this.botSeatsWon;
    const humanRatio = totalAllocated > 0 ? this.humanSeatsWon / totalAllocated : 1;
    // Fairness index: 1.0 is ideal equality for humans
    const gini = Number((0.92 + humanRatio * 0.07).toFixed(3));

    const lastPoint = this.telemetryHistory[this.telemetryHistory.length - 1];

    return {
      timestamp: Date.now(),
      attackType: this.activeAttack,
      activeAttackName: attackNames[this.activeAttack],
      totalSimulatedParticipants: this.totalParticipants,
      humanParticipants: this.activeAttack === 'NONE' ? 500 : 2500,
      botParticipants: this.activeAttack === 'NONE' ? 0 : this.totalParticipants - 2500,
      requestsPerSecond: lastPoint ? lastPoint.humanRequests + lastPoint.botRequests : 500,
      humanSeatsWon: this.humanSeatsWon,
      botSeatsWon: this.botSeatsWon,
      totalAllocatedSeats: totalAllocated,
      totalSeats: this.totalSeats,
      blockedByProofOfWork: this.blockedByPoW,
      blockedByRateLimit: this.blockedByRateLimit,
      blockedByIdempotency: this.completedOrders.size > 0 ? 12 : 0,
      fairnessGiniScore: Math.min(1.0, gini),
      avgHumanLatencyMs: lastPoint ? lastPoint.latencyMs : 18,
      avgBotLatencyMs: this.activeAttack === 'NONE' ? 0 : 380, // Bots delayed by PoW compute
      serverCpuLoadPct: lastPoint ? lastPoint.cpuLoadPct : 12,
      activeAttackerCostEstimateUsd: this.blockedByPoW * 0.00045 // Estimated compute energy wasted by bots
    };
  }

  public getTelemetryHistory(): TelemetryPoint[] {
    return [...this.telemetryHistory];
  }

  public resetSimulation(): void {
    this.phase = 'WAITING_ROOM';
    this.remainingSeats = this.totalSeats;
    this.humanSeatsWon = 0;
    this.botSeatsWon = 0;
    this.blockedByPoW = 0;
    this.blockedByRateLimit = 0;
    this.userPosition = null;
    this.reservationGranted = false;
    this.userSeatNumber = null;
    this.reservationToken = null;
    this.reservationExpiresAt = null;
    this.completedOrders.clear();
    this.initHistory();
    this.broadcast('DROP_STATUS', this.getDropConfig());
  }
}

export const fairDropSimulator = new SimulationEngine();
