import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { supabase } from './supabase-client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private loggedIn$ = new BehaviorSubject<boolean>(false);
  /** Reactive auth state for the UI (nav, logout button, etc.). */
  readonly isLoggedIn$ = this.loggedIn$.asObservable();

  constructor() {
    // Restore any persisted session on load, then track changes.
    void supabase.auth.getSession().then(({ data }) =>
      this.loggedIn$.next(!!data.session),
    );
    supabase.auth.onAuthStateChange((_event, session) =>
      this.loggedIn$.next(!!session),
    );
  }

  /** Authoritative session check (used by the route guard). */
  async checkSession(): Promise<boolean> {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  }

  /** Signs in against Supabase Auth. Returns an error message, or null on success. */
  async login(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return error ? error.message : null;
  }

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  }
}
