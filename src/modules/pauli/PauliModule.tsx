import { useState } from 'react';
import { ModuleShell, SubTabs } from '../../layout/ModuleShell';
import { HighlightProvider } from '../../components/Highlight';
import { Tex } from '../../components/Tex';
import { WorkspaceViz, WorkspaceControls, WorkspacePanel, useWorkspace, useConjugationTween } from './Workspace';
import { RotationOrderViz, RotationOrderControls, RotationOrderPanel, useRotationOrder } from './RotationOrder';
import { HadamardViz, HadamardControls, HadamardPanel, useHadamardConj } from './HadamardConj';

type Tab = 'workspace' | 'order' | 'hadamard';

const TIPS: Record<string, string> = {
  A: 'A — the first matrix. As a unitary it is a rotation of the Bloch sphere.',
  B: 'B — the second matrix. As a Hermitian operator it has an axis b with B = b·σ.',
  conj: 'A B A† — B seen in the frame rotated by A: its axis is rotated by A.',
};

const TAB_FROM_PATH: Record<string, Tab> = { order: 'order', hadamard: 'hadamard', workspace: 'workspace' };

function PauliInner({ subpath }: { subpath: string }) {
  const [tab, setTab] = useState<Tab>(TAB_FROM_PATH[subpath] ?? 'workspace');
  const ws = useWorkspace();
  const conjTween = useConjugationTween();
  const ro = useRotationOrder();
  const hc = useHadamardConj();

  const tabs = (
    <SubTabs
      value={tab}
      onChange={setTab}
      tabs={[
        { id: 'workspace', label: 'Products, commutators & conjugation' },
        { id: 'order', label: 'Does rotation order matter?' },
        { id: 'hadamard', label: 'Hadamard conjugation' },
      ]}
    />
  );

  let viz, controls, panel;
  if (tab === 'workspace') {
    viz = <WorkspaceViz a={ws.a} b={ws.b} progress={conjTween.progress} />;
    controls = (
      <WorkspaceControls
        a={ws.a}
        setA={(v) => { conjTween.finish(); ws.setA(v); }}
        b={ws.b}
        setB={(v) => { conjTween.finish(); ws.setB(v); }}
        onAnimate={() => conjTween.start(1800)}
        running={conjTween.running}
      />
    );
    panel = <WorkspacePanel a={ws.a} b={ws.b} />;
  } else if (tab === 'order') {
    viz = <RotationOrderViz ro={ro} />;
    controls = <RotationOrderControls ro={ro} />;
    panel = <RotationOrderPanel ro={ro} />;
  } else {
    viz = <HadamardViz hc={hc} />;
    controls = <HadamardControls hc={hc} />;
    panel = <HadamardPanel hc={hc} />;
  }

  return (
    <ModuleShell
      letter="E"
      title="Pauli algebra"
      intro={
        <p>
          The Pauli matrices square to the identity, anticommute pairwise, and multiply cyclically: <Tex>{'XY = iZ'}</Tex>, <Tex>{'YZ = iX'}</Tex>, <Tex>{'ZX = iY'}</Tex>. Each identity
          has a geometric twin on the Bloch sphere: commuting means “same axis”, anticommuting means “a half-turn about one reverses the other”, and conjugation rotates axes.
        </p>
      }
      tabs={tabs}
      viz={viz}
      controls={controls}
      panel={panel}
    />
  );
}

export default function PauliModule({ subpath }: { subpath: string }) {
  return (
    <HighlightProvider tips={TIPS}>
      <PauliInner subpath={subpath} />
    </HighlightProvider>
  );
}
