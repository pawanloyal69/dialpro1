import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Phone, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

const NumberManagement = () => {
  const [countries, setCountries] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [myNumbers, setMyNumbers] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCountries();
    loadPricing();
    loadMyNumbers();
  }, []);

  useEffect(() => {
    if (selectedCountry) {
      loadAvailableNumbers(selectedCountry);
    }
  }, [selectedCountry]);

  const loadCountries = async () => {
    try {
      const response = await api.get('/countries');
      setCountries(response.data);
    } catch (error) {
      console.error('Failed to load countries:', error);
    }
  };

  const loadPricing = async () => {
    try {
      const response = await api.get('/pricing');
      setPricing(response.data);
    } catch (error) {
      console.error('Failed to load pricing:', error);
    }
  };

  const loadAvailableNumbers = async (countryCode) => {
    try {
      const response = await api.get(`/numbers/available?country_code=${countryCode}`);
      setAvailableNumbers(response.data);
    } catch (error) {
      console.error('Failed to load available numbers:', error);
    }
  };

  const loadMyNumbers = async () => {
    try {
      const response = await api.get('/numbers/my');
      setMyNumbers(response.data);
    } catch (error) {
      console.error('Failed to load my numbers:', error);
    }
  };

  const handlePurchase = async (numberId) => {
    setLoading(true);
    try {
      await api.post('/numbers/purchase', { number_id: numberId });
      toast.success('Number purchased successfully!');
      loadAvailableNumbers(selectedCountry);
      loadMyNumbers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const getPricingForCountry = (countryCode) => {
    return pricing.find(p => p.country_code === countryCode);
  };

  return (
    <Card data-testid="number-management-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Virtual Numbers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="available" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="available" data-testid="tab-available">Available</TabsTrigger>
            <TabsTrigger value="my-numbers" data-testid="tab-my-numbers">My Numbers</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-4">
            {/* Country Selector */}
            <div>
              <label className="text-sm font-medium mb-2 block">Select Country</label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger data-testid="country-select">
                  <SelectValue placeholder="Choose a country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.id} value={country.code}>
                      {country.flag} {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pricing Info */}
            {selectedCountry && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                {getPricingForCountry(selectedCountry) && (
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100">Pricing</p>
                    <p className="text-blue-800 dark:text-blue-200">
                      Number: <span className="font-bold">${getPricingForCountry(selectedCountry).number_price_monthly}/month</span>
                    </p>
                    <p className="text-blue-800 dark:text-blue-200">
                      Calls: <span className="font-bold">${getPricingForCountry(selectedCountry).call_price_per_minute}/min</span>
                    </p>
                    <p className="text-blue-800 dark:text-blue-200">
                      SMS: <span className="font-bold">${getPricingForCountry(selectedCountry).sms_price}/msg</span>
                    </p>
                    <p className="text-blue-800 dark:text-blue-200">
                      Unlimited Calls: <span className="font-bold">${getPricingForCountry(selectedCountry).unlimited_call_plan_monthly}/month</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Available Numbers */}
            {selectedCountry && (
              <div>
                <h3 className="font-medium mb-3">Available Numbers</h3>
                {availableNumbers.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-4">
                    No numbers available for this country
                  </p>
                ) : (
                  <div className="space-y-2">
                    {availableNumbers.map((number) => (
                      <div
                        key={number.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`available-number-${number.id}`}
                      >
                        <div>
                          <p className="font-mono font-medium">{number.phone_number}</p>
                          <p className="text-xs text-gray-500">{number.country_code}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handlePurchase(number.id)}
                          disabled={loading}
                          data-testid={`purchase-button-${number.id}`}
                        >
                          <ShoppingCart className="w-4 h-4 mr-1" />
                          Purchase
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-numbers" className="space-y-4">
            {myNumbers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>You don't have any numbers yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myNumbers.map((number) => (
                  <div
                    key={number.id}
                    className="p-4 border rounded-lg"
                    data-testid={`my-number-${number.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-mono font-medium text-lg">{number.phone_number}</p>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        Active
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Country: {number.country_code}</p>
                      <p>Next billing: {new Date(number.next_billing_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default NumberManagement;
