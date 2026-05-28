import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-screen">
      <div class="login-card">
        <!-- Product Team -->
        <section class="panel panel-team">
          <div class="panel-eyebrow">Product Team</div>
          <h1>Sign in</h1>
          <p class="panel-sub">Enter your team credentials to continue.</p>

          <form (ngSubmit)="submit()">
            <label for="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autocomplete="username"
              [(ngModel)]="email"
              (input)="error = ''"
              autofocus
            />

            <label for="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="current-password"
              [(ngModel)]="password"
              (input)="error = ''"
            />

            <div class="login-error" *ngIf="error">{{ error }}</div>

            <button class="login-btn" type="submit" [disabled]="busy">
              {{ busy ? 'Signing in…' : 'Sign in' }}
            </button>
          </form>
        </section>

        <div class="panel-divider"></div>

        <!-- Stakeholders -->
        <section class="panel panel-stakeholders">
          <div class="panel-eyebrow">Stakeholders</div>
          <h1>View the roadmap</h1>
          <p class="panel-sub">
            See what the Product team is building — no sign-in needed. Read-only.
          </p>

          <a class="view-btn" routerLink="/roadmap">View roadmap →</a>
          <a class="view-btn secondary" routerLink="/next">What's coming next →</a>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .login-screen {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f4f4f5;
        padding: 24px;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .login-card {
        width: 100%;
        max-width: 720px;
        background: #fff;
        border: 1px solid #e4e4e7;
        border-radius: 14px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.06);
        display: flex;
        align-items: stretch;
        overflow: hidden;
      }
      .panel {
        flex: 1;
        padding: 40px 36px;
        display: flex;
        flex-direction: column;
      }
      .panel-stakeholders {
        background: #fafafa;
      }
      .panel-divider {
        width: 1px;
        background: #e4e4e7;
        flex-shrink: 0;
      }
      .panel-eyebrow {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #9ca3af;
        margin-bottom: 12px;
      }
      h1 {
        font-size: 22px;
        font-weight: 700;
        color: #18181b;
        margin: 0 0 4px;
      }
      .panel-sub {
        font-size: 13px;
        color: #71717a;
        margin: 0 0 24px;
        line-height: 1.5;
      }
      form {
        display: flex;
        flex-direction: column;
      }
      label {
        font-size: 12px;
        font-weight: 600;
        color: #3f3f46;
        margin-bottom: 6px;
      }
      input {
        font-size: 14px;
        padding: 10px 12px;
        border: 1px solid #d4d4d8;
        border-radius: 8px;
        margin-bottom: 16px;
        outline: none;
        transition: border-color 0.15s;
      }
      input:focus {
        border-color: #6366f1;
      }
      .login-error {
        font-size: 13px;
        color: #dc2626;
        margin: -4px 0 16px;
      }
      .login-btn {
        margin-top: 4px;
        padding: 11px;
        border: none;
        border-radius: 8px;
        background: #18181b;
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
      }
      .login-btn:hover {
        background: #000;
      }
      .login-btn:disabled {
        opacity: 0.6;
        cursor: default;
        background: #18181b;
      }
      .view-btn {
        margin-top: auto;
        display: block;
        text-align: center;
        padding: 11px;
        border: 1px solid #d4d4d8;
        border-radius: 8px;
        background: #fff;
        color: #3f3f46;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        transition: border-color 0.15s, color 0.15s;
      }
      .view-btn:hover {
        border-color: #a1a1aa;
        color: #18181b;
      }
      .view-btn.secondary {
        margin-top: 8px;
        background: transparent;
        border-color: #e4e4e7;
        color: #71717a;
        font-weight: 500;
      }
      .view-btn.secondary:hover {
        border-color: #a1a1aa;
        color: #18181b;
      }
      @media (max-width: 640px) {
        .login-card {
          flex-direction: column;
          max-width: 380px;
        }
        .panel-divider {
          width: auto;
          height: 1px;
        }
        .view-btn {
          margin-top: 8px;
        }
      }
    `,
  ],
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';
  busy = false;

  constructor(private auth: AuthService, private router: Router) {}

  async submit(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    const errorMessage = await this.auth.login(this.email, this.password);
    this.busy = false;
    if (errorMessage) {
      this.error = 'Incorrect email or password.';
    } else {
      await this.router.navigateByUrl('/roadmap-editor');
    }
  }
}
