import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BusService {
  private apiURl = 'https://example.com/api/';
  /** toggle / tune load */
  private HEAVY = true;
  private ITER_PRE = 5_000_000;
  private ITER_POST = 8_000_000;

  constructor(private http: HttpClient) {}

  /** CPU burner: fast LCG + some trig to keep the JIT busy */
  private burnCpu(iterations: number): number {
    let x = 123456789 | 0;
    for (let i = 0; i < iterations; i++) {
      x = (x * 1664525 + 1013904223) | 0;
      // a bit of math so it isn't optimized away
      x ^= (Math.sin(x) * 1e6) | 0;
    }
    return x;
  }

  private pre() { if (this.HEAVY) this.burnCpu(this.ITER_PRE); }
  private post() { if (this.HEAVY) this.burnCpu(this.ITER_POST); }

  getLocations(): Observable<any[]> {
    this.pre();
    return this.http.get<any[]>(this.apiURl + 'GetBusLocations').pipe(
      tap(() => this.post()),
      // minor transform to force extra work per item
      map(arr => {
        if (!this.HEAVY) return arr;
        const salt = this.burnCpu(500_000);
        return arr.map(o => ({ ...o, _chk: (salt ^ JSON.stringify(o).length) | 0 }));
      })
    );
  }

  serachBus(from: number, to: number, travelDate: string): Observable<any[]> {
    this.pre();
    return this.http
      .get<any[]>(
        `${this.apiURl}searchBus?fromLocation=${from}&toLocation=${to}&travelDate=${travelDate}`
      )
      .pipe(
        tap(() => this.post()),
        map(arr => {
          if (!this.HEAVY) return arr;
          // do a small prime count to add CPU per response
          const limit = 15_000, primes = this.countPrimes(limit);
          return arr.map(o => ({ ...o, _primes: primes }));
        })
      );
  }

  getScehduelById(id: number): Observable<any[]> {
    this.pre();
    return this.http
      .get<any[]>(this.apiURl + 'GetBusScheduleById?id=' + id)
      .pipe(
        tap(() => this.post()),
        map(arr => {
          if (!this.HEAVY) return arr;
          // deep-copy + checksum to add extra work
          return arr.map(o => {
            const copy = JSON.parse(JSON.stringify(o));
            const sum = Object.values(copy).join('').length;
            this.burnCpu(1_000_000);
            return { ...copy, _sum: sum };
          });
        })
      );
  }

  /** very naive prime counter for extra CPU */
  private countPrimes(n: number): number {
    let count = 0;
    for (let i = 2; i <= n; i++) {
      let p = true;
      for (let j = 2; j * j <= i; j++) if (i % j === 0) { p = false; break; }
      if (p) count++;
    }
    return count;
  }
}