import { notFound } from 'next/navigation';
import { getShotWithImages, countRunningJobs } from '@/lib/db';
import { ShotDetailClient } from '@/components/ShotDetailClient';

export const dynamic = 'force-dynamic';

export default async function ShotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shot = await getShotWithImages(id);
  if (!shot) notFound();
  const runningJobs = await countRunningJobs(id);
  return <ShotDetailClient initial={shot} initialRunningJobs={runningJobs} />;
}
