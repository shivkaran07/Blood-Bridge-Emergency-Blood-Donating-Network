import { InfoList, InfoPage, InfoSection } from '../../components/layout/InfoPage';
import { Alert } from '../../components/ui/Alert';

export function TermsPage() {
  return (
    <InfoPage
      eyebrow="Terms of use"
      title="Terms of use"
      description="The rules for using this educational prototype. They are written to match the behaviour actually implemented in the application."
    >
      <Alert variant="warning" title="Not a medical or emergency service">
        BloodBridge is not a hospital, blood bank, emergency dispatch service or medical adviser.
        It does not guarantee that blood is available or that a donor is eligible. For immediate
        danger, call your local emergency number and contact the hospital directly.
      </Alert>

      <InfoSection title="1. Educational prototype">
        <p>
          This application is built as a B.Tech project. It may be changed, reset or taken offline
          without notice. It must not be used as the sole coordination channel for a real medical
          emergency, and it must not be used with real patient information.
        </p>
      </InfoSection>

      <InfoSection title="2. Accounts and roles">
        <InfoList
          items={[
            'You must provide accurate account information and keep your credentials private.',
            'Registration can request Requester or Donor access only.',
            'Hospital verification requires an administrator-approved institutional application.',
            'Administrator access is provisioned only through the documented operator procedure.',
            'You must not attempt to access another user’s data, escalate your role or interfere with the service.',
          ]}
        />
        <p>
          Accounts may be suspended for misuse, false emergency requests or attempts to bypass
          authorization. A suspension is recorded and the user is notified in the application.
        </p>
      </InfoSection>

      <InfoSection title="3. Requests and donations">
        <InfoList
          items={[
            'A blood request must describe a genuine need and use a non-sensitive public message.',
            'A request is not verified until an approved hospital account records a decision.',
            'A donor offer is an expression of willingness, not a guarantee of eligibility or availability.',
            'Accepting an offer does not prove that blood was donated or that the request was fulfilled.',
            'Donors must follow hospital screening and eligibility procedures. BloodBridge does not assess medical suitability.',
            'You must not post patient names, private medical details or another person’s contact information in a public message.',
          ]}
        />
      </InfoSection>

      <InfoSection title="4. Verification claims">
        <p>
          A hospital review decision is recorded in the application database and must never be
          described as clinical proof. When the deployment enables the optional audit layer, an
          authorized verifier wallet may anchor an opaque audit key. Even then, the anchor proves
          only that a transaction was confirmed — it does not prove that blood is available,
          compatible or safe, and it never replaces clinical checks.
        </p>
      </InfoSection>

      <InfoSection title="5. Prohibited use">
        <InfoList
          items={[
            'Submitting fraudulent, duplicate or abusive emergency requests.',
            'Harvesting donor contact information or using it for unrelated purposes.',
            'Attempting privilege escalation, injection, denial of service or unauthorised access.',
            'Uploading malware or interfering with other users.',
            'Using the service for commercial blood trading or any activity prohibited by applicable law.',
          ]}
        />
      </InfoSection>

      <InfoSection title="6. Availability and liability">
        <p>
          The application is provided “as is” for educational use, without warranties of
          availability, accuracy or fitness for a particular purpose. To the extent permitted by
          law, the project authors are not liable for decisions made using this prototype. Clinical
          decisions remain with qualified professionals and the patient’s hospital.
        </p>
      </InfoSection>

      <InfoSection title="7. Privacy">
        <p>
          Data handling is described in the privacy notice. The notice explains what is stored, who
          can see it, and the consent rules for contact sharing. Read it before submitting personal
          information.
        </p>
      </InfoSection>

      <InfoSection title="8. Changes">
        <p>
          These terms may be updated as the project evolves. Enabling the audit layer requires
          additional terms covering wallet identity, transaction records and on-chain data
          visibility.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
