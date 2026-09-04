'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import { SocialPostCard } from '@/components/portal/social-post-card';
import { loadActivities, loadActivity, loadActivityRelatedPosts, type ActivityRecord } from '@/lib/activity-service';
import type { SocialPostRecord } from '@/lib/types';

function formatDate(activity: ActivityRecord) {
  const date = activity.startAt?.toDate?.();
  return date ? date.toLocaleString('vi-VN') : 'Thời gian sẽ cập nhật';
}

export function ActivitiesScreen() {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadActivities().then((result) => { if (active) setActivities(result); }).catch((next: unknown) => {
      if (active) setError(next instanceof Error ? next.message : 'Không thể tải hoạt động.');
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><CalendarDays className="h-6 w-6 text-emerald-700" /><div><h1 className="text-xl font-bold text-slate-950">Hoạt động CLB</h1><p className="text-sm text-slate-500">Lịch sinh hoạt, chương trình chuyên môn và tin hoạt động đã công bố.</p></div></div>
      </section>
      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {activities.length === 0 && !error ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Chưa có hoạt động đã công bố.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {activities.map((activity) => (
          <Link key={activity.id} href={`/activities/${activity.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
            {activity.coverImageURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activity.coverImageURL} alt="" className="h-40 w-full object-cover" />
            ) : <div className="h-28 bg-gradient-to-br from-emerald-100 to-teal-50" />}
            <div className="p-5">
              <h2 className="font-bold text-slate-950">{activity.title}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{activity.description || 'Thông tin hoạt động CLB.'}</p>
              <div className="mt-4 space-y-1 text-xs text-slate-500"><p>{formatDate(activity)}</p>{activity.location ? <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{activity.location}</p> : null}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ActivityDetailScreen({ activityId }: { activityId: string }) {
  const [activity, setActivity] = useState<ActivityRecord | null>(null);
  const [posts, setPosts] = useState<SocialPostRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([loadActivity(activityId), loadActivityRelatedPosts(activityId)])
      .then(([record, related]) => { if (active) { setActivity(record); setPosts(related); } })
      .catch((next: unknown) => { if (active) setError(next instanceof Error ? next.message : 'Không thể tải hoạt động.'); });
    return () => { active = false; };
  }, [activityId]);

  if (error) return <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>;
  if (!activity) return <p className="text-sm text-slate-500">Đang tải hoạt động…</p>;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {activity.coverImageURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activity.coverImageURL} alt="" className="max-h-[420px] w-full object-cover" />
        ) : null}
        <div className="p-6"><h1 className="text-2xl font-bold text-slate-950">{activity.title}</h1><p className="mt-2 text-sm text-slate-500">{formatDate(activity)}{activity.location ? ` · ${activity.location}` : ''}</p>{activity.description ? <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{activity.description}</p> : null}</div>
      </section>
      <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-500">Cập nhật liên quan</h2>
      {posts.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Chưa có bài cập nhật liên quan.</p> : posts.map((post) => <SocialPostCard key={post.id} post={post} />)}
    </div>
  );
}
