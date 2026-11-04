import { Tex } from '../../components/Tex';

/** Tagged templates so TeX can be written without double escaping: {M`e^{-iHt}`}, {D`…`} */
export const M = (s: TemplateStringsArray, ...v: unknown[]) => <Tex>{String.raw(s, ...v)}</Tex>;
export const D = (s: TemplateStringsArray, ...v: unknown[]) => <Tex display>{String.raw(s, ...v)}</Tex>;
