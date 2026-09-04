'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Search, UserRound } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { SocialPostCard } from '@/components/portal/social-post-card';
import {
  filterMemberDirectory,
  loadMemberDirectory,
  loadMemberProfile,
  updateSelfProfile,
} from '@/lib/member-service';
import { loadFeedPage } from '@/lib/post-service';
import type { SocialPostRecord, UserProfile } from '@/lib/types';

function MemberIdentity({ member }: { member: UserProfile }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-100 font-bold text-emerald-800">
        {member.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.photoURL} alt="" className="h-full w-full object-cover" />
        ) : member.displayName.slice(0, 1).toLocaleUpperCase('vi')}
      </div>
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-900">{member.displayName}</p>
        <p className="truncate text-xs text-slate-500">{member.clubTitle || member.professionalTitle || 'Thành viên CLB'}</p>
      </div>
    </div>
  );
}

export function MemberDirectoryScreen() {
  const { user, claims } = useAuth();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !claims?.clubMember) { setLoading(false); return; }
    let active = true;
    void loadMemberDirectory().then((result) => { if (active) setMembers(result); }).catch((next: unknown) => {
      if (active) setError(next instanceof Error ? next.message : 'Không thể tải danh sách thành viên.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, claims?.clubMember]);

  const visible = useMemo(() => filterMemberDirectory(members, term), [members, term]);

  if (!user || !claims?.clubMember) return <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Danh bạ chỉ dành cho thành viên CLB đã xác thực.</section>;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-slate-950">Danh bạ thành viên</h1>
        <p className="mt-1 text-sm text-slate-500">Chỉ hiển thị thông tin hồ sơ CLB an toàn, không chứa dữ liệu truy cập riêng tư.</p>
        <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Tìm theo tên, chức danh hoặc MSSV" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
      </section>
      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Đang tải thành viên…</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((member) => (
          <Link key={member.uid} href={`/members/${member.uid}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
            <MemberIdentity member={member} />
            {member.bio ? <p className="mt-3 line-clamp-2 text-sm text-slate-600">{member.bio}</p> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function MemberProfileScreen({ uid }: { uid: string }) {
  const { user, claims } = useAuth();
  const [member, setMember] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<SocialPostRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !claims?.clubMember) return;
    let active = true;
    void Promise.all([loadMemberProfile(uid), loadFeedPage({ authorId: uid, pageSize: 10 })])
      .then(([profile, page]) => { if (active) { setMember(profile); setPosts(page.posts); } })
      .catch((next: unknown) => { if (active) setError(next instanceof Error ? next.message : 'Không thể tải hồ sơ.'); });
    return () => { active = false; };
  }, [uid, user, claims?.clubMember]);

  if (!user || !claims?.clubMember) return <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Hồ sơ thành viên yêu cầu đăng nhập CLB.</section>;
  if (error) return <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>;
  if (!member) return <p className="text-sm text-slate-500">Đang tải hồ sơ…</p>;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <MemberIdentity member={member} />
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">{member.role}</span>
          {member.memberCode ? <span className="rounded-full bg-slate-100 px-3 py-1">MSSV {member.memberCode}</span> : null}
        </div>
        {member.bio ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{member.bio}</p> : null}
        {member.specialties?.length ? <p className="mt-3 text-xs text-slate-500">Chuyên môn: {member.specialties.join(' · ')}</p> : null}
      </section>
      <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-500">Bài viết gần đây</h2>
      {posts.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Chưa có bài viết.</p> : posts.map((post) => <SocialPostCard key={post.id} post={post} />)}
    </div>
  );
}

export function ProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName);
    setPhotoURL(profile.photoURL);
    setBio(profile.bio);
    setSpecialties(profile.specialties.join(', '));
  }, [profile]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setMessage(null);
    try {
      await updateSelfProfile(user.uid, {
        displayName,
        photoURL,
        bio,
        specialties: specialties.split(',').map((item) => item.trim()).filter(Boolean),
      });
      await refreshProfile();
      setMessage('Đã cập nhật hồ sơ.');
    } catch (next) {
      setMessage(next instanceof Error ? next.message : 'Không thể cập nhật hồ sơ.');
    } finally {
      setBusy(false);
    }
  }

  if (!user || !profile) return <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Đăng nhập để chỉnh sửa hồ sơ.</section>;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3"><UserRound className="h-6 w-6 text-emerald-700" /><div><h1 className="text-xl font-bold text-slate-950">Hồ sơ của tôi</h1><p className="text-xs text-slate-500">Vai trò, MSSV và trạng thái tài khoản do hệ thống quản trị kiểm soát.</p></div></div>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-slate-700">Tên hiển thị<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" required /></label>
        <label className="block text-sm font-semibold text-slate-700">Ảnh đại diện (URL)<input value={photoURL} onChange={(event) => setPhotoURL(event.target.value)} maxLength={500} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label>
        <label className="block text-sm font-semibold text-slate-700">Giới thiệu<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={500} rows={4} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label>
        <label className="block text-sm font-semibold text-slate-700">Chuyên môn (phân cách bằng dấu phẩy)<input value={specialties} onChange={(event) => setSpecialties(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label>
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Chức danh CLB: <strong>{profile.clubTitle || 'Thành viên'}</strong> · Vai trò: <strong>{profile.role}</strong>{profile.memberCode ? ` · MSSV: ${profile.memberCode}` : ''}</div>
        <button type="submit" disabled={busy} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
        {message ? <p role="status" className="text-sm text-slate-600">{message}</p> : null}
      </form>
    </section>
  );
}
