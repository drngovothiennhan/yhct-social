'use client';

import { useState, type FormEvent } from 'react';
import { LogIn, LogOut, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  createUserProfile,
  friendlyAuthError,
  loginWithEmail,
  loginWithGoogle,
  logout,
  registerWithEmail,
} from '@/lib/auth-service';
import type { AccountType } from '@/lib/types';
import { Avatar } from '@/components/common/avatar';

export function AuthCard() {
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <section className="card p-5" aria-busy="true">
        <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-10 animate-pulse rounded-xl bg-slate-100" />
      </section>
    );
  }

  if (user && !profile) {
    return (
      <OnboardingCard
        busy={busy}
        error={error ?? profileError}
        defaultName={user.displayName ?? ''}
        onSubmit={async (displayName, accountType) => {
          setBusy(true);
          setError(null);
          try {
            await createUserProfile(user, displayName, accountType);
            await refreshProfile();
          } catch (submitError) {
            setError(friendlyAuthError(submitError));
          } finally {
            setBusy(false);
          }
        }}
        onLogout={async () => {
          setBusy(true);
          try {
            await logout();
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }

  if (user && profile) {
    const verified = profile.verificationStatus === 'verified';
    return (
      <section className="card p-5">
        <div className="flex items-center gap-3">
          <Avatar name={profile.displayName} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-semibold text-slate-900">{profile.displayName}</p>
              {verified ? <ShieldCheck className="h-4 w-4 text-emerald-600" aria-label="Đã xác minh" /> : null}
            </div>
            <p className="text-sm text-slate-500">
              {profile.accountType === 'practitioner' ? 'Lương y / Bác sĩ YHCT' : 'Thành viên'}
            </p>
          </div>
        </div>

        {profile.accountType === 'practitioner' && !verified ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Trạng thái chứng chỉ: <strong>{verificationLabel(profile.verificationStatus)}</strong>.
            Nhãn chuyên môn sẽ mở sau khi được duyệt.
          </div>
        ) : null}

        <button
          className="btn-secondary mt-4 w-full"
          type="button"
          onClick={() => void logout()}
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </button>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <div className="mb-4">
        <p className="eyebrow">Tài khoản YHCT</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">
          {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
        </h2>
      </div>

      <button
        className="btn-secondary w-full"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await loginWithGoogle();
          } catch (loginError) {
            setError(friendlyAuthError(loginError));
          } finally {
            setBusy(false);
          }
        }}
      >
        <LogIn className="h-4 w-4" />
        Tiếp tục với Google
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" /> hoặc <div className="h-px flex-1 bg-slate-200" />
      </div>

      <EmailAuthForm
        mode={mode}
        busy={busy}
        error={error}
        onSubmit={async (values) => {
          setBusy(true);
          setError(null);
          try {
            if (mode === 'login') {
              await loginWithEmail(values.email, values.password);
            } else {
              await registerWithEmail({
                displayName: values.displayName,
                email: values.email,
                password: values.password,
                accountType: values.accountType,
              });
              await refreshProfile();
            }
          } catch (submitError) {
            setError(friendlyAuthError(submitError));
          } finally {
            setBusy(false);
          }
        }}
      />

      <button
        type="button"
        className="mt-4 w-full text-sm font-medium text-emerald-700 hover:text-emerald-800"
        onClick={() => {
          setError(null);
          setMode((current) => current === 'login' ? 'register' : 'login');
        }}
      >
        {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
      </button>
    </section>
  );
}

interface EmailValues {
  displayName: string;
  email: string;
  password: string;
  accountType: Extract<AccountType, 'member' | 'practitioner'>;
}

function EmailAuthForm({
  mode,
  busy,
  error,
  onSubmit,
}: {
  mode: 'login' | 'register';
  busy: boolean;
  error: string | null;
  onSubmit: (values: EmailValues) => Promise<void>;
}) {
  const [values, setValues] = useState<EmailValues>({
    displayName: '',
    email: '',
    password: '',
    accountType: 'member',
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(values);
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      {mode === 'register' ? (
        <>
          <label className="field-label">
            Tên hiển thị
            <input
              className="field-input"
              value={values.displayName}
              maxLength={80}
              required
              autoComplete="name"
              onChange={(event) => setValues({ ...values, displayName: event.target.value })}
            />
          </label>
          <label className="field-label">
            Loại tài khoản
            <select
              className="field-input"
              value={values.accountType}
              onChange={(event) => setValues({
                ...values,
                accountType: event.target.value as EmailValues['accountType'],
              })}
            >
              <option value="member">Thành viên</option>
              <option value="practitioner">Lương y / Bác sĩ YHCT</option>
            </select>
          </label>
        </>
      ) : null}

      <label className="field-label">
        {mode === 'login' ? 'MSSV hoặc email' : 'Email'}
        <input
          className="field-input"
          type={mode === 'login' ? 'text' : 'email'}
          autoComplete={mode === 'login' ? 'username' : 'email'}
          inputMode={mode === 'login' ? 'email' : undefined}
          required
          value={values.email}
          onChange={(event) => setValues({ ...values, email: event.target.value })}
        />
      </label>

      <label className="field-label">
        Mật khẩu
        <input
          className="field-input"
          type="password"
          minLength={mode === 'register' ? 8 : undefined}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          required
          value={values.password}
          onChange={(event) => setValues({ ...values, password: event.target.value })}
        />
      </label>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <button className="btn-primary w-full" type="submit" disabled={busy}>
        {mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserRoundPlus className="h-4 w-4" />}
        {busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
      </button>
    </form>
  );
}

function OnboardingCard({
  defaultName,
  busy,
  error,
  onSubmit,
  onLogout,
}: {
  defaultName: string;
  busy: boolean;
  error: string | null;
  onSubmit: (displayName: string, accountType: 'member' | 'practitioner') => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(defaultName);
  const [accountType, setAccountType] = useState<'member' | 'practitioner'>('member');

  return (
    <section className="card p-5">
      <p className="eyebrow">Bước cuối</p>
      <h2 className="mt-1 text-lg font-bold text-slate-900">Chọn hồ sơ tham gia</h2>
      <p className="mt-2 text-sm text-slate-600">
        Tài khoản Google đã xác thực. Chọn loại hồ sơ để tạo dữ liệu Firestore an toàn.
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(displayName, accountType);
        }}
      >
        <label className="field-label">
          Tên hiển thị
          <input
            className="field-input"
            value={displayName}
            maxLength={80}
            required
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label className="field-label">
          Tôi tham gia với tư cách
          <select
            className="field-input"
            value={accountType}
            onChange={(event) => setAccountType(event.target.value as typeof accountType)}
          >
            <option value="member">Thành viên</option>
            <option value="practitioner">Lương y / Bác sĩ YHCT</option>
          </select>
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          Hoàn tất hồ sơ
        </button>
      </form>

      <button className="mt-3 w-full text-sm text-slate-500 hover:text-slate-700" type="button" onClick={() => void onLogout()}>
        Đăng xuất tài khoản này
      </button>
    </section>
  );
}

function verificationLabel(status: string): string {
  const labels: Record<string, string> = {
    unsubmitted: 'chưa gửi chứng chỉ',
    pending: 'đang chờ duyệt',
    rejected: 'cần bổ sung hồ sơ',
    verified: 'đã xác minh',
    not_required: 'không yêu cầu',
  };
  return labels[status] ?? status;
}
