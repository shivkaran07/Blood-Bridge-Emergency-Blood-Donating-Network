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
    body: 'An approved hospital verifier reviews the request in the application. A recorded decision moves it to verified or rejected, with the actor and reason kept in the audit trail.',
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
    accent: 'bg-brand-50 text-brand-accent border-brand-200',
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
      <section className="landing-hero relative isolate overflow-hidden border-b border-ink-200">
        <div className="blueprint-grid pointer-events-none absolute inset-0 -z-0 opacity-60" aria-hidden="true" />
        <div className="absolute -right-24 -top-24 -z-10 size-[26rem] rounded-full bg-brand-100/50 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-40 -left-24 -z-10 size-[22rem] rounded-full bg-accent-100/40 blur-3xl" aria-hidden="true" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-24">
          <div className="relative z-10 animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-surface-raised/85 px-3.5 py-1.5 text-[0.6875rem] font-semibold text-brand-accent shadow-[0_6px_20px_-12px_rgb(135_29_61/0.5)] backdrop-blur">
              <span className="size-2 rounded-full bg-brand-600 ring-4 ring-brand-100/80" aria-hidden="true" />
              Hospital-review workflow · recorded audit
            </div>

            <h1 className="type-display mt-5 text-[2.55rem] text-ink-950 sm:mt-6 sm:text-[3.35rem] lg:text-[4rem]">
              Every connection
              <span className="mt-1 block text-gradient-brand">can make a difference.</span>
            </h1>

            <p className="mt-4 max-w-xl text-[1rem] leading-relaxed text-ink-600 sm:mt-5 sm:text-[1.0625rem]">
              BloodBridge connects requesters, donors and hospital verifiers in one
              coordinated network. Verified requests only, exact blood-group matching,
              and contact details shared only with consent.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
              <Link to="/register?type=REQUESTER" className={buttonClasses('primary', 'lg')}>
                Request blood
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link to="/register?type=DONOR" className={buttonClasses('secondary', 'lg')}>
                Become a donor
              </Link>
            </div>

            <ul className="mt-7 grid grid-cols-2 gap-x-3 gap-y-2.5 text-[0.75rem] text-ink-600 sm:mt-9 sm:grid-cols-3 sm:gap-3 sm:text-[0.8125rem]">
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

          <div className="relative z-10 animate-fade-up [animation-delay:120ms]">
            <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-300/35 via-surface-raised/70 to-accent-200/30 blur-2xl" aria-hidden="true" />
            <div className="hero-orbit pointer-events-none absolute -right-7 -top-9 -z-10 hidden size-52 rounded-full border lg:block" aria-hidden="true">
              <span className="absolute left-[18%] top-[24%] size-3 rounded-full bg-brand-400 ring-4 ring-brand-100/70" />
              <span className="absolute bottom-[18%] right-[22%] size-2.5 rounded-full bg-accent-500 ring-4 ring-accent-100/80" />
            </div>
            <div className="hero-workflow-card rounded-[1.4rem] border bg-surface-raised/95 p-5 backdrop-blur sm:rounded-[1.75rem] sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-ink-500">
                  <span className="size-1.5 rounded-full bg-brand-600 shadow-[0_0_0_3px_var(--color-brand-100)]" aria-hidden="true" />
                  Illustrative workflow
                </p>
                <Badge tone="outline">
                  Example only
                </Badge>
              </div>

              <div className="mt-4 flex items-start gap-4">
                <BloodGroupMark group="O−" size="lg" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold tracking-[-0.015em] text-ink-900">
                    2 units of O− blood
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    City General Hospital · Central district
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="danger">Critical priority</Badge>
                    <Badge tone="outline">Hospital reviewed</Badge>
                  </div>
                </div>
              </div>

              <ol className="mt-5 space-y-0">
                {[
                  {
                    icon: ClipboardCheck,
                    title: 'Hospital review recorded',
                    copy: 'An approved verifier records the decision, actor and reason.',
                  },
                  {
                    icon: Users,
                    title: 'Donors see the verified need',
                    copy: 'Only exact recorded blood-group matches can offer to help.',
                  },
                  {
                    icon: Lock,
                    title: 'Contact stays protected',
                    copy: 'Phone details are shared only with consent after acceptance.',
                  },
                ].map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
                      {index < 2 ? (
                        <span className="absolute left-[0.6875rem] top-7 h-[calc(100%-1.25rem)] w-px bg-ink-200" aria-hidden="true" />
                      ) : null}
                      <span className={`relative flex size-7 shrink-0 items-center justify-center rounded-full border ${
                        index === 0
                          ? 'border-brand-200 bg-brand-50 text-brand-accent'
                          : index === 1
                            ? 'border-accent-200 bg-accent-50 text-accent-700'
                            : 'border-ink-200 bg-ink-50 text-ink-600'
                      }`}>
                        <Icon className="size-3" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.75rem] font-semibold text-ink-900">{step.title}</span>
                        <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-ink-500">{step.copy}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 flex items-start gap-1.5 border-t border-ink-100 pt-3 text-[0.6875rem] leading-relaxed text-ink-500">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-ink-300" aria-hidden="true" />
                Illustrative interface sample — not live platform data.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-ink-200 bg-surface-raised/70">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-7 sm:px-6 md:grid-cols-2">
          <Link
            to="/register?type=REQUESTER"
            className="interactive-surface group flex items-start gap-4 rounded-2xl border border-brand-200/80 bg-brand-50/45 p-5 shadow-card hover:border-brand-300 hover:bg-brand-50 sm:p-6"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
              <Siren className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-base font-semibold text-ink-900">
                Request blood
                <ArrowRight className="size-4 text-brand-accent transition group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-600">
                Create a requester account, submit a hospital request and track its review and
                donor offers.
              </span>
            </span>
          </Link>
          <Link
            to="/register?type=DONOR"
            className="interactive-surface group flex items-start gap-4 rounded-2xl border border-accent-200/80 bg-accent-50/45 p-5 shadow-card hover:border-accent-300 hover:bg-accent-50 sm:p-6"
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

      <section id="how-it-works" className="scroll-mt-24 border-b border-ink-200 bg-surface-raised">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-18">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">
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

          <ol className="motion-stagger mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="interactive-surface relative rounded-2xl border border-ink-200/90 bg-surface p-5 shadow-card hover:border-brand-200"
                >
                  <span aria-hidden="true" className="absolute right-4 top-4 text-3xl font-bold text-ink-500">
                    0{index + 1}
                  </span>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-surface-raised text-brand-accent shadow-sm">
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">
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

          <div className="motion-stagger mt-9 grid gap-4 md:grid-cols-2">
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <article
                  key={role.title}
                  className="interactive-surface flex gap-4 rounded-2xl border border-ink-200 bg-surface-raised p-5 shadow-card"
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

      <section id="trust" className="scroll-mt-24 bg-surface-raised">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-18">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">
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
                  <div key={item.title} className="rounded-xl border border-ink-200 bg-surface p-5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-surface-raised text-brand-accent shadow-sm">
                      <Icon className="size-4.5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-3 text-sm font-semibold text-ink-900">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10 rounded-xl border border-ink-300 bg-inverse p-6 text-white sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">
                  Two trust layers, one boundary
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  Hospital review is recorded first. Anchoring is optional and never medical proof.
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  The application database is the source of truth for every review decision. When a
                  deployment enables the audit layer, an approved verifier may additionally sign a
                  wallet transaction that anchors an opaque audit key. That anchor proves a
                  transaction happened — it does not test blood, confirm compatibility or replace
                  hospital procedures.
                </p>
              </div>
              <div className="shrink-0">
                <Badge tone="outline" className="border-white/30 text-white">
                  Mode shown live in your workspace
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-ink-200 bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="brand-surface relative isolate overflow-hidden rounded-2xl p-6 shadow-hero sm:p-9">
            <div className="blueprint-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
            <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h2 className="type-title text-2xl text-white">
                  Ready to help someone nearby?
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
                  Create a requester or donor account. Hospital verifiers apply through the
                  same account and are approved by an administrator.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/register"
                  className={buttonClasses('inverse', 'lg')}
                >
                  Get started
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex h-12 min-h-12 items-center justify-center rounded-lg border border-white/25 bg-white/[0.06] px-6 text-[0.9375rem] font-semibold text-white transition hover:border-white/40 hover:bg-white/[0.12]"
                >
                  I already have an account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
