import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  HeartHandshake,
  Lock,
  MapPin,
  Search,
  ShieldCheck,
  Siren,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { buttonClasses } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { BloodGroupMark } from '../../components/requests/RequestCard';
import { emergencyNotice, matchingNotice } from '../../lib/constants';

const steps = [
  {
    icon: Siren,
    title: 'Submit a request',
    body: 'A requester records the blood group, units, hospital, deadline and contact consent. Requests start as submitted — never as verified.',
  },
  {
    icon: ClipboardCheck,
    title: 'Hospital review',
    body: 'An approved hospital verifier reviews the request in the application. A database-backed decision moves it to verified or rejected.',
  },
  {
    icon: Search,
    title: 'Donors see verified needs',
    body: 'Available donors with the exact recorded blood group can find open requests, filter by city and offer to help.',
  },
  {
    icon: HeartHandshake,
    title: 'Coordinate safely',
    body: 'The requester accepts or declines offers. Contact details are shared only with consent and only after acceptance.',
  },
];

const roles = [
  {
    icon: Siren,
    title: 'Requester',
    body: 'Create and track an emergency request, review donor offers, record completion and cancel when blood is no longer needed.',
    points: ['Guided request form', 'Offer decisions', 'Status history'],
    accent: 'bg-brand-50 text-brand-700 border-brand-200',
  },
  {
    icon: Droplets,
    title: 'Donor',
    body: 'Set your blood group and availability, browse verified requests near you and offer to donate. Withdraw at any time before acceptance.',
    points: ['Availability toggle', 'Exact-group feed', 'Privacy-first contact'],
    accent: 'bg-accent-50 text-accent-700 border-accent-200',
  },
  {
    icon: Building2,
    title: 'Hospital verifier',
    body: 'Apply with institutional details. Once approved by an administrator, review requests and record database verification decisions.',
    points: ['Verification queue', 'Review history', 'Audit trail'],
    accent: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    icon: ShieldCheck,
    title: 'Administrator',
    body: 'Approve hospital applications, manage account status and inspect requests, suspicious patterns and the full audit log.',
    points: ['Hospital approvals', 'User controls', 'Operational audit'],
    accent: 'bg-ink-100 text-ink-700 border-ink-200',
  },
];

export function LandingPage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink-200">
        <div className="hero-grid absolute inset-0 -z-10" aria-hidden="true" />
        <div className="absolute -right-24 -top-24 -z-10 size-[28rem] rounded-full bg-brand-100/60 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-40 -left-24 -z-10 size-[24rem] rounded-full bg-accent-100/50 blur-3xl" aria-hidden="true" />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-xs font-semibold text-brand-800 shadow-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-brand-500" />
                <span className="relative inline-flex size-2 rounded-full bg-brand-700" />
              </span>
              Part 1 · Database-backed hospital verification
            </div>

            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-ink-950 sm:text-5xl lg:text-[3.4rem]">
              When minutes matter,
              <span className="block text-brand-700">nearby donors should know.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-600 sm:text-lg">
              BloodBridge connects requesters, donors and hospital verifiers in one
              coordinated network. Verified requests only, exact blood-group matching,
              and contact details shared only with consent.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/register" className={buttonClasses('primary', 'lg')}>
                Create an account
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link to="/login" className={buttonClasses('secondary', 'lg')}>
                Sign in
              </Link>
            </div>

            <ul className="mt-8 grid gap-2.5 text-sm text-ink-600 sm:grid-cols-3">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
                Hospital-verified requests
              </li>
              <li className="flex items-start gap-2">
                <Lock className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
                Consent-based contact
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
                Full audit history
              </li>
            </ul>
          </div>

          <div className="relative animate-fade-up [animation-delay:120ms]">
            <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-200/60 via-white to-accent-100/60 blur-xl" aria-hidden="true" />
            <div className="rounded-[1.75rem] border border-ink-200 bg-white p-5 shadow-lift sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                  Example verified request
                </p>
                <Badge tone="success" dot>
                  Verified
                </Badge>
              </div>

              <div className="mt-4 flex items-start gap-4">
                <BloodGroupMark group="O−" size="lg" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-ink-900">2 units of O− blood</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    City General Hospital · Central district
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="danger">Critical priority</Badge>
                    <Badge tone="outline">Needed within 4 hours</Badge>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { label: 'Offers', value: '3' },
                  { label: 'Accepted', value: '1' },
                  { label: 'Review', value: 'Verified' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-ink-50 px-3 py-2.5">
                    <p className="text-[0.68rem] font-medium uppercase tracking-wide text-ink-400">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-ink-900">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-xs font-medium text-accent-900">
                  <UserRoundCheck className="size-4 shrink-0" aria-hidden="true" />
                  Database verified by an approved hospital reviewer
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs text-ink-500">
                  <Lock className="size-4 shrink-0" aria-hidden="true" />
                  Requester phone visible to accepted donors only
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-ink-400">
              Illustrative interface sample — not live platform data.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-ink-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:px-6 md:grid-cols-2">
          <Link
            to="/register?type=REQUESTER"
            className="group flex items-start gap-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-5 transition hover:border-brand-300 hover:bg-brand-50"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
              <Siren className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-base font-semibold text-ink-900">
                Request blood
                <ArrowRight className="size-4 text-brand-700 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-600">
                Create a requester account, submit a hospital request and track its review and
                donor offers.
              </span>
            </span>
          </Link>
          <Link
            to="/register?type=DONOR"
            className="group flex items-start gap-4 rounded-2xl border border-accent-200 bg-accent-50/50 p-5 transition hover:border-accent-300 hover:bg-accent-50"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-700 text-white">
              <Droplets className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-base font-semibold text-ink-900">
                Become a donor
                <ArrowRight className="size-4 text-accent-700 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-600">
                Record your blood group and availability, then see verified requests for your exact
                group.
              </span>
            </span>
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-18">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
              How it works
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              A clear path from urgent need to coordinated response
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-500 sm:text-base">
              Every state change is recorded. Requests are never silently promoted, and
              donor responses never pretend to be medical proof.
            </p>
          </div>

          <ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="relative rounded-2xl border border-ink-200 bg-surface p-5 transition hover:border-brand-200 hover:shadow-card"
                >
                  <span className="absolute right-4 top-4 text-3xl font-bold text-ink-200/80">
                    0{index + 1}
                  </span>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-ink-900">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section id="roles" className="scroll-mt-24 border-b border-ink-200">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-18">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
                Built for every role
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
                One network, four distinct responsibilities
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-ink-500">
              Privileges are stored server-side and cannot be granted through registration
              or browser calls.
            </p>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-2">
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <article
                  key={role.title}
                  className="flex gap-4 rounded-2xl border border-ink-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${role.accent}`}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-ink-900">{role.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{role.body}</p>
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {role.points.map((point) => (
                        <li
                          key={point}
                          className="rounded-full border border-ink-200 bg-ink-50 px-2.5 py-0.5 text-[0.7rem] font-medium text-ink-600"
                        >
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="trust" className="scroll-mt-24 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-18">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
                Trust & safety
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
                Honest about what this system does — and does not do
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-500">
                BloodBridge is coordination software. It does not test blood, determine
                medical compatibility or replace hospital procedures.
              </p>

              <div className="mt-6 space-y-3">
                <Alert variant="warning" title="Emergency care comes first">
                  {emergencyNotice}
                </Alert>
                <Alert variant="neutral" title="Exact-group matching only">
                  {matchingNotice}
                </Alert>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Lock,
                  title: 'Contact privacy',
                  body: 'Donor phone numbers are hidden in listings. Requesters and hospital verifiers see a donor phone only when the donor consented and the offer was accepted.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Server-enforced roles',
                  body: 'Roles live in the database. Registration can request Requester or Donor; hospital verification is granted only after administrator approval.',
                },
                {
                  icon: ClipboardCheck,
                  title: 'Central status rules',
                  body: 'Request and response transitions are validated in one place. Invalid jumps are rejected and every change is recorded in history.',
                },
                {
                  icon: Users,
                  title: 'Audit trail',
                  body: 'Creation, review decisions, responses, completions, cancellations and account actions produce audit events for accountability.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-ink-200 bg-surface p-5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-white text-brand-700 shadow-sm">
                      <Icon className="size-4.5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-3 text-sm font-semibold text-ink-900">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-ink-300 bg-ink-950 p-6 text-white sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">
                  Part 2 roadmap
                </p>
                <h3 className="mt-2 text-xl font-semibold">Blockchain anchoring is prepared, not active</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">
                  Part 1 already stores opaque audit keys and synchronization states. No smart
                  contract is deployed, no wallet is connected and no transaction is created.
                  The interface is ready for a real verifier-anchored audit trail in Part 2.
                </p>
              </div>
              <div className="shrink-0">
                <Badge tone="outline" className="border-white/30 text-white">
                  Verification mode: database
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-ink-200 bg-gradient-to-br from-brand-50 via-white to-accent-50">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
              Ready to help someone nearby?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-600">
              Create a requester or donor account. Hospital verifiers apply through the
              same account and are approved by an administrator.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/register" className={buttonClasses('primary', 'lg')}>
              Get started
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link to="/login" className={buttonClasses('secondary', 'lg')}>
              I already have an account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
