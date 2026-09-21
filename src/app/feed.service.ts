import { Injectable, signal } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { retry, tap } from 'rxjs/operators';
import { DeskMessage, FxRate, Kpis, Tick } from './models';

const VISIBLE = 48;
const FRESH_MS = 850;

@Injectable({ providedIn: 'root' })
export class FeedService {
  readonly ticks = signal<Tick[]>([]);
  readonly kpis = signal<Kpis | null>(null);
  readonly rates = signal<FxRate[]>([]);
  readonly tps = signal(0);
  readonly live = signal(false);
  readonly paused = signal(false);
  readonly freshIds = signal<Set<string>>(new Set());

  connect() {
    this.socket$()
      .pipe(
        retry({ delay: () => timer(1200) }),
        tap((message) => this.apply(message)),
      )
      .subscribe();
  }

  togglePause() {
    this.paused.update((value) => !value);
  }

  isFresh(id: string) {
    return this.freshIds().has(id);
  }

  private socket$() {
    return new Observable<DeskMessage>((subscriber) => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${location.host}/ws`);
      socket.onopen = () => this.live.set(true);
      socket.onmessage = (event) => {
        subscriber.next(JSON.parse(event.data) as DeskMessage);
      };
      socket.onerror = () => undefined;
      socket.onclose = () => {
        this.live.set(false);
        subscriber.error(new Error('ws-close'));
      };
      return () => socket.close();
    });
  }

  private apply(message: DeskMessage) {
    this.kpis.set(message.kpis);
    this.rates.set(message.rates);
    this.tps.set(message.tps);
    if (this.paused() && message.type === 'batch') {
      return;
    }
    if (message.type === 'hello') {
      this.ticks.set(message.rows.slice(-VISIBLE).reverse());
      return;
    }
    const incoming = message.rows;
    this.ticks.update((current) => [...incoming].reverse().concat(current).slice(0, VISIBLE));
    const next = new Set(this.freshIds());
    for (const row of incoming) {
      next.add(row.id);
    }
    this.freshIds.set(next);
    window.setTimeout(() => {
      this.freshIds.update((set) => {
        const copy = new Set(set);
        for (const row of incoming) {
          copy.delete(row.id);
        }
        return copy;
      });
    }, FRESH_MS);
  }
}
