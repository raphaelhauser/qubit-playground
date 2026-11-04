import { ReactNode } from 'react';
import { ModuleShell, SubTabs } from '../../layout/ModuleShell';
import { navigate } from '../../layout/router';
import { HighlightProvider } from '../../components/Highlight';
import { Tex } from '../../components/Tex';
import { SeriesTab } from './SeriesTab';
import { DerivationTab } from './DerivationTab';
import { EigenTab } from './EigenTab';
import { GroupTab } from './GroupTab';
import { HoverFix } from '../hamiltonian/hoverFix';

type TabId = 'series' | 'derivation' | 'eigen' | 'group';

const TABS: { id: TabId; label: string }[] = [
  { id: 'series', label: 'Series explorer' },
  { id: 'derivation', label: 'Pauli rotations: the derivation' },
  { id: 'eigen', label: 'Eigenbasis & conjugation' },
  { id: 'group', label: 'Unitarity & continuous rotations' },
];

const TIPS: Record<string, string> = {
  SN: 'S_N — the partial sum of the first N terms of the exponential series.',
  n: 'n — unit rotation axis; n·σ = n₁X + n₂Y + n₃Z squares to the identity.',
};

/** Module D — matrix exponentials. Sub-views are addressable as #/exponential/<tab>. */
export default function ExponentialModule({ subpath }: { subpath: string }) {
  const tab: TabId = (TABS.find((t) => t.id === subpath)?.id ?? 'series') as TabId;
  const tabs = <SubTabs tabs={TABS} value={tab} onChange={(t) => navigate(`/exponential/${t}`)} />;
  const header = (viz: ReactNode, controls: ReactNode, panel: ReactNode) => (
    <ModuleShell
      letter="D"
      title="Matrix exponentials"
      intro={
        <p>
          <Tex>{'e^{A} = I + A + A^2/2! + \\cdots'}</Tex> turns a generator into a transformation. For anti-Hermitian <Tex>{'A = -iHt'}</Tex> it produces unitary evolution, and for{' '}
          <Tex>{'A = -i\\theta(\\vec n\\cdot\\vec\\sigma)/2'}</Tex> exactly the rotation <Tex>{'R_{\\vec n}(\\theta)'}</Tex>. Watch the series converge, then see why the result is a rotation.
        </p>
      }
      tabs={tabs}
      viz={viz}
      controls={controls}
      panel={panel}
    />
  );
  return (
    <HighlightProvider tips={TIPS}>
      <HoverFix>
        {tab === 'series' && <SeriesTab header={header} />}
        {tab === 'derivation' && <DerivationTab header={header} />}
        {tab === 'eigen' && <EigenTab header={header} />}
        {tab === 'group' && <GroupTab header={header} />}
      </HoverFix>
    </HighlightProvider>
  );
}
