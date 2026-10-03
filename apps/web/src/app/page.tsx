'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { WaitingRoomCard } from '../components/WaitingRoomCard';
import { QueueProgressCard } from '../components/QueueProgressCard';
import { ReservationCheckoutModal } from '../components/ReservationCheckoutModal';
import { OrderConfirmationCard } from '../components/OrderConfirmationCard';
import { BotLabDashboard } from '../components/BotLabDashboard';
import { SessionManager, UserSessionState } from '../lib/session';
import { apiClient } from '../lib/api-client';
import { runClientPoW, PoWSolveProgress } from '../lib/pow-solver';
import {
  EventConfig,
  QueueStatus,
  ReservationGrant,
  CheckoutResponse,
  DropPhase,
  DROP_CONSTANTS
} from '@fairdrop/shared';
import { fairDropSimulator } from '../lib/simulation-engine';

export default function FairDropPage() {
  const [session, setSession] = useState<UserSessionState | null>(null);
  const [config, setConfig] = useState<EventConfig>(() =>
    fairDropSimulator.getDropConfig()
  );
  const [queueStatus, setQueueStatus] = useState<QueueStatus>(() =>
    fairDropSimulator.getQueueStatus('initial-client')
  );
  const [activeView, setActiveView] = useState<'waiting_room' | 'botlab'>('waiting_room');
  const [isSolvingPoW, setIsSolvingPoW] = useState(false);
  const [powProgress, setPowProgress] = useState<PoWSolveProgress | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSSEConnected, setIsSSEConnected] = useState(true);

  // Initialize session from localStorage
  useEffect(() => {
    const loaded = SessionManager.load(DROP_CONSTANTS.DEFAULT_EVENT_ID);
    setSession(loaded);

    // If session already holds an active reservation that hasn't expired, open checkout modal
    if (
      loaded.reservationToken &&
      loaded.reservationExpiresAt &&
      loaded.reservationExpiresAt > Date.now() &&
      !loaded.receipt
    ) {
      setIsCheckoutOpen(true);
    }
  }, []);

  // Subscribe to SSE realtime events
  useEffect(() => {
    if (!session) return;

    const unsub = apiClient.subscribeSSE(
      session.eventId,
      session.clientId,
      (type, data) => {
        setIsSSEConnected(true);
        if (type === 'DROP_STATUS') {
          setConfig(data as EventConfig);
        } else if (type === 'QUEUE_UPDATE') {
          const qs = data as QueueStatus;
          setQueueStatus(qs);
          if (qs.position !== null) {
            setSession((prev) => {
              if (!prev) return prev;
              const next = SessionManager.update(prev, {
                queuePosition: qs.position,
                totalInQueue: qs.totalInQueue
              });
              return next;
            });
          }
        } else if (type === 'RESERVATION_GRANTED') {
          const grant = data as ReservationGrant;
          setSession((prev) => {
            if (!prev) return prev;
            const next = SessionManager.update(prev, {
              reservationToken: grant.reservationToken,
              seatNumber: grant.seatNumber,
              reservationExpiresAt: grant.expiresAt
            });
            return next;
          });
          setIsCheckoutOpen(true);
        } else if (type === 'SEATS_SOLD_OUT') {
          setConfig((prev) => ({ ...prev, currentPhase: 'SOLD_OUT', remainingSeats: 0 }));
        }
      },
      () => {
        setIsSSEConnected(false);
      }
    );

    return unsub;
  }, [session?.clientId, session?.eventId]);

  // Handle entering waiting room with Proof of Work
  const handleJoinWaitingRoom = async () => {
    if (!session || isSolvingPoW) return;

    try {
      setIsSolvingPoW(true);
      // 1. Fetch PoW challenge
      const challenge = await apiClient.getPoWChallenge(session.eventId);

      // 2. Solve PoW in client browser thread
      const solution = await runClientPoW(challenge, (progress) => {
        setPowProgress(progress);
      });

      // 3. Submit solution to join waiting room
      const res = await apiClient.joinWaitingRoom({
        eventId: session.eventId,
        clientId: session.clientId,
        fingerprint: session.fingerprint,
        solution
      });

      // 4. Update session
      const updated = SessionManager.update(session, {
        joinedWaitingRoomAt: res.joinedAt,
        powSolution: solution,
        totalInQueue: res.waitingRoomTotal
      });
      setSession(updated);
    } catch (err) {
      console.error('Failed to join waiting room:', err);
    } finally {
      setIsSolvingPoW(false);
    }
  };

  // Trigger drop shuffle
  const handleTriggerShuffle = () => {
    fairDropSimulator.triggerShuffle();
  };

  // Fast forward to user turn (for testing/demo)
  const handleSimulateTurn = () => {
    if (!session) return;
    const grant = fairDropSimulator.triggerDirectGrant(session.clientId);
    const updated = SessionManager.update(session, {
      reservationToken: grant.reservationToken,
      seatNumber: grant.seatNumber,
      reservationExpiresAt: grant.expiresAt,
      queuePosition: 0
    });
    setSession(updated);
    setIsCheckoutOpen(true);
  };

  // Handle successful checkout
  const handleCheckoutSuccess = (receipt: CheckoutResponse) => {
    if (!session) return;
    setIsCheckoutOpen(false);
    const updated = SessionManager.update(session, {
      receipt,
      reservationToken: null,
      reservationExpiresAt: null
    });
    setSession(updated);
  };

  // Handle reservation hold expiration
  const handleReservationExpire = () => {
    setIsCheckoutOpen(false);
    if (!session) return;
    const updated = SessionManager.update(session, {
      reservationToken: null,
      seatNumber: null,
      reservationExpiresAt: null
    });
    setSession(updated);
  };

  // Reset entire session
  const handleResetSession = useCallback(() => {
    const fresh = SessionManager.reset(DROP_CONSTANTS.DEFAULT_EVENT_ID);
    fairDropSimulator.resetSimulation();
    setSession(fresh);
    setIsCheckoutOpen(false);
    setPowProgress(null);
    setConfig(fairDropSimulator.getDropConfig());
    setQueueStatus(fairDropSimulator.getQueueStatus(fresh.clientId));
  }, []);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white font-mono text-xs">
        Initializing FairDrop Secure Session...
      </div>
    );
  }

  const hasPurchased = session.receipt !== null;
  const isQueueActive = config.currentPhase === 'ACTIVE';

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white">
      {/* Navigation */}
      <Navbar
        phase={config.currentPhase}
        remainingSeats={config.remainingSeats}
        totalSeats={config.totalSeats}
        activeView={activeView}
        onViewChange={setActiveView}
        onResetSession={handleResetSession}
        isSSEConnected={isSSEConnected}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeView === 'botlab' ? (
          <BotLabDashboard />
        ) : (
          <div className="space-y-8">
            {hasPurchased && session.receipt ? (
              <OrderConfirmationCard
                receipt={session.receipt}
                onViewBotLab={() => setActiveView('botlab')}
                onReset={handleResetSession}
              />
            ) : isQueueActive && session.joinedWaitingRoomAt ? (
              <QueueProgressCard
                status={queueStatus}
                onSimulateTurn={handleSimulateTurn}
              />
            ) : (
              <WaitingRoomCard
                config={config}
                phase={config.currentPhase}
                hasJoined={session.joinedWaitingRoomAt !== null}
                isJoining={isSolvingPoW}
                powSolution={session.powSolution}
                powProgress={powProgress}
                onJoin={handleJoinWaitingRoom}
                onTriggerShuffle={handleTriggerShuffle}
              />
            )}
          </div>
        )}
      </main>

      {/* 120s Guaranteed Hold Checkout Modal */}
      {isCheckoutOpen && session.seatNumber && session.reservationToken && (
        <ReservationCheckoutModal
          isOpen={isCheckoutOpen}
          seatNumber={session.seatNumber}
          reservationToken={session.reservationToken}
          expiresAt={session.reservationExpiresAt || Date.now() + 120000}
          idempotencyKey={session.idempotencyKey}
          priceCents={config.priceCents}
          currency={config.currency}
          onSuccess={handleCheckoutSuccess}
          onExpire={handleReservationExpire}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 px-4 text-center text-xs text-zinc-500 font-mono">
        FairDrop &bull; Cryptographically Fair High-Demand Allocation &bull; Hackathon M2 Frontend &bull; Node 20 / Next.js 14 / TypeScript
      </footer>
    </div>
  );
}
