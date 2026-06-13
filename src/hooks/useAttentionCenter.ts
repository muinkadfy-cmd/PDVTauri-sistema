import { useEffect, useState } from 'react';
import { getAttentionSnapshot, subscribeAttentionChanges, type AttentionSnapshot } from '@/lib/attention-center';

export function useAttentionCenter(): AttentionSnapshot {
  const [snapshot, setSnapshot] = useState<AttentionSnapshot>(() => getAttentionSnapshot());

  useEffect(() => {
    const refresh = () => setSnapshot(getAttentionSnapshot());
    refresh();
    return subscribeAttentionChanges(refresh);
  }, []);

  return snapshot;
}
