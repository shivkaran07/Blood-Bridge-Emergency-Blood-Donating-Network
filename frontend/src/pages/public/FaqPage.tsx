import { Link } from 'react-router-dom';
import { ChevronDown, MessageCircleQuestion } from 'lucide-react';
import { InfoPage } from '../../components/layout/InfoPage';
import { Alert } from '../../components/ui/Alert';
import { buttonClasses } from '../../components/ui/Button';
import { emergencyNotice, matchingNotice } from '../../lib/constants';

const faqs: Array<{ question: string; answer: string }> = [
  {
    question: 'Is BloodBridge an emergency service?',
    answer:
      'No. It is a coordination prototype. For a life-threatening emergency, call your local emergency number and contact the hospital directly. BloodBridge does not dispatch ambulances, guarantee blood availability or provide medical advice.',
  },
  {
    question: 'Does a verified request guarantee that blood is available?',
    answer:
      'No. Verification records that an approved hospital account reviewed the request in this application. It does not prove stock levels, clinical compatibility or donor eligibility.',
  },
  {
    question: 'Does verification use the blockchain?',
    answer:
      'Not necessarily. Hospital review decisions are always recorded in the application database. Some deployments also enable an optional on-chain audit layer, where an authorized verifier wallet signs a transaction that anchors an opaque audit key. The Verification & audit page shows which mode is actually active. An on-chain anchor never proves medical facts, stock levels or compatibility.',
  },
  {
    question: 'How does donor matching work?',
    answer:
      'Matching uses exact equality of the recorded blood group, donor availability, consent to be contacted, request status and general location. When both sides have consented to share approximate coordinates, the backend can calculate a distance with the Haversine formula. Exact coordinates are never shown. This is not a medical compatibility engine.',
  },
  {
    question: 'When can someone see my phone number?',
    answer:
      'A donor phone number is revealed only to the requester or hospital when the donor consented to contact and the response is accepted or completed. A requester phone number is revealed to an accepted donor only when the requester opted in to contact sharing.',
  },
  {
    question: 'Who can verify a blood request?',
    answer:
      'Only an account with an approved hospital application. Hospital applicants submit institutional details, and an administrator must approve the application. Approval cannot be requested through registration or granted by the browser.',
  },
  {
    question: 'Can I become an administrator by registering?',
    answer:
      'No. Registration can only request Requester or Donor access. The HOSPITAL role is granted only after administrator approval. The ADMIN role must be provisioned through the documented development script, which the operator runs with database access.',
  },
  {
    question: 'What happens if a request is rejected?',
    answer:
      'The request retains its history and a review reason. It is no longer open to new donor offers. The requester receives an in-app notification with the recorded reason.',
  },
  {
    question: 'Does accepting a donor offer fulfil the request?',
    answer:
      'No. An accepted offer is a coordination acknowledgement. Only an authorized completion workflow can move a request to partially fulfilled or fulfilled. A response never proves that blood was donated.',
  },
  {
    question: 'Can I withdraw an offer?',
    answer:
      'Yes, while the offer is still in an eligible state. Withdrawal notifies the requester and is recorded in the audit trail. You remain in control of your availability and can update it at any time.',
  },
  {
    question: 'Are email or SMS notifications sent?',
    answer:
      'In-app notifications are stored in the database. No external email, SMS or push provider is configured, and the application does not claim that an external message was delivered.',
  },
  {
    question: 'What data is collected?',
    answer:
      'Account email, name, phone number, city and general area, optional postal code, blood group, availability and consent choices. The application deliberately avoids collecting unnecessary medical information. See the privacy page for details.',
  },
];

export function FaqPage() {
  return (
    <InfoPage
      eyebrow="FAQ"
      title="Frequently asked questions"
      description="Straight answers about what BloodBridge does, what it deliberately does not do, and how the verification mode is reported."
    >
      <div className="divide-y divide-ink-200 overflow-hidden rounded-xl border border-ink-200 bg-surface-raised">
        {faqs.map((faq) => (
          <details key={faq.question} className="group px-5 py-4 open:bg-ink-50/40">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink-900 marker:hidden">
              <span>{faq.question}</span>
              <ChevronDown
                className="size-4 shrink-0 text-ink-500 transition group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-600">{faq.answer}</p>
          </details>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Alert variant="warning" title="Emergency situations">
          {emergencyNotice}
        </Alert>
        <Alert variant="neutral" title="Matching scope">
          {matchingNotice}
        </Alert>
      </div>

      <div className="flex flex-col items-start gap-4 rounded-xl border border-ink-200 bg-surface-raised p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <MessageCircleQuestion className="mt-0.5 size-5 shrink-0 text-brand-accent" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Still have a question?</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              Review the workflow or privacy details. There is no live support desk in this
              prototype.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link to="/how-it-works" className={buttonClasses('secondary', 'sm')}>
            How it works
          </Link>
          <Link to="/privacy" className={buttonClasses('ghost', 'sm')}>
            Privacy
          </Link>
        </div>
      </div>
    </InfoPage>
  );
}
