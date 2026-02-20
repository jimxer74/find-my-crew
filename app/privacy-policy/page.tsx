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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">
            Last updated: February 20, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p className="text-foreground/80 mb-4">
              Welcome to SailSmart. We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform, application, and related services (collectively, the &quot;Service&quot;).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Data Controller</h2>
            <p className="text-foreground/80 mb-4">
              The data controller responsible for your personal data is:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li><strong>Company:</strong> SailSmart Inc.</li>
              <li><strong>Contact Email:</strong> privacy@sailsmart.app</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Data We Collect</h2>
            <p className="text-foreground/80 mb-4">
              We collect the following categories of personal data to provide and improve our Service:
            </p>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.1 Account Information</h3>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Name and email address</li>
              <li>Phone number (optional, for notifications and contact matching)</li>
              <li>Profile photo</li>
              <li>Authentication credentials</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.2 Sailing Profile Data</h3>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Sailing experience level and logged nautical miles</li>
              <li>Certifications and maritime qualifications (including uploaded documents)</li>
              <li>Sailing skills and competencies</li>
              <li>Risk level preferences</li>
              <li>Individual preferences (including dietary restrictions and relevant health information provided voluntarily for journey planning)</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.3 Boat Information (Boat Owners)</h3>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Boat specifications, characteristics, and equipment</li>
              <li>Boat images and documentation</li>
              <li>Journey and route planning information</li>
              <li>Crew requirements and preferences</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.4 Location and Technical Data</h3>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Waypoints, route coordinates, and journey tracking</li>
              <li>Home port information</li>
              <li>Device and usage data (IP address, browser type, interaction metrics)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. How We Use Your Data</h2>
            <p className="text-foreground/80 mb-4">
              We use your personal data for the following purposes:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>To provide, operate, and maintain our Service</li>
              <li>To accurately match crew members with relevant sailing opportunities</li>
              <li>To facilitate secure communication between boat owners and crew</li>
              <li>To send administrative and service-related notifications</li>
              <li>To analyze usage patterns and improve our Service</li>
              <li>To enforce our Terms of Service and comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. AI-Powered Matching and Processing</h2>
            <p className="text-foreground/80 mb-4">
              With your consent, we utilize artificial intelligence (AI) technologies to enhance compatibility between crew members and sailing opportunities. This involves:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Analyzing your profile data (experience, skills, preferences) against specific journey requirements</li>
              <li>Generating match scores, safety insights, and recommendations</li>
              <li>Processing interactions securely through third-party AI services, specifically Anthropic&apos;s Claude models</li>
            </ul>
            <p className="text-foreground/80 mt-4">
              Our AI partners act strictly as data processors and are entirely prohibited from using your personal data to train their foundational models. You may manage your consent for AI processing in your Privacy Settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Legal Basis for Processing</h2>
            <p className="text-foreground/80 mb-4">
              We process your personal data relying on the following lawful bases:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li><strong>Consent:</strong> For AI processing analytics, marketing communications, and sharing specific profile attributes.</li>
              <li><strong>Contractual Necessity:</strong> To provide our Service as agreed upon in the Terms of Service (e.g., account provision, core matching operations).</li>
              <li><strong>Legitimate Interest:</strong> For Service improvement, security monitoring, and fraud prevention.</li>
              <li><strong>Legal Obligation:</strong> To comply with applicable laws and regulatory requirements.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Data Sharing and Transfer</h2>
            <p className="text-foreground/80 mb-4">
              We may share your data with the following parties under strict confidentiality agreements:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li><strong>Other Users (Boat Owners/Crew):</strong> Your relevant profile information is shared when you apply for positions or post journeys, solely to facilitate matching.</li>
              <li><strong>Service Providers:</strong> third-party vendors who provide crucial underlying infrastructure (e.g., Supabase for database hosting and Anthropic for AI processing).</li>
              <li><strong>Legal Authorities:</strong> When required by binding lawful requests, court orders, or to protect the safety of our users.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Your Data Protection Rights</h2>
            <p className="text-foreground/80 mb-4">
              Depending on your location (including under GDPR, CCPA, and similar regulations), you have the following rights regarding your personal data:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li><strong>Right to Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong>Right to Erasure (&quot;Right to be Forgotten&quot;):</strong> Request deletion of your personal data.</li>
              <li><strong>Right to Data Portability:</strong> Obtain your data in a structured, commonly used, machine-readable format.</li>
              <li><strong>Right to Withdraw Consent:</strong> Revoke previously given consent entirely at your discretion.</li>
              <li><strong>Right to Object or Restrict:</strong> Object to or ask us to restrict certain processing activities.</li>
            </ul>
            <p className="text-foreground/80 mt-4">
              You can exercise these rights directly within your{' '}
              <Link href="/settings/privacy" className="text-primary hover:underline">
                Privacy Settings
              </Link>{' '}
              or by contacting us at privacy@sailsmart.app.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Data Retention</h2>
            <p className="text-foreground/80 mb-4">
              We retain your personal data strictly for as long as your account is active or as necessary to fulfill the purposes outlined in this policy. Upon account deletion, we will securely erase or anonymize your personal data within 30 days, except where retention is necessary to comply with legal obligations or resolve ongoing disputes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Cookies and Tracking Technologies</h2>
            <p className="text-foreground/80 mb-4">
              We use cookies, local storage, and similar technologies to ensure basic Service functionality, remember your preferences, and analyze Service usage. You can manage your preferences through your browser settings or our centralized privacy dashboard.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Security Measures</h2>
            <p className="text-foreground/80 mb-4">
              We implement robust technical and organizational security measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. This includes encryption of data at rest and in transit, strict access controls, and continuous vulnerability monitoring.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">12. International Data Transfers</h2>
            <p className="text-foreground/80 mb-4">
              Your data may be transferred to, and processed in, countries outside your jurisdiction (such as the United States) where our primary servers are located. We ensure that appropriate safeguards, such as Standard Contractual Clauses (SCCs), are implemented for any cross-border data transfers to maintain the security of your information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">13. Changes to This Privacy Policy</h2>
            <p className="text-foreground/80 mb-4">
              We reserve the right to modify this Privacy Policy at our discretion. We will notify you of any material changes by posting the updated policy on this page, updating the &quot;Last updated&quot; date, and sending an email notification prior to the changes taking effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">14. Contact Us</h2>
            <p className="text-foreground/80 mb-4">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data processing practices, please contact our Data Protection Office at:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li><strong>Email:</strong> privacy@sailsmart.app</li>
            </ul>
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
