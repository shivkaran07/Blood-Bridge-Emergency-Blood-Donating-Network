import { Link } from 'react-router-dom';
import { Boxes, Database, GraduationCap, Layers, ShieldCheck, Waypoints } from 'lucide-react';
import { InfoList, InfoPage, InfoSection } from '../../components/layout/InfoPage';
import { Card } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { buttonClasses } from '../../components/ui/Button';

export function AboutPage() {
  return (
    <InfoPage
      eyebrow="About the project"
      title="A coordination layer, built honestly"
      description="BloodBridge is a B.Tech project exploring how a trustworthy emergency blood network could work. Part 1 delivers the working application foundation. Part 2 will add the real smart-contract layer."
    >
      <InfoSection title="Why this exists">
        <p>
          Finding a matching donor during an emergency often depends on phone chains and informal
          messages. That can be slow and exposes personal contact details widely. BloodBridge
          organizes the same coordination into explicit roles, recorded decisions and consent-based
          contact sharing.
        </p>
        <p>
          The project is deliberately cautious about its claims. It does not guarantee that blood
          is available, it does not assess medical eligibility, and it does not replace a hospital.
        </p>
      </InfoSection>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Layers,
            title: 'Role separation',
            body: 'Requesters, donors, hospital verifiers and administrators have distinct permissions enforced by the API.',
          },
          {
            icon: Database,
            title: 'Database-backed verification',
            body: 'Verification decisions, responses and audit events are stored in PostgreSQL with constraints and RLS.',
          },
          {
            icon: Boxes,
            title: 'Prepared for Part 2',
            body: 'Audit keys, synchronization states and a transaction table exist now. No fake on-chain records are created.',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <span className="flex size-10 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h2 className="mt-3 text-sm font-semibold text-ink-900">{item.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{item.body}</p>
            </Card>
          );
        })}
      </div>

      <InfoSection title="How the system is structured">
        <InfoList
          items={[
            'A React + Vite frontend provides public pages, authenticated dashboards and role-aware navigation.',
            'An Express + TypeScript REST API under /api/v1 enforces authentication, validation and authorization.',
            'Supabase Auth issues sessions. The backend verifies tokens before any protected operation.',
            'Supabase PostgreSQL stores application data. Row Level Security restricts direct browser access.',
            'A version-controlled SQL migration creates the schema and policies reproducibly.',
          ]}
        />
      </InfoSection>

      <InfoSection title="Part 1 and Part 2">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-accent-200 bg-accent-50/40">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <ShieldCheck className="size-4 text-accent-700" aria-hidden="true" />
              Available now
            </h3>
            <InfoList
              items={[
                'Registration, sign-in and profiles.',
                'Donor profiles, availability and consent.',
                'Emergency requests with validated lifecycle rules.',
                'Exact-group matching and donor responses.',
                'Hospital applications and review queue.',
                'Administrator controls, notifications and audit log.',
              ]}
            />
          </Card>
          <Card>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Waypoints className="size-4 text-ink-500" aria-hidden="true" />
              Part 2 scope
            </h3>
            <InfoList
              items={[
                'Solidity contract with OpenZeppelin access control.',
                'Hardhat local network and optional Sepolia deployment.',
                'Wallet challenge and MetaMask connection for verifiers.',
                'Real transaction submission, confirmation and failure handling.',
                'A clearly separate on-chain verification state.',
              ]}
            />
          </Card>
        </div>
      </InfoSection>

      <InfoSection title="Project context">
        <div className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-4">
          <GraduationCap className="mt-0.5 size-5 shrink-0 text-ink-400" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-ink-600">
            This is an educational B.Tech prototype. It uses synthetic development data in tests and
            must not be used with real patient information. Any real deployment would require
            clinical governance, data-protection review, operational agreements with hospitals and a
            security assessment.
          </p>
        </div>
      </InfoSection>

      <Alert variant="neutral" title="No fabricated statistics">
        This site does not display invented donor counts, success rates or hospital partnerships.
        Dashboard figures come from the live database for the signed-in account.
      </Alert>

      <div className="flex flex-wrap gap-3">
        <Link to="/how-it-works" className={buttonClasses('primary', 'md')}>
          See how it works
        </Link>
        <Link to="/register" className={buttonClasses('secondary', 'md')}>
          Create an account
        </Link>
      </div>
    </InfoPage>
  );
}
