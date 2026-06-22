import { createFileRoute, Link } from '@tanstack/react-router';
import { AppShell } from '@/components/AppShell';
import { Sun, Lock, Zap, ClipboardCheck, BarChart3, Users, Sparkles } from 'lucide-react';

export const Route = createFileRoute('/help')({
  head: () => ({ meta: [
    { title: 'How to use this - Gharpayy' },
    { name: 'description', content: 'Daily operating rhythm for HR, Flow Ops, TCM, and Owners.' },
  ] }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <AppShell>
      <div className="max-w-3xl space-y-8">
        <header>
          <h1 className="font-display text-3xl font-semibold tracking-tight">How to use this</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Three roles, three landing pages, one connected machine. Below is the daily rhythm - follow it and the system runs itself.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2"><Sun className="h-4 w-4 text-accent" /> Daily operating rhythm</h2>
          <ol className="space-y-3">
            <Step time="9:30 AM" title="Owners open the update window" link={{ to: '/property-owner/dashboard', label: 'Owner Portal' }}
              body="Each owner reviews properties, bookings, and approvals from the Owner Portal Dashboard." />
            <Step time="10:30 AM" title="Bookings review" body="Owners review pending booking approvals and manage their properties." />
            <Step time="11:00 AM" title="Owner approvals" link={{ to: '/property-owner/approvals', label: 'Pending Approvals' }}
              body="Owners approve/reject pending booking requests from the approvals panel." accent="danger" />
            <Step time="11 AM – 1 PM" title="Flow Ops activates new rooms" link={{ to: '/myt/flow-ops', label: 'Flow Ops' }}
              body="Every new room: 5 pitches or 2 qualified matches within 2 hours." />
            <Step time="1 PM – 7 PM" title="TCM runs visits" link={{ to: '/myt/tcm', label: 'TCM Desk' }}
              body="Each visit tied to a room_id. Post-visit report filed within 15 min - captures objection, budget gap, timeline." />
            <Step time="Anytime" title="Owners manage bookings" link={{ to: '/property-owner/bookings', label: 'Owner Bookings' }}
              body="Owners can view all bookings, track readiness, and manage the booking lifecycle from the owner portal." />
            <Step time="7 PM" title="HR reviews compliance + leaderboard" link={{ to: '/myt', label: 'HR Tower' }}
              body="Daily snapshot: pitches, visits, outcomes. Owner responsiveness badge. Lead routing throttled below 70 score." />
          </ol>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <RoleCard icon={Users} title="Flow Ops" to="/myt/flow-ops"
            body="Add leads, qualify, schedule tours, send confirmation messages. Activation Window enforced per room." />
          <RoleCard icon={ClipboardCheck} title="TCM" to="/myt/tcm"
            body="Run pre/in/post-visit checklist. File the Lead Intelligence Report within 15 min of tour end." />
          <RoleCard icon={BarChart3} title="HR / Leadership" to="/"
            body="Compliance dashboard, leaderboard, revenue, heatmap, revival queue, owner trust scores." />
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-info" /> One way to do things</h2>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>Same action menu (⋯) on every lead - same actions, same order, everywhere.</li>
            <li>Same card style across Tours, Properties, Owners, and Leads.</li>
            <li>Tour confirmation messages share one template library - no inconsistencies.</li>
            <li>Every action publishes to the closed-loop event bus → owner sees team activity, team sees owner updates.</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function Step({ time, title, body, link, accent }: {
  time: string; title: string; body: string; link?: { to: string; label: string }; accent?: 'danger';
}) {
  return (
    <li className={`rounded-lg border p-3 ${accent === 'danger' ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'}`}>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className={`text-xs font-mono ${accent === 'danger' ? 'text-destructive' : 'text-accent'}`}>{time}</span>
        <span className="font-medium text-sm">{title}</span>
        {link && <Link to={link.to as any} className="text-xs text-accent ml-auto">{link.label} →</Link>}
      </div>
      <div className="text-xs text-muted-foreground mt-1.5">{body}</div>
    </li>
  );
}

function RoleCard({ icon: Icon, title, body, to }: { icon: any; title: string; body: string; to: string }) {
  return (
    <Link to={to as any} className="rounded-xl border border-border bg-card p-4 hover:border-accent/50 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-accent" />
        <h3 className="font-display text-sm font-semibold">{title}</h3>
      </div>
      <div className="text-xs text-muted-foreground">{body}</div>
    </Link>
  );
}
