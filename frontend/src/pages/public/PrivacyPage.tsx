import { InfoList, InfoPage, InfoSection } from '../../components/layout/InfoPage';
import { Alert } from '../../components/ui/Alert';

export function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Privacy"
      title="Privacy notice"
      description="What BloodBridge stores, who can see it, and the controls that limit exposure. This notice describes an educational prototype; it is not a legal compliance certification."
    >
      <Alert variant="info" title="Prototype scope">
        This is an educational application. Do not enter real patient information, real medical
        records or another person's private details.
      </Alert>

      <InfoSection title="Information we store">
        <InfoList
          items={[
            'Account email and authentication identifiers managed by Supabase Auth. Passwords are never stored in application tables.',
            'Profile details you provide: full name, phone number, city, general area and optional postal code.',
            'Donor details: blood group, availability, contact-sharing consent, and optional approximate coordinates when you choose to provide them.',
            'Blood requests: blood group, units, hospital name, hospital city and area, required-by time, priority and a non-sensitive public message.',
            'Donor responses and their status history.',
            'Hospital application details: institutional name, registration number, contact person, phone, official email and address.',
            'In-app notifications and non-sensitive audit events.',
          ]}
        />
      </InfoSection>

      <InfoSection title="How information is used">
        <p>
          Data is used only to operate the coordination workflows: matching donors to verified
          requests, recording review decisions, showing authorized participants the information
          they need, and maintaining an accountability trail.
        </p>
        <p>
          The application does not run advertising, sell data or use third-party analytics. It does
          not send external email, SMS or push notifications.
        </p>
      </InfoSection>

      <InfoSection title="Who can see what">
        <InfoList
          items={[
            'Public pages show no user records, donor lists or live request data.',
            'Request feeds show hospital location, blood group, units, priority and the public message. They do not show the requester phone number.',
            'Donor listings show blood group, availability, general area and an approximate distance where consent allows. Exact coordinates and phone numbers are excluded.',
            'A donor phone number is revealed only when the donor consented to contact and the response is accepted or completed.',
            'A requester phone number is revealed to an accepted donor only when the requester consented to contact sharing.',
            'Hospital institutional details are visible to the applicant and to administrators reviewing the application.',
            'Audit events are visible to the acting participant where appropriate and to administrators; they contain no tokens or passwords.',
          ]}
        />
      </InfoSection>

      <InfoSection title="Security controls">
        <InfoList
          items={[
            'Row Level Security is enabled on application tables so direct browser access is restricted independently of the UI.',
            'The Express API re-checks authentication, role and ownership for every protected operation.',
            'Database queries are parameterized to prevent SQL injection.',
            'Secrets such as the Supabase service-role key remain server-side and are never placed in VITE_ variables.',
            'Authentication tokens are not written to logs. Structured logging avoids sensitive fields.',
            'Rate limiting reduces automated request submission and authentication abuse.',
          ]}
        />
      </InfoSection>

      <InfoSection title="Your choices">
        <InfoList
          items={[
            'You can update your profile and donor details, including availability and contact-sharing consent, from the workspace.',
            'You can withdraw an eligible donor offer.',
            'You control whether approximate coordinates are supplied. They are optional.',
            'You can mark your own notifications as read.',
          ]}
        />
        <p>
          This prototype includes a self-service JSON export from the profile page. It does not
          include self-service account deletion. In a real deployment, the operator would need a
          documented process for access, correction and deletion requests. Contact the project
          operator for this prototype.
        </p>
      </InfoSection>

      <InfoSection title="Retention and audit">
        <p>
          Audit events and hospital verification decisions are retained rather than overwritten so
          that decisions remain traceable. Cancelled or rejected requests keep their history. The
          audit log deliberately excludes secrets and unnecessary personal information.
        </p>
      </InfoSection>

      <InfoSection title="External services">
        <p>
          Authentication and database hosting are provided by a Supabase project that you configure.
          Review the Supabase privacy and security documentation for that project. The application
          does not call a paid mapping API; distance calculation happens on the backend from
          coordinates you choose to provide.
        </p>
      </InfoSection>

      <Alert variant="warning" title="Medical and emergency boundary">
        BloodBridge does not provide medical advice, determine donor eligibility or guarantee blood
        availability. For immediate danger, contact your local emergency number and the hospital
        directly.
      </Alert>
    </InfoPage>
  );
}
