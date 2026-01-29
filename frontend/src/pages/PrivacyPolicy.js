import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';

const PrivacyPolicy = () => {
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
          <h1 className="text-3xl font-bold mb-6 text-primary">Privacy Policy</h1>
          
          <div className="prose dark:prose-invert max-w-none space-y-6">
            <p className="text-gray-600 dark:text-gray-300">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">1. Information We Collect</h2>
              <p className="text-gray-700 dark:text-gray-300">
                Dial Pro collects information you provide directly to us, including:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Name, email address, and phone number when you create an account</li>
                <li>Payment information when you make purchases or top-up your wallet</li>
                <li>Call logs, SMS messages, and usage data when you use our services</li>
                <li>Device information and IP address for security purposes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">2. How We Use Your Information</h2>
              <p className="text-gray-700 dark:text-gray-300">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Provide, maintain, and improve our virtual number services</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices, security alerts, and support messages</li>
                <li>Respond to your comments, questions, and customer service requests</li>
                <li>Comply with legal obligations and protect our rights</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">3. Information Sharing</h2>
              <p className="text-gray-700 dark:text-gray-300">
                We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>With service providers who assist in our operations (e.g., Twilio for telecommunications)</li>
                <li>To comply with legal obligations or respond to lawful requests</li>
                <li>To protect the rights, property, or safety of Dial Pro and our users</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">4. Data Security</h2>
              <p className="text-gray-700 dark:text-gray-300">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption, secure servers, and regular security assessments.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">5. Your Rights</h2>
              <p className="text-gray-700 dark:text-gray-300">
                You have the right to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Access and receive a copy of your personal data</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">6. Contact Us</h2>
              <p className="text-gray-700 dark:text-gray-300">
                If you have any questions about this Privacy Policy, please contact us at:
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

export default PrivacyPolicy;
