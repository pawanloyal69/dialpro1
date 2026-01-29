import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';

const TermsConditions = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
          data-testid="back-button"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-6 text-primary">Terms & Conditions</h1>
          
          <div className="prose dark:prose-invert max-w-none space-y-6">
            <p className="text-gray-600 dark:text-gray-300">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">1. Acceptance of Terms</h2>
              <p className="text-gray-700 dark:text-gray-300">
                By accessing and using Dial Pro services, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">2. Service Description</h2>
              <p className="text-gray-700 dark:text-gray-300">
                Dial Pro provides virtual phone number services, including:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Virtual phone numbers from multiple countries</li>
                <li>Voice calling capabilities (inbound and outbound)</li>
                <li>SMS messaging services</li>
                <li>Voicemail recording on missed calls</li>
                <li>Wallet-based payment system with USDT and Google Play top-up options</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">3. User Accounts</h2>
              <p className="text-gray-700 dark:text-gray-300">
                To use our services, you must:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Create an account with accurate and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Be at least 18 years old or have parental consent</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">4. Pricing and Payments</h2>
              <p className="text-gray-700 dark:text-gray-300">
                Our pricing structure includes:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Monthly rental fees for virtual numbers (vary by country)</li>
                <li>Per-minute charges for voice calls</li>
                <li>Per-message charges for SMS</li>
                <li>Unlimited calling plans with 2000 minutes FUP (Fair Usage Policy)</li>
                <li>15% service charge on Google Play top-ups</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mt-2">
                All prices are in USD. Payments are non-refundable unless otherwise stated.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">5. Acceptable Use Policy</h2>
              <p className="text-gray-700 dark:text-gray-300">
                You agree not to use our services for:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Illegal activities or fraud</li>
                <li>Harassment, threats, or abusive communications</li>
                <li>Spam or unsolicited commercial messages</li>
                <li>Impersonation or misrepresentation</li>
                <li>Violation of any applicable laws or regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">6. Service Availability</h2>
              <p className="text-gray-700 dark:text-gray-300">
                While we strive to maintain uninterrupted service, we do not guarantee:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>100% uptime or availability</li>
                <li>Uninterrupted or error-free service</li>
                <li>Call quality in all network conditions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">7. Termination</h2>
              <p className="text-gray-700 dark:text-gray-300">
                We reserve the right to suspend or terminate your account for:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Violation of these terms</li>
                <li>Fraudulent or illegal activity</li>
                <li>Non-payment of fees</li>
                <li>At our discretion with reasonable notice</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">8. Limitation of Liability</h2>
              <p className="text-gray-700 dark:text-gray-300">
                Dial Pro shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of our services. Our total liability shall not exceed the amount paid by you in the preceding 12 months.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">9. Changes to Terms</h2>
              <p className="text-gray-700 dark:text-gray-300">
                We may update these terms from time to time. Continued use of our services after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">10. Contact Us</h2>
              <p className="text-gray-700 dark:text-gray-300">
                For questions about these Terms & Conditions, please contact us at:
              </p>
              <p className="text-gray-700 dark:text-gray-300 mt-2">
                Email: support@dialpro.live<br />
                Powered by Tech Talk Titan
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsConditions;
