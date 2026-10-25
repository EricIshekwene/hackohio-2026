import { useEffect, useState } from 'react';
import type { StandardizedMedicationInput } from '@shared/types';
import { ProgressList, Shell, type StepInfo } from '@/components/app-shell';

export function Checking({ step, input }: { step: StepInfo; input: StandardizedMedicationInput }) {
  const reg = input.fields.nafdacRegNo?.value;
  const items = [
    reg ? `Looking up ${reg} in the NAFDAC Greenbook` : 'Looking for a registration number',
    'Checking NAFDAC public alerts',
    'Comparing the pack with the record',
  ];
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (active >= items.length - 1) return;
    const t = setTimeout(() => setActive((a) => a + 1), 450);
    return () => clearTimeout(t);
  }, [active, items.length]);

  return (
    <Shell step={step} title="Checking with NAFDAC" description="This uses NAFDAC's own registry snapshot and alerts. It takes a second.">
      <div className="pt-4" aria-busy="true">
        <ProgressList items={items} active={active} />
      </div>
    </Shell>
  );
}
