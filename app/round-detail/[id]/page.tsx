
'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

// This wrapper extracts the id from the dynamic route and passes it as a query param
export default function RoundDetailDynamic() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => {
    const id = (params as { id?: string })?.id;
    if (id) {
      router.replace(`/round-detail?id=${id}`);
    }
  }, [params, router]);
  // Do not return anything (no null, no JSX)
}
