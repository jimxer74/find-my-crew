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
            Last updated: February 20, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Agreement to Terms</h2>
            <p className="text-foreground/80 mb-4">
              By accessing or using SailSmart (the &quot;Service&quot;), you agree to be bound by these Terms of Service and our related Privacy Policy. If you do not agree to all of these terms, please do not use our Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Description of Service</h2>
            <p className="text-foreground/80 mb-4">
              SailSmart is an online platform that aims to connect boat owners (&quot;Owners&quot;) with crew members (&quot;Crew&quot;) for organized sailing journeys. The features provided include:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Profile creation for Crew to outline expertise, certifications, and experience.</li>
              <li>Journey planning, route specification, and crew requirement generation for Owners.</li>
              <li>Platform tools explicitly facilitating matching, communication, and logistical planning.</li>
              <li>Optional AI-powered assessment tools for determining journey compatibility.</li>
            </ul>
            <p className="text-foreground/80 mt-4">
              SailSmart exclusively acts as a matching facilitator and communication platform. We are not a party to any agreement, contract, or arrangement entered into between Owners and Crew.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. User Accounts</h2>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.1 Account Creation</h3>
            <p className="text-foreground/80 mb-4">
              To utilize certain Service features, you must create a registered account. By creating an account, you represent and warrant that the information you provide is true, accurate, current, and complete at all times.
            </p>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.2 Account Security</h3>
            <p className="text-foreground/80 mb-4">
              You are entirely responsible for maintaining the confidentiality of your account credentials and for any activity that occurs under your account. You agree to immediately notify SailSmart of any unauthorized use or security breach regarding your account.
            </p>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">3.3 Age Requirement</h3>
            <p className="text-foreground/80 mb-4">
              You must be at least 18 years of age (or the age of legal majority in your jurisdiction) to create an account and use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. User Responsibilities and Platform Conduct</h2>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">4.1 Obligations of Crew Members</h3>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Accurately represent your maritime skills, certifications, and overall experience level without exaggeration.</li>
              <li>Maintain valid and current certifications, documentation, and identity verification as claimed in your profile.</li>
              <li>Respect commitments and schedules established directly with an Owner.</li>
              <li>Strictly adhere to safety guidelines and the commands of the designated skipper or boat Owner during any journey facilitated through SailSmart.</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">4.2 Obligations of Boat Owners</h3>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Truthfully represent the vessel&apos;s specifications, condition, capability, and planned journey legs.</li>
              <li>Take sole responsibility for ensuring the vessel meets all relevant legal, safety, and seaworthiness requirements.</li>
              <li>Maintain valid and sufficient insurance coverage suitable for the vessel, explicit itinerary, and intended number of Crew aboard.</li>
              <li>Clearly outline all expectations, safety protocols, duties, and onboard rules for the Crew prior to embarking.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Prohibited Conduct</h2>
            <p className="text-foreground/80 mb-4">
              As a condition of using the Service, you agree that you will not:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>Submit false, misleading, or fraudulent information or upload fraudulent documentation.</li>
              <li>Impersonate someone else or misrepresent your affiliation with a person or entity.</li>
              <li>Utilize the platform to orchestrate, promote, or engage in any illegal activity, including unauthorized commercial charters.</li>
              <li>Harass, threaten, demean, or engage in abusive behavior toward other users.</li>
              <li>Attempt to bypass, disable, or interfere with security features constructed within the Service.</li>
              <li>Scrape, extract, or automatically collect user data or platform content for unauthorized purposes.</li>
              <li>Use the platform for unsolicited advertising, spam, or external solicitation.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. AI-Powered Features and Assessment</h2>
            <p className="text-foreground/80 mb-4">
              SailSmart integrates artificial intelligence (AI) to generate match scores, suggest recommendations, and assist in journey planning by assessing profile data.
            </p>
            <p className="text-foreground/80 mt-4">
              <strong>Crucial Advisory Notice:</strong> Output generated by our AI features is strictly advisory. AI evaluations cannot and do not guarantee safety, seaworthiness, personal physical fitness, or human compatibility. AI recommendations must never replace independent verification, due diligence, and sound maritime judgment. You voluntarily accept all risks associated with relying on AI-generated suggestions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Disclaimer of Warranties and Liability</h2>
            <p className="text-foreground/80 mb-4">
              SailSmart provides the Service strictly on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. To the maximum extent permitted by applicable law, we expressly disclaim all warranties, whether express, implied, or statutory.
            </p>
            <p className="text-foreground/80 mb-4">
              Furthermore, SailSmart does not verify, warrant, or guarantee:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li>The absolute accuracy or authenticity of user-generated profiles, experience levels, or certifications.</li>
              <li>The physical seaworthiness, legal compliance, or safety of any vessel listed on the platform.</li>
              <li>The competence, mental fitness, or capabilities of any Owner or Crew member.</li>
            </ul>
            <p className="text-foreground/80 mt-4 font-semibold">
              Sailing involves inherent physical risk. You explicitly acknowledge that joining a journey or accepting crew aboard your vessel is undertaken entirely at your own risk. SailSmart holds no liability whatsoever for property damage, personal injury, distress, or death resulting from interactions, meetings, or journeys originating on this platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Limitation of Liability</h2>
            <p className="text-foreground/80 mb-4">
              To the absolute maximum extent permitted by applicable law, under no circumstances shall SailSmart Inc., its directors, employees, partners, or agents be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, loss of data, loss of use, goodwill, or other intangible losses, resulting from (a) your access to or use of or inability to access or use the Service; (b) any conduct or content of any third party on the Service; or (c) unauthorized access, use, or alteration of your transmissions or content.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Intellectual Property</h2>
            <p className="text-foreground/80 mb-4">
              The Service, including original content, platform design, visual interfaces, interactive features, code, and databases, is the exclusive proprietary property of SailSmart Inc. and is protected by copyright, trademark, and other applicable intellectual property laws. Unauthorized reproduction or distribution is strictly prohibited.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">10. User Content and License</h2>
            <p className="text-foreground/80 mb-4">
              You retain all ownership rights to the content, images, and text you submit or upload. However, by uploading content to SailSmart, you grant us a worldwide, non-exclusive, royalty-free, transferable license to use, display, reproduce, and adapt that content solely for the purpose of operating, improving, and promoting the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Account Termination</h2>
            <p className="text-foreground/80 mb-4">
              We reserve the right to suspend or terminate your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever, including but not limited to your breach of these Terms of Service. You may permanently delete your account at any time through your account settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">12. Changes to these Terms</h2>
            <p className="text-foreground/80 mb-4">
              We reserve the right, at our sole discretion, to modify or replace these Terms of Service at any time. We will provide reasonable advance notice of any material changes. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">13. Governing Law and Jurisdiction</h2>
            <p className="text-foreground/80 mb-4">
              These Terms shall be governed and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any legal action or proceeding arising under these Terms will be brought exclusively in the federal or state courts located in Delaware, and the parties hereby irrevocably consent to the personal jurisdiction and venue therein.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">14. Severability</h2>
            <p className="text-foreground/80 mb-4">
              If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, the remaining provisions of these Terms will remain in full force and effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">15. Contact Information</h2>
            <p className="text-foreground/80 mb-4">
              If you have any questions or to report violations regarding these Terms of Service, please contact us at:
            </p>
            <ul className="list-disc pl-6 text-foreground/80 space-y-2">
              <li><strong>Email:</strong> legal@sailsmart.app</li>
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
