import { Loader } from './ui';

/** Kept for existing imports; renders the shared loader. */
export default function BrandLoader({ label = 'Loading' }) {
  return <Loader label={label} />;
}
