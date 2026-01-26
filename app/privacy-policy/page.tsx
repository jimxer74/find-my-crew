import { Header } from '@/app/components/Header';
import { Footer } from '@/app/components/Footer';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | SailSmart',
  description: 'Privacy Policy for SailSmart - Learn how we collect, use, and protect your personal data.',
};

type Props = {
  searchParams: Promise<{ standalone?: string }>;
};

export default async function PrivacyPolicyPage({ searchParams }: Props) {
  const params = await searchParams;
  const isStandalone = params.standalone === 'true';

  return (
    <div className="min-h-screen bg-background">
      {!isStandalone && <Header />}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">
            Last updated: [DATE - TO BE FILLED BY LEGAL TEAM]
          </p>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
              This is a placeholder privacy policy. Please consult with a legal professional to create a policy that complies with GDPR and other applicable regulations.
            </p>
          </div>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] Welcome to SailSmart. We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, disclose, and safeguard your information when you use our service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Data Controller</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] The data controller responsible for your personal data is:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Company Name: [TO BE FILLED]</li>
              <li>Address: [TO BE FILLED]</li>
              <li>Email: [TO BE FILLED]</li>
              <li>Data Protection Officer: [TO BE FILLED]</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Data We Collect</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] We collect the following categories of personal data:
            </p>
            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.1 Account Information</h3>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Name and email address</li>
              <li>Phone number (optional)</li>
              <li>Profile photo (optional)</li>
              <li>Account credentials</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.2 Sailing Profile Data</h3>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Sailing experience level</li>
              <li>Certifications and qualifications</li>
              <li>Skills and competencies</li>
              <li>Risk level preferences</li>
              <li>Sailing preferences (may include dietary restrictions, health information)</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.3 Boat Information (for owners)</h3>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Boat specifications and characteristics</li>
              <li>Boat images</li>
              <li>Journey and route information</li>
              <li>Crew requirements</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.4 Location Data</h3>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Waypoints and route coordinates for journeys</li>
              <li>Home port information</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. How We Use Your Data</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] We use your personal data for the following purposes:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>To provide and maintain our service</li>
              <li>To match crew members with sailing opportunities</li>
              <li>To facilitate communication between boat owners and crew</li>
              <li>To send service-related notifications</li>
              <li>To improve our service through analytics</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. AI-Powered Matching</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] With your explicit consent, we use artificial intelligence (AI) to assess the compatibility between crew members and sailing opportunities. This involves:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Analyzing your profile data against journey requirements</li>
              <li>Generating match scores and recommendations</li>
              <li>Processing by third-party AI services (Anthropic Claude)</li>
            </ul>
            <p className="text-foreground/80 mt-4">
              You can opt out of AI processing at any time in your privacy settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Legal Basis for Processing</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] We process your personal data based on:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li><strong>Consent:</strong> For AI processing, marketing communications, and profile sharing</li>
              <li><strong>Contract:</strong> To provide our service as agreed in the Terms of Service</li>
              <li><strong>Legitimate Interest:</strong> For service improvement and security</li>
              <li><strong>Legal Obligation:</strong> To comply with applicable laws</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Data Sharing</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] We may share your data with:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li><strong>Boat Owners:</strong> Your profile information when you apply for crew positions (with your consent)</li>
              <li><strong>Service Providers:</strong> Supabase (database), Anthropic (AI processing)</li>
              <li><strong>Legal Authorities:</strong> When required by law</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Your Rights</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] Under GDPR, you have the following rights:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li><strong>Right to Access:</strong> View all data we hold about you</li>
              <li><strong>Right to Rectification:</strong> Correct inaccurate data</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your data</li>
              <li><strong>Right to Data Portability:</strong> Export your data in a machine-readable format</li>
              <li><strong>Right to Withdraw Consent:</strong> Revoke previously given consent</li>
              <li><strong>Right to Object:</strong> Object to certain processing activities</li>
            </ul>
            <p className="text-foreground/80 mt-4">
              You can exercise these rights in your{' '}
              <Link href="/settings/privacy" className="text-primary hover:underline">
                Privacy Settings
              </Link>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Data Retention</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] We retain your personal data for as long as your account is active or as needed to provide our services. You can delete your account at any time, which will result in the deletion of your personal data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Cookies</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] We use cookies and similar technologies. You can manage your cookie preferences through our cookie consent banner. See our Cookie Policy for more details.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Security</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] We implement appropriate technical and organizational measures to protect your personal data, including encryption, access controls, and regular security assessments.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">12. International Transfers</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] Your data may be transferred to and processed in countries outside the EEA. We ensure appropriate safeguards are in place for such transfers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">13. Changes to This Policy</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] We may update this privacy policy from time to time. We will notify you of any significant changes by email or through our service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">14. Contact Us</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] If you have any questions about this privacy policy or our data practices, please contact us at:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Email: [TO BE FILLED]</li>
              <li>Address: [TO BE FILLED]</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">15. Supervisory Authority</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] You have the right to lodge a complaint with a supervisory authority if you believe your data protection rights have been violated.
            </p>
          </section>
        </article>

        {!isStandalone && (
          <div className="mt-12 pt-8 border-t border-border">
            <Link
              href="/"
              className="text-primary hover:underline"
            >
              &larr; Back to Home
            </Link>
          </div>
        )}
      </main>

      {!isStandalone && <Footer />}
    </div>
  );
}
