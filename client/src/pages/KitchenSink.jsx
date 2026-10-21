import { useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Toggle } from '../components/ui/Toggle.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs.jsx';
import { useToast } from '../components/ui/Toast.jsx';

/**
 * /kitchen-sink — dev-only gallery (prompt.md §0, Phase 0).
 * Every component rendered in light AND dark side-by-side. Not shipped in
 * production builds (see App.jsx route guard).
 */

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-medium text-ink-primary">{title}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

function Column({ theme, idPrefix }) {
  const columnRef = useRef(null);
  const { push } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [tab, setTab] = useState('profile');

  return (
    <div
      ref={columnRef}
      data-theme={theme}
      className="rounded-card border border-line-strong bg-canvas p-6 text-ink-secondary shadow-sm"
    >
      <p className="mb-6 font-mono text-xs uppercase tracking-wider text-ink-muted">{theme} mode</p>

      <Section title="Buttons">
        <Button>Start review</Button>
        <Button variant="outline">Browse kanji</Button>
        <Button variant="ghost">Skip for now</Button>
        <Button disabled>Disabled</Button>
        <Button aria-label="Continue" variant="outline">
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
      </Section>

      <Section title="Rating buttons (SRS colors)">
        <Button variant="again">Again</Button>
        <Button variant="hard">Hard</Button>
        <Button variant="good">Good</Button>
        <Button variant="easy">Easy</Button>
      </Section>

      <Section title="Inputs">
        <div className="w-64">
          <Input
            id={`${idPrefix}-email`}
            name={`${idPrefix}-email`}
            label="Email"
            type="email"
            placeholder="you@example.com"
          />
        </div>
        <div className="w-64">
          <Input
            id={`${idPrefix}-email-error`}
            name={`${idPrefix}-email-error`}
            label="Email"
            type="email"
            defaultValue="not-an-email"
            error="Enter a valid email address."
          />
        </div>
      </Section>

      <Section title="Select">
        <div className="w-52">
          <Select
            id={`${idPrefix}-theme`}
            name={`${idPrefix}-theme`}
            label="Theme"
            defaultValue="auto"
            options={[
              { value: 'auto', label: 'Match system' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
      </Section>

      <Section title="Toggle">
        <div className="flex items-center justify-between gap-6 rounded-control border border-line-subtle bg-surface px-4 py-3">
          <span className="text-sm text-ink-primary">Sound effects</span>
          <Toggle checked={soundOn} onChange={setSoundOn} label="Sound effects" />
        </div>
      </Section>

      <Section title="Modal">
        <Button variant="outline" onClick={() => setModalOpen(true)}>
          Open modal
        </Button>
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          container={columnRef.current}
          title="Streak repair"
          description="Your 12-day streak ended yesterday. Repair for 100 coins?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>Repair for 100 coins</Button>
            </>
          }
        />
      </Section>

      <Section title="Toasts (render with page theme)">
        <Button variant="outline" onClick={() => push({ message: 'Saved', tone: 'success' })}>
          Show saved toast
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            push({
              message: 'Rated Good · 10 XP',
              tone: 'undo',
              action: { label: 'Undo', onClick: () => push({ message: 'Review undone' }) },
            })
          }
        >
          Show undo toast
        </Button>
      </Section>

      <Section title="Badges">
        <Badge>N5</Badge>
        <Badge variant="success">Mastered</Badge>
        <Badge variant="danger">Lapsed</Badge>
        <Badge variant="indigo">Learning</Badge>
      </Section>

      <Section title="Cards">
        <Card className="w-64">
          <p className="text-xs uppercase tracking-wider text-ink-muted">Daily goal</p>
          <p className="mt-1 font-mono text-lg text-ink-primary">50 / 100 XP</p>
        </Card>
      </Section>

      <Section title="Skeletons">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-20 w-full" />
      </Section>

      <Section title="Avatars">
        <Avatar size={32} name="Aurnob" />
        <Avatar size={28} name="Rina Kobayashi" />
        <Avatar size={128} name="Aurnob" />
      </Section>

      <div className="mb-8">
        <h2 className="mb-3 text-lg font-medium text-ink-primary">Empty state</h2>
        <EmptyState
          svgSize={140}
          headline="Your garden is empty"
          description="Start by adding kanji to your review queue. N5 takes about 3 weeks at 20 reviews per day."
          action={{ label: 'Browse N5 kanji', onClick: () => {} }}
        />
      </div>

      <div className="mb-2">
        <h2 className="mb-3 text-lg font-medium text-ink-primary">Tabs</h2>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <p className="text-sm text-ink-secondary">Panel content renders here.</p>
          </TabsContent>
          <TabsContent value="achievements">
            <p className="text-sm text-ink-secondary">Panel content renders here.</p>
          </TabsContent>
          <TabsContent value="settings">
            <p className="text-sm text-ink-secondary">Panel content renders here.</p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function KitchenSink() {
  return (
    <main id="main" className="mx-auto max-w-app px-4 py-8 md:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold text-ink-primary">Kitchen sink</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Dev only — every component in light and dark, side by side. Not shipped in production.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Column theme="light" idPrefix="l" />
        <Column theme="dark" idPrefix="d" />
      </div>
    </main>
  );
}
