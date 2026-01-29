import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowLeft, Phone, Globe, Shield, Zap } from 'lucide-react';

const AboutUs = () => {
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
          <h1 className="text-3xl font-bold mb-6 text-primary">About Dial Pro</h1>
          
          <div className="prose dark:prose-invert max-w-none space-y-6">
            {/* Hero Section */}
            <div className="text-center py-6 border-b">
              <div className="w-20 h-20 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <Phone className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Your Global Communication Partner</h2>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                Powered by Tech Talk Titan
              </p>
            </div>

            {/* About */}
            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">Who We Are</h2>
              <p className="text-gray-700 dark:text-gray-300">
                Dial Pro is a cloud-based virtual phone number service that enables individuals and businesses to communicate seamlessly across borders. We provide virtual phone numbers from multiple countries, allowing you to make and receive calls, send SMS, and manage your communications from anywhere in the world.
              </p>
            </section>

            {/* Features */}
            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">Our Services</h2>
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <Globe className="w-8 h-8 text-primary mb-2" />
                  <h3 className="font-semibold">Global Numbers</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Virtual numbers from 10+ countries including USA, UK, Canada, Australia, and more.
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <Phone className="w-8 h-8 text-primary mb-2" />
                  <h3 className="font-semibold">Voice & SMS</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Make calls and send SMS worldwide with competitive rates and crystal-clear quality.
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <Shield className="w-8 h-8 text-primary mb-2" />
                  <h3 className="font-semibold">Privacy First</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Keep your personal number private. Use virtual numbers for business, dating, or any purpose.
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <Zap className="w-8 h-8 text-primary mb-2" />
                  <h3 className="font-semibold">Instant Setup</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Get your virtual number instantly. No contracts, no hidden fees, pay as you go.
                  </p>
                </div>
              </div>
            </section>

            {/* Countries */}
            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">Available Countries</h2>
              <div className="flex flex-wrap gap-2">
                {['🇺🇸 USA', '🇨🇦 Canada', '🇬🇧 UK', '🇦🇺 Australia', '🇳🇱 Netherlands', '🇵🇱 Poland', '🇸🇮 Slovenia', '🇿🇦 South Africa', '🇸🇪 Sweden', '🇨🇭 Switzerland'].map((country) => (
                  <span
                    key={country}
                    className="px-3 py-1 bg-gray-100 dark:bg-slate-700 rounded-full text-sm"
                  >
                    {country}
                  </span>
                ))}
              </div>
            </section>

            {/* Pricing Highlights */}
            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">Affordable Pricing</h2>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Numbers starting from just $5/month</li>
                <li>Calls from $0.028/minute</li>
                <li>SMS from $0.0163/message</li>
                <li>Unlimited calling plans available (2000 min FUP)</li>
                <li>Flexible top-up options: Google Play & USDT</li>
              </ul>
            </section>

            {/* Mission */}
            <section>
              <h2 className="text-xl font-semibold mt-6 mb-3">Our Mission</h2>
              <p className="text-gray-700 dark:text-gray-300">
                At Dial Pro, we believe communication should be borderless, affordable, and accessible to everyone. Our mission is to break down geographical barriers and empower individuals and businesses to connect with anyone, anywhere in the world.
              </p>
            </section>

            {/* Contact */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-3">Get in Touch</h2>
              <p className="text-gray-700 dark:text-gray-300">
                Have questions or need support? We're here to help.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mt-2">
                <strong>Email:</strong> support@dialpro.live<br />
                <strong>Website:</strong> dialpro.live
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                © {new Date().getFullYear()} Dial Pro. Powered by Tech Talk Titan.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
