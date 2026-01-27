import { Footer } from '@/app/components/Footer';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | SailSmart',
  description: 'Terms of Service for SailSmart - The rules and guidelines for using our platform.',
};

type Props = {
  searchParams: Promise<{ standalone?: string }>;
};

export default async function TermsOfServicePage({ searchParams }: Props) {
  const params = await searchParams;
  const isStandalone = params.standalone === 'true';

  return (
    <div className="min-h-screen bg-background">

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">
            Last updated: [DATE - TO BE FILLED BY LEGAL TEAM]
          </p>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
              This is a placeholder terms of service. Please consult with a legal professional to create terms that are appropriate for your jurisdiction and business model.
            </p>
          </div>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Agreement to Terms</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] By accessing or using SailSmart, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Description of Service</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] SailSmart is a platform that connects boat owners with crew members for sailing journeys. Our service includes:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Profile creation for crew members and boat owners</li>
              <li>Journey planning and crew requirement specification</li>
              <li>Crew-to-journey matching and registration</li>
              <li>AI-powered compatibility assessment (optional)</li>
              <li>Communication tools between parties</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. User Accounts</h2>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.1 Account Creation</h3>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] To use our service, you must create an account. You agree to provide accurate, current, and complete information during registration.
            </p>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.2 Account Security</h3>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
            </p>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.3 Age Requirement</h3>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] You must be at least 18 years old to use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. User Responsibilities</h2>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">4.1 For Crew Members</h3>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Provide accurate information about your skills and experience</li>
              <li>Maintain valid certifications as claimed in your profile</li>
              <li>Honor commitments made to boat owners</li>
              <li>Follow safety guidelines and instructions from the skipper</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">4.2 For Boat Owners</h3>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Provide accurate information about your boat and journeys</li>
              <li>Ensure your vessel meets safety requirements</li>
              <li>Clearly communicate expectations and requirements to crew</li>
              <li>Maintain appropriate insurance coverage</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Prohibited Conduct</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] You agree not to:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Provide false or misleading information</li>
              <li>Impersonate another person or entity</li>
              <li>Use the service for illegal activities</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Circumvent security features</li>
              <li>Scrape or collect user data without permission</li>
              <li>Use the service for commercial spam</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. AI-Powered Features</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] Our service may use artificial intelligence to:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Assess compatibility between crew and journeys</li>
              <li>Generate match scores and recommendations</li>
              <li>Assist with journey planning</li>
            </ul>
            <p className="text-foreground/80 mt-4">
              AI features are optional and require your explicit consent. AI assessments are advisory only and should not replace human judgment regarding safety and suitability.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Disclaimer of Liability</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER - IMPORTANT: CONSULT LEGAL COUNSEL]
            </p>
            <p className="text-foreground/80 mb-4">
              SailSmart is a matching platform only. We do not:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Verify the accuracy of user-provided information</li>
              <li>Guarantee the seaworthiness of any vessel</li>
              <li>Guarantee the skills or qualifications of any crew member</li>
              <li>Assume responsibility for any sailing activities</li>
              <li>Provide insurance coverage for journeys</li>
            </ul>
            <p className="text-foreground/80 mt-4">
              Users are solely responsible for verifying credentials, conducting safety checks, and ensuring appropriate insurance coverage.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Limitation of Liability</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER - CONSULT LEGAL COUNSEL] To the maximum extent permitted by law, SailSmart shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Intellectual Property</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] The SailSmart service, including its design, features, and content, is protected by intellectual property laws. You may not copy, modify, or distribute our service without permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">10. User Content</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] You retain ownership of content you submit (photos, text, etc.). By submitting content, you grant us a license to use it for operating the service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Account Termination</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] We may suspend or terminate your account for violations of these terms. You may delete your account at any time through your privacy settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">12. Changes to Terms</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] We may modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">13. Governing Law</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] These terms are governed by the laws of [JURISDICTION - TO BE FILLED]. Any disputes shall be resolved in the courts of [JURISDICTION - TO BE FILLED].
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">14. Severability</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] If any provision of these terms is found to be unenforceable, the remaining provisions will continue in effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">15. Contact</h2>
            <p className="text-foreground/80 mb-4">
              [PLACEHOLDER] For questions about these terms, please contact us at:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Email: [TO BE FILLED]</li>
              <li>Address: [TO BE FILLED]</li>
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
