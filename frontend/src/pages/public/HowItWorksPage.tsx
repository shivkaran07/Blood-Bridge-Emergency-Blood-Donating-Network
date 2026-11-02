import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Droplets,
  HeartHandshake,
  Lock,
  Search,
  ShieldCheck,
  Siren,
} from 'lucide-react';
import { InfoList, InfoPage, InfoSection } from '../../components/layout/InfoPage';
import { Card } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { buttonClasses } from '../../components/ui/Button';
import { emergencyNotice, matchingNotice } from '../../lib/constants';

const requestStates = [
  { label: 'Submitted', tone: 'info' as const, body: 'The requester submitted a request. It is not verified yet.' },
  { label: 'Under review', tone: 'warning' as const, body: 'An approved hospital verifier opened the request for review.' },
  { label: 'Verified', tone: 'success' as const, body: 'A hospital verifier recorded an approval in the application.' },
  { label: 'Fulfilled', tone: 'success' as const, body: 'An authorized participant recorded that the need was met.' },
];

export function HowItWorksPage() {
  return (
    <InfoPage
      eyebrow="How it works"
      title="From an urgent request to a recorded decision"
      description="BloodBridge coordinates people. It does not test blood or decide clinical compatibility. Every workflow below is recorded in the application database, with an honest boundary around what that means."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            icon: Siren,
            title: '1. Create a request',
            body: 'A requester records the blood group, units, hospital, required-by time and a non-sensitive public message. The request starts as SUBMITTED. It never starts verified.',
          },
          {
            icon: ClipboardCheck,
            title: '2. Hospital review',
            body: 'An approved hospital account reviews the request and records an approval or rejection with a reason. Each decision is written to the audit trail.',
          },
          {
            icon: Search,
            title: '3. Donors find verified needs',
            body: 'Available donors with the same recorded blood group see the verified request. Matching uses exact group, availability and general location only.',
          },
          {
            icon: HeartHandshake,
            title: '4. Coordinate with consent',
            body: 'A donor offers to help. The requester accepts or declines. Phone numbers are revealed only when consent and acceptance conditions are both met.',
          },
        ].map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.title}>
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-accent">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h2 className="mt-3 text-base font-semibold text-ink-900">{step.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{step.body}</p>
            </Card>
          );
        })}
      </div>

      <InfoSection title="The request lifecycle is enforced">
        <p>
          The backend applies one centralized transition table. A browser cannot promote a request
          to verified, and a donor accepting an offer does not mark the request fulfilled.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {requestStates.map((state) => (
            <div key={state.label} className="rounded-xl border border-ink-200 bg-surface-raised p-4">
              <Badge tone={state.tone} dot>
                {state.label}
              </Badge>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">{state.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-3">
          Requests can also be rejected, cancelled or expired where the transition rules permit it.
          Cancellations and rejections require a reason and notify the affected participants.
        </p>
      </InfoSection>

      <InfoSection title="What hospital verification means">
        <p>
          Verification is an application record that an approved hospital account reviewed a
          request. It is not a clinical clearance or proof that blood is available. Where an
          optional audit anchor is configured, the anchor proves only that a wallet transaction
          happened — never that the medical facts are true.
        </p>
        <InfoList
          items={[
            'The hospital must first apply with institutional details.',
            'Only an administrator can approve the application and grant the HOSPITAL role.',
            'The verifier decision stores the actor, outcome and reason.',
            'No transaction hash is fabricated when no anchor exists.',
            'The Verification & audit page reports the live mode and every recorded transaction.',
          ]}
        />
      </InfoSection>

      <InfoSection title="For donors">
        <InfoList
          items={[
            'A new donor profile starts neutral: not available, no contact sharing and no location until you choose each option.',
            'Availability, contact-sharing consent and optional approximate location are separate, reversible choices.',
            'Browse verified requests that match your exact recorded blood group.',
            'Offer, accept or decline opportunities, and withdraw an eligible offer.',
            'Your phone number and exact coordinates are never shown in public listings.',
          ]}
        />
      </InfoSection>

      <InfoSection title="For hospitals">
        <InfoList
          items={[
            'Submit an institutional application from your ordinary account.',
            'An administrator reviews the application and records a decision with a reason.',
            'Approved verifiers receive a pending review queue and review history.',
            'Approval grants access to the review queue only — never administrator access.',
          ]}
        />
      </InfoSection>

      <div className="grid gap-3 sm:grid-cols-2">
        <Alert variant="warning" title="Emergency care comes first">
          {emergencyNotice}
        </Alert>
        <Alert variant="neutral" title="Matching is not compatibility">
          {matchingNotice}
        </Alert>
      </div>

      <div className="rounded-xl border border-ink-200 bg-surface-raised p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <ShieldCheck className="size-4 text-accent-600" aria-hidden="true" />
          Privacy is part of the workflow
        </h2>
        <InfoList
          items={[
            'Request listings show the hospital location, not a patient identity or private contact.',
            'Donor listings show a general area and approximate distance when consent allows it.',
            <>
              <Lock className="mr-1 inline size-3.5" aria-hidden="true" /> Contact details require
              explicit consent and an accepted response.
            </>,
            'Audit metadata is deliberately non-sensitive and excludes tokens and passwords.',
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link to="/register" className={buttonClasses('primary', 'lg')}>
          Create an account
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Link to="/faq" className={buttonClasses('secondary', 'lg')}>
          Read the FAQ
        </Link>
        <Link to="/about" className={buttonClasses('ghost', 'lg')}>
          <Building2 className="size-4" aria-hidden="true" />
          About the project
        </Link>
        <Link to="/login" className={buttonClasses('ghost', 'lg')}>
          <Droplets className="size-4" aria-hidden="true" />
          Sign in
        </Link>
      </div>
    </InfoPage>
  );
}
