import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState.jsx';

/** / — Phase 1 shows the spec's empty-garden state (§7.1); the full dashboard
 *  (streak card, goal ring, XP bar, due card) lands in Phase 4. */
export default function Dashboard() {
  const navigate = useNavigate();
  return (
    <EmptyState
      headline="Your garden is empty"
      description="Start by adding kanji to your review queue. N5 takes about 3 weeks at 20 reviews per day."
      action={{ label: 'Browse N5 kanji', onClick: () => navigate('/learn') }}
    />
  );
}
